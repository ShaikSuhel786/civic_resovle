/**
 * Automated Test Suite: Phase 2 Community Impact Voting & Proof of Resolution
 * Tests:
 * 1. Community Impact Voting (PRD F7):
 *    - Unauthenticated rejection (401)
 *    - Role enforcement (Staff/Admin forbidden from citizen voting, 403)
 *    - Self-voting prevention (400)
 *    - Duplicate voting prevention (409)
 *    - Atomic vote counting and toggle removal (200/201)
 * 2. Proof of Resolution (PRD F4):
 *    - Enforcement of after-repair photo before marking a report Resolved (400)
 *    - Successful resolution when after-repair photo is present
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const jwt = require('jsonwebtoken');
const app = require('../server/index.js');
const db = require('../server/db/index.js');
const { JWT_SECRET } = require('../server/middleware/auth.js');

function makeToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const reqStream = new Readable({
      read() {
        if (options.body) this.push(Buffer.from(options.body));
        this.push(null);
      }
    });

    reqStream.method = method;
    reqStream.url = url;
    reqStream.headers = {
      'host': 'localhost:3050',
      'accept': 'application/json,text/html,*/*'
    };
    for (const [k, v] of Object.entries(options.headers || {})) {
      reqStream.headers[k.toLowerCase()] = v;
    }
    if (options.body) {
      reqStream.headers['content-type'] = 'application/json';
      reqStream.headers['content-length'] = Buffer.byteLength(options.body).toString();
    }

    const res = new ServerResponse(reqStream);
    let chunks = [];
    res.write = function(chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = function(chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const bodyStr = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try { json = JSON.parse(bodyStr); } catch (_) {}
      resolve({ status: res.statusCode, body: json || bodyStr, raw: bodyStr });
    };

    app(reqStream, res);
  });
}

async function runPhase2Tests() {
  console.log('\n====================================================');
  console.log('  RUNNING PHASE 2: VOTING & PROOF OF RESOLUTION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // Setup test accounts & report (using valid seeded database foreign keys)
  const citizen1 = { id: 'usr-citizen-01', email: 'citizen@civicsync.demo', role: 'citizen' };
  const citizen2 = { id: 'usr-citizen-02', email: 'citizen2@civicsync.demo', role: 'citizen' };
  const staffUser = { id: 'usr-staff-roads', email: 'staff.roads@civicsync.demo', role: 'staff', department_id: 'dept-roads' };
  const adminUser = { id: 'usr-admin-01', email: 'admin@civicsync.demo', role: 'admin' };

  const tokenCit1 = makeToken(citizen1);
  const tokenCit2 = makeToken(citizen2);
  const tokenStaff = makeToken(staffUser);
  const tokenAdmin = makeToken(adminUser);

  const testReportId = 'rep-test-vote-01';
  db.run("DELETE FROM community_votes WHERE report_id = ?", [testReportId]);
  db.run("DELETE FROM photo_metadata WHERE report_id = ?", [testReportId]);
  db.run("DELETE FROM reports WHERE id = ?", [testReportId]);

  // Insert a test report owned by citizen1
  db.run(`
    INSERT INTO reports (
      id, reference_number, citizen_id, title, description, category_id, department_id,
      location_text, latitude, longitude, status, assigned_staff_id, community_votes, created_at, updated_at
    ) VALUES (
      ?, 'REP-TEST-VOTE', ?, 'Large Crater on 4th Lane', 'Pothole spanning 2 meters creating hazard for commuters.',
      'cat-roads', 'dept-roads', 'Banjara Hills, Road 4', 17.4156, 78.4352, 'In Progress', ?, 0, datetime('now'), datetime('now')
    )
  `, [testReportId, citizen1.id, staffUser.id]);

  // 1. Voting Authentication & Role Guard Tests
  await test('POST /api/reports/:id/vote rejects unauthenticated requests with 401', async () => {
    const res = await request(`/api/reports/${testReportId}/vote`, { method: 'POST' });
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/reports/:id/vote rejects non-citizen roles (staff/admin) with 403', async () => {
    const resStaff = await request(`/api/reports/${testReportId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenStaff}` }
    });
    assert.strictEqual(resStaff.status, 403);
    assert.ok(resStaff.body.error.includes('Only citizens'));

    const resAdmin = await request(`/api/reports/${testReportId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(resAdmin.status, 403);
  });

  await test('POST /api/reports/:id/vote prevents citizens from upvoting their own report', async () => {
    const res = await request(`/api/reports/${testReportId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` }
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('cannot upvote your own'));
  });

  // 2. Upvoting & Duplicate Prevention Tests
  await test('POST /api/reports/:id/vote records citizen upvote and increments vote count', async () => {
    const res = await request(`/api/reports/${testReportId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit2}` }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.voted, true);
    assert.strictEqual(res.body.communityVotes, 1);

    const dbReport = db.get('SELECT community_votes FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(dbReport.community_votes, 1);
  });

  await test('POST /api/reports/:id/vote prevents duplicate voting by the same citizen (409 Conflict)', async () => {
    const res = await request(`/api/reports/${testReportId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit2}` }
    });
    assert.strictEqual(res.status, 409);
    assert.ok(res.body.error.includes('already upvoted'));

    // Count must remain 1
    const dbReport = db.get('SELECT community_votes FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(dbReport.community_votes, 1);
  });

  await test('GET /api/reports/:id/vote-status accurately returns vote state and count', async () => {
    const res = await request(`/api/reports/${testReportId}/vote-status`, {
      headers: { 'Authorization': `Bearer ${tokenCit2}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.hasVoted, true);
    assert.strictEqual(res.body.communityVotes, 1);

    const resUnvoted = await request(`/api/reports/${testReportId}/vote-status`, {
      headers: { 'Authorization': `Bearer ${tokenCit1}` }
    });
    assert.strictEqual(resUnvoted.body.hasVoted, false);
  });

  await test('DELETE /api/reports/:id/vote removes citizen upvote and decrements vote count', async () => {
    const res = await request(`/api/reports/${testReportId}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenCit2}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.voted, false);
    assert.strictEqual(res.body.communityVotes, 0);

    const dbReport = db.get('SELECT community_votes FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(dbReport.community_votes, 0);

    // Second delete attempt should return 404
    const resSecond = await request(`/api/reports/${testReportId}/vote`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenCit2}` }
    });
    assert.strictEqual(resSecond.status, 404);
  });

  // 3. Proof of Resolution (PRD F4) Tests
  await test('POST /api/staff/reports/:id/status rejects resolving report without after-repair photo', async () => {
    const res = await request(`/api/staff/reports/${testReportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenStaff}` },
      body: JSON.stringify({
        newStatus: 'Resolved',
        resolutionSummary: 'Completed full depth asphalt resurfacing and leveled pavement.'
      })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Proof of Resolution Required'));
  });

  await test('POST /api/staff/reports/:id/status successfully resolves report when after-repair photo is present', async () => {
    // Attach an after-repair photo to test report
    const photoId = 'pho-test-proof-01';
    db.run(`
      INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, created_at)
      VALUES (?, ?, ?, '/uploads/after-repair.png', 'after-repair.png', 'image/png', 102400, 1, datetime('now'))
    `, [photoId, testReportId, staffUser.id]);

    const res = await request(`/api/staff/reports/${testReportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenStaff}` },
      body: JSON.stringify({
        newStatus: 'Resolved',
        resolutionSummary: 'Completed full depth asphalt resurfacing and leveled pavement.'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const updatedRep = db.get('SELECT status, resolution_summary FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(updatedRep.status, 'Resolved');
    assert.ok(updatedRep.resolution_summary.includes('asphalt resurfacing'));
  });

  // Cleanup test artifacts
  db.run("DELETE FROM community_votes WHERE report_id = ?", [testReportId]);
  db.run("DELETE FROM photo_metadata WHERE report_id = ?", [testReportId]);
  db.run("DELETE FROM reports WHERE id = ?", [testReportId]);

  console.log('----------------------------------------------------');
  console.log(`  PHASE 2 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runPhase2Tests();
}

module.exports = runPhase2Tests;
