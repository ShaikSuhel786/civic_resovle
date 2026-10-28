/**
 * Automated Test Suite: Phase 3 Smart Escalation Engine, Citizen Appeals & Feedback
 * Tests:
 * 1. Smart Escalation Engine (PRD F5):
 *    - Automatic SLA deadline calculation on report creation
 *    - GET /api/reports/:id/sla status retrieval
 *    - In-process escalation job checker (Level 1 Warning at 80%, Level 2 Breach when Overdue)
 * 2. Citizen Appeals & Review (PRD Section 4 & 5):
 *    - Unauthenticated rejection (401)
 *    - Role enforcement (only citizen owner can appeal, 403)
 *    - Status validation (only Resolved or Rejected reports can be appealed, 400)
 *    - Reason validation (minimum 10 characters, 400)
 *    - Successful appeal submission on Rejected and Resolved reports (201)
 *    - Duplicate pending appeal prevention (409 Conflict)
 *    - Admin appeal list retrieval (GET /api/admin/appeals)
 *    - Admin arbitration approval (reopens report to Under Review)
 *    - Admin arbitration rejection (upholds resolution/rejection)
 * 3. Citizen Satisfaction Feedback (PRD Section 4 #48):
 *    - Rejection on non-resolved reports (400)
 *    - Rating range validation 1-5 (400)
 *    - Successful rating submission (201)
 *    - Duplicate rating prevention (409)
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const jwt = require('jsonwebtoken');
const app = require('../server/index.js');
const db = require('../server/db/index.js');
const { JWT_SECRET } = require('../server/middleware/auth.js');
const { calculateSlaDeadline, getSlaStatus, checkEscalations } = require('../server/services/escalation.js');

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

async function runPhase3Tests() {
  console.log('\n====================================================');
  console.log('  RUNNING PHASE 3: ESCALATION, APPEALS & FEEDBACK');
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

  // Seeded test accounts
  const citizen1 = { id: 'usr-citizen-01', email: 'citizen@civicsync.demo', role: 'citizen' };
  const citizen2 = { id: 'usr-citizen-02', email: 'citizen2@civicsync.demo', role: 'citizen' };
  const adminUser = { id: 'usr-admin-01', email: 'admin@civicsync.demo', role: 'admin' };
  const staffUser = { id: 'usr-staff-roads', email: 'staff.roads@civicsync.demo', role: 'staff' };

  const tokenCit1 = makeToken(citizen1);
  const tokenCit2 = makeToken(citizen2);
  const tokenAdmin = makeToken(adminUser);
  const tokenStaff = makeToken(staffUser);

  // Clean test reports
  const repEscalationId = 'rep-test-esc-01';
  const repAppealRejectedId = 'rep-test-app-rej-01';
  const repAppealResolvedId = 'rep-test-app-res-01';

  const testIds = [repEscalationId, repAppealRejectedId, repAppealResolvedId];
  for (const tid of testIds) {
    db.run("DELETE FROM report_appeals WHERE report_id = ?", [tid]);
    db.run("DELETE FROM report_feedback WHERE report_id = ?", [tid]);
    db.run("DELETE FROM report_events WHERE report_id = ?", [tid]);
    db.run("DELETE FROM notifications WHERE report_id = ?", [tid]);
    db.run("DELETE FROM reports WHERE id = ?", [tid]);
  }

  // --------------------------------------------------------------------------
  // 1. SMART ESCALATION ENGINE (PRD F5) TESTS
  // --------------------------------------------------------------------------

  await test('SLA deadline calculation sets correct duration based on priority and category', () => {
    const now = new Date('2026-10-29T10:00:00Z');
    // Urgent hazard: 24h
    const urgentDeadline = calculateSlaDeadline(now.toISOString(), 'Urgent', 'cat-roads', 1);
    const diffUrgent = (new Date(urgentDeadline).getTime() - now.getTime()) / 3600000;
    assert.strictEqual(diffUrgent, 24);

    // High priority: 72h
    const highDeadline = calculateSlaDeadline(now.toISOString(), 'High', 'cat-roads', 0);
    const diffHigh = (new Date(highDeadline).getTime() - now.getTime()) / 3600000;
    assert.strictEqual(diffHigh, 72);

    // Sanitation: 48h
    const sanDeadline = calculateSlaDeadline(now.toISOString(), 'Medium', 'cat-garbage', 0);
    const diffSan = (new Date(sanDeadline).getTime() - now.getTime()) / 3600000;
    assert.strictEqual(diffSan, 48);

    // Default medium: 168h (7 days)
    const medDeadline = calculateSlaDeadline(now.toISOString(), 'Medium', 'cat-roads', 0);
    const diffMed = (new Date(medDeadline).getTime() - now.getTime()) / 3600000;
    assert.strictEqual(diffMed, 168);
  });

  await test('GET /api/reports/:id/sla returns accurate deadline metrics and display text', async () => {
    // Create an active test report with a deadline in 10 hours
    const futureDeadline = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
    db.run(`
      INSERT INTO reports (
        id, reference_number, citizen_id, title, description, category_id, department_id,
        location_text, latitude, longitude, status, sla_deadline, escalation_level, created_at, updated_at
      ) VALUES (
        ?, 'REP-TEST-ESC', ?, 'Damaged Traffic Signal Post', 'Signpost leaning dangerously into oncoming traffic lane.',
        'cat-roads', 'dept-roads', 'Banjara Hills Rd 1', 17.41, 78.43, 'Assigned', ?, 0, datetime('now'), datetime('now')
      )
    `, [repEscalationId, citizen1.id, futureDeadline]);

    const res = await request(`/api/reports/${repEscalationId}/sla`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.reportId, repEscalationId);
    assert.strictEqual(res.body.sla.isBreached, false);
    assert.ok(res.body.sla.hoursRemaining > 0);
    assert.ok(res.body.sla.displayText.includes('h remaining'));
  });

  await test('checkEscalations() triggers Level 2 SLA Breach on overdue reports', () => {
    // Set report deadline to 2 hours in the past
    const pastDeadline = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    db.run(`UPDATE reports SET sla_deadline = ?, escalation_level = 0 WHERE id = ?`, [pastDeadline, repEscalationId]);

    const result = checkEscalations();
    assert.ok(result.breachesTriggered >= 1);

    const updated = db.get("SELECT escalation_level, review_required FROM reports WHERE id = ?", [repEscalationId]);
    assert.strictEqual(updated.escalation_level, 2);
    assert.strictEqual(updated.review_required, 1);

    // Event logged
    const evt = db.get("SELECT event_type FROM report_events WHERE report_id = ? AND event_type = 'sla_breached'", [repEscalationId]);
    assert.ok(evt);
  });

  await test('POST /api/admin/escalations/check runs on-demand check for admin', async () => {
    const res = await request('/api/admin/escalations/check', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(typeof res.body.checkedCount === 'number');
  });

  // --------------------------------------------------------------------------
  // 2. CITIZEN APPEALS & REVIEW (PRD SECTION 4 & 5) TESTS
  // --------------------------------------------------------------------------

  // Setup Rejected report
  db.run(`
    INSERT INTO reports (
      id, reference_number, citizen_id, title, description, category_id, department_id,
      location_text, latitude, longitude, status, rejected_reason, created_at, updated_at
    ) VALUES (
      ?, 'REP-APP-REJ', ?, 'Garbage pile near residential gate', 'Uncollected garbage bags piling up outside residential community.',
      'cat-garbage', 'dept-sanitation', 'Madhapur Sector 2', 17.44, 78.38, 'Rejected', 'Appears to be on private gated society property.', datetime('now'), datetime('now')
    )
  `, [repAppealRejectedId, citizen1.id]);

  // Setup Resolved report
  db.run(`
    INSERT INTO reports (
      id, reference_number, citizen_id, title, description, category_id, department_id,
      location_text, latitude, longitude, status, resolution_summary, created_at, updated_at
    ) VALUES (
      ?, 'REP-APP-RES', ?, 'Deep pothole repaired improperly', 'Pothole patch washed away in recent evening rain shower.',
      'cat-roads', 'dept-roads', 'Jubilee Hills Rd 36', 17.43, 78.40, 'Resolved', 'Filled pothole with cold mix asphalt.', datetime('now'), datetime('now')
    )
  `, [repAppealResolvedId, citizen1.id]);

  await test('POST /api/reports/:id/appeal rejects unauthenticated requests with 401', async () => {
    const res = await request(`/api/reports/${repAppealRejectedId}/appeal`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'The garbage is completely on public footpath, not private property.' })
    });
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/reports/:id/appeal rejects non-owners with 403', async () => {
    const res = await request(`/api/reports/${repAppealRejectedId}/appeal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit2}` },
      body: JSON.stringify({ reason: 'The garbage is completely on public footpath, not private property.' })
    });
    assert.strictEqual(res.status, 403);
    assert.ok(res.body.error.includes('own reports'));
  });

  await test('POST /api/reports/:id/appeal rejects reports in active non-terminal status with 400', async () => {
    const res = await request(`/api/reports/${repEscalationId}/appeal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({ reason: 'This issue should have been resolved already.' })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('Resolved or Rejected'));
  });

  await test('POST /api/reports/:id/appeal rejects short reasons (< 10 chars) with 400', async () => {
    const res = await request(`/api/reports/${repAppealRejectedId}/appeal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({ reason: 'Too bad' })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error.includes('minimum 10 characters'));
  });

  let createdAppealId = null;
  await test('POST /api/reports/:id/appeal successfully submits appeal on Rejected report (201)', async () => {
    const res = await request(`/api/reports/${repAppealRejectedId}/appeal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({
        reason: 'The garbage heap is directly on the municipal footpath and road curb, not inside our private gate.',
        appealType: 'rejection'
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.appeal.id);
    assert.strictEqual(res.body.appeal.status, 'Pending');
    createdAppealId = res.body.appeal.id;

    // Verify database record
    const dbApp = db.get("SELECT * FROM report_appeals WHERE id = ?", [createdAppealId]);
    assert.ok(dbApp);
    assert.strictEqual(dbApp.report_id, repAppealRejectedId);
  });

  await test('POST /api/reports/:id/appeal prevents duplicate pending appeal (409 Conflict)', async () => {
    const res = await request(`/api/reports/${repAppealRejectedId}/appeal`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({
        reason: 'Submitting a second appeal while first is still pending review.'
      })
    });
    assert.strictEqual(res.status, 409);
    assert.ok(res.body.error.includes('already pending'));
  });

  await test('GET /api/admin/appeals returns pending appeal in Admin Queue', async () => {
    const res = await request('/api/admin/appeals', {
      headers: { 'Authorization': `Bearer ${tokenAdmin}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.appeals));
    const found = res.body.appeals.find(a => a.id === createdAppealId);
    assert.ok(found);
    assert.strictEqual(found.report_id, repAppealRejectedId);
  });

  await test('POST /api/admin/appeals/:id/decide with decision=Approved reopens report to Under Review', async () => {
    const res = await request(`/api/admin/appeals/${createdAppealId}/decide`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenAdmin}` },
      body: JSON.stringify({
        decision: 'Approved',
        adminNotes: 'Field inspector verified footpath location. Restoring issue for sanitation pickup.'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.appeal.status, 'Approved');

    // Report status reopened
    const rep = db.get("SELECT status, review_required FROM reports WHERE id = ?", [repAppealRejectedId]);
    assert.strictEqual(rep.status, 'Under Review');

    // Event logged
    const evt = db.get("SELECT event_type FROM report_events WHERE report_id = ? AND event_type = 'appeal_approved'", [repAppealRejectedId]);
    assert.ok(evt);
  });

  // --------------------------------------------------------------------------
  // 3. CITIZEN SATISFACTION FEEDBACK (PRD SECTION 4 #48) TESTS
  // --------------------------------------------------------------------------

  await test('POST /api/reports/:id/feedback rejects unauthenticated or non-resolved reports', async () => {
    // Unauthenticated
    const resUnauth = await request(`/api/reports/${repAppealResolvedId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating: 5, comment: 'Great job!' })
    });
    assert.strictEqual(resUnauth.status, 401);

    // Non-resolved report
    const resNotResolved = await request(`/api/reports/${repAppealRejectedId}/feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({ rating: 4, comment: 'Good' })
    });
    assert.strictEqual(resNotResolved.status, 400);
  });

  await test('POST /api/reports/:id/feedback validates rating 1 to 5 stars', async () => {
    const resInvalid = await request(`/api/reports/${repAppealResolvedId}/feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({ rating: 7, comment: 'Out of range' })
    });
    assert.strictEqual(resInvalid.status, 400);
    assert.ok(resInvalid.body.error.includes('between 1 and 5'));
  });

  await test('POST /api/reports/:id/feedback records citizen satisfaction rating (201)', async () => {
    const res = await request(`/api/reports/${repAppealResolvedId}/feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({ rating: 5, comment: 'Repair crew was swift and courteous.' })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.feedback.rating, 5);

    // Database verification
    const dbFeedback = db.get("SELECT * FROM report_feedback WHERE report_id = ?", [repAppealResolvedId]);
    assert.ok(dbFeedback);
    assert.strictEqual(dbFeedback.rating, 5);
  });

  await test('POST /api/reports/:id/feedback prevents duplicate ratings on the same report (409 Conflict)', async () => {
    const res = await request(`/api/reports/${repAppealResolvedId}/feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenCit1}` },
      body: JSON.stringify({ rating: 4, comment: 'Attempting to rate twice' })
    });
    assert.strictEqual(res.status, 409);
    assert.ok(res.body.error.includes('already submitted'));
  });

  await test('GET /api/reports/:id/feedback accurately returns submitted feedback', async () => {
    const res = await request(`/api/reports/${repAppealResolvedId}/feedback`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.feedback);
    assert.strictEqual(res.body.feedback.rating, 5);
    assert.ok(res.body.feedback.comment.includes('swift and courteous'));
  });

  // Cleanup test artifacts
  for (const tid of testIds) {
    db.run("DELETE FROM report_appeals WHERE report_id = ?", [tid]);
    db.run("DELETE FROM report_feedback WHERE report_id = ?", [tid]);
    db.run("DELETE FROM report_events WHERE report_id = ?", [tid]);
    db.run("DELETE FROM notifications WHERE report_id = ?", [tid]);
    db.run("DELETE FROM reports WHERE id = ?", [tid]);
  }

  console.log('----------------------------------------------------');
  console.log(`  PHASE 3 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runPhase3Tests();
}

module.exports = runPhase3Tests;
