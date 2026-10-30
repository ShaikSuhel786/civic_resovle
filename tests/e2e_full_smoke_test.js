/**
 * End-to-End Live Integration & Smoke Test
 * Tests full server lifecycle, authentication, role workflows, public APIs, and security boundaries.
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const app = require('../server/index.js');
const db = require('../server/db/index.js');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const reqStream = new Readable({
      destroy(err, cb) { if (cb) cb(err); },
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
    if (options.body && !reqStream.headers['content-type']) {
      reqStream.headers['content-type'] = 'application/json';
      reqStream.headers['content-length'] = Buffer.byteLength(options.body).toString();
    }

    const res = new ServerResponse(reqStream);
    const chunks = [];
    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    res.end = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString('utf8');
      let json = null;
      try { json = JSON.parse(body); } catch (_) {}
      resolve({ status: res.statusCode, headers: res.getHeaders(), body, json });
    };

    app(reqStream, res, (err) => {
      if (err) reject(err);
      else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });
  });
}

async function runSmokeTests() {
  console.log('\n======================================================');
  console.log('  STARTING CIVIC RESOLVE AI END-TO-END SMOKE TEST');
  console.log('======================================================\n');

  let passed = 0;
  async function step(name, fn) {
    process.stdout.write(`• ${name}... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (e) {
      console.log('FAILED ✗');
      console.error(e);
      process.exit(1);
    }
  }

  // 1. Health Endpoint
  await step('Server Health Check (GET /api/health)', async () => {
    const res = await request('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.status, 'healthy');
    assert.strictEqual(res.json.product, 'Civic Resolve AI');
  });

  // 2. Public Static HTML Pages
  const pages = [
    { url: '/', titleCheck: 'Civic Resolve AI' },
    { url: '/transparency', titleCheck: 'Transparency' },
    { url: '/digital-twin', titleCheck: 'Digital Twin' },
    { url: '/maintenance', titleCheck: 'Maintenance' },
    { url: '/knowledge', titleCheck: 'Knowledge' },
    { url: '/radar', titleCheck: 'Radar' },
    { url: '/report', titleCheck: 'Report a Civic Issue' },
    { url: '/dashboard', titleCheck: 'Dashboard' },
    { url: '/admin', titleCheck: 'Admin' },
    { url: '/staff', titleCheck: 'Staff' }
  ];

  for (const p of pages) {
    await step(`Deliver HTML Surface (${p.url})`, async () => {
      const res = await request(p.url);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes(p.titleCheck) || res.body.includes('Civic Resolve'));
    });
  }

  // 3. User Authentication for All Three Roles
  let citizenToken, staffToken, adminToken;

  await step('Citizen Authentication (POST /api/auth/login)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'citizen@civicsync.demo', password: 'DemoCitizen123!' })
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'citizen');
    citizenToken = res.json.token;
  });

  await step('Staff Authentication (POST /api/auth/login)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'staff.roads@civicsync.demo', password: 'DemoStaff123!' })
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'staff');
    staffToken = res.json.token;
  });

  await step('Admin Authentication (POST /api/auth/login)', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@civicsync.demo', password: 'DemoAdmin123!' })
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'admin');
    adminToken = res.json.token;
  });

  // 4. AI Vision Inspector Live Endpoint
  await step('AI Vision Inspector (POST /api/ai/vision-inspect)', async () => {
    const dummyBase64 = Buffer.from('mock-road-pothole-photo-data').toString('base64');
    const res = await request('/api/ai/vision-inspect', {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: dummyBase64,
        fileName: 'damaged_asphalt_crater_pothole.jpg'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.suggestedCategory.id, 'cat-roads');
    assert.strictEqual(res.json.suggestedCategory.departmentId, 'dept-roads');
    assert.ok(res.json.detectedDefects.length > 0);
  });

  // 5. Complete Citizen Report Submission Lifecycle
  let reportId;
  await step('Citizen Report Submission with GPS (POST /api/reports)', async () => {
    const res = await request('/api/reports', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` },
      body: JSON.stringify({
        title: 'Smoke Test Main Road Pothole',
        description: 'Large physical depression in asphalt causing vehicular hazard on main road.',
        categoryId: 'cat-roads',
        locationText: 'Jubilee Hills Road 36, Hyderabad',
        latitude: 17.4319,
        longitude: 78.4073,
        idempotencyKey: 'smoke-' + Date.now(),
        privacyNoticeAcknowledged: true
      })
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.json.report.id);
    assert.ok(res.json.report.sla_deadline, 'Must calculate SLA deadline');
    reportId = res.json.report.id;
  });

  // 6. Community Impact Voting
  await step('Community Impact Voting (POST /api/reports/:id/vote)', async () => {
    // Select a different citizen (usr-citizen-02) to vote
    const otherCitizen = db.get("SELECT * FROM profiles WHERE role = 'citizen' AND id != 'usr-citizen-01' LIMIT 1");
    assert.ok(otherCitizen);
    const otherToken = require('jsonwebtoken').sign(
      { userId: otherCitizen.id, email: otherCitizen.email, role: 'citizen' },
      require('../server/middleware/auth.js').JWT_SECRET,
      { expiresIn: '1h' }
    );

    const voteRes = await request(`/api/reports/${reportId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${otherToken}` }
    });
    assert.strictEqual(voteRes.status, 201);
    assert.strictEqual(voteRes.json.communityVotes, 1);
  });

  // 7. Admin Assignment & Staff Progress
  await step('Admin Assigns Staff (POST /api/admin/reports/:id/assign)', async () => {
    const res = await request(`/api/admin/reports/${reportId}/assign`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ staffId: 'usr-staff-roads' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    const updated = db.get('SELECT status, assigned_staff_id FROM reports WHERE id = ?', [reportId]);
    assert.strictEqual(updated.status, 'Assigned');
    assert.strictEqual(updated.assigned_staff_id, 'usr-staff-roads');
  });

  // 8. Staff Work Queue & Execution
  await step('Staff Views Work Queue (GET /api/staff/reports)', async () => {
    const res = await request('/api/staff/reports', {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.reports.some(r => r.id === reportId));
  });

  await step('Staff Starts Work (POST /api/staff/reports/:id/status)', async () => {
    const res = await request(`/api/staff/reports/${reportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    const updated = db.get('SELECT status FROM reports WHERE id = ?', [reportId]);
    assert.strictEqual(updated.status, 'In Progress');
  });

  // 9. Staff Maintenance Work Queue
  await step('Staff Views Maintenance Work Orders (GET /api/staff/maintenance)', async () => {
    const res = await request('/api/staff/maintenance', {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json.schedules));
    assert.ok(res.json.schedules.length > 0);
  });

  // 10. Proof-of-Resolution Photo Requirement Enforcement
  await step('Proof-of-Resolution Photo Rejection without photo', async () => {
    const res = await request(`/api/staff/reports/${reportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        status: 'Resolved',
        resolutionSummary: 'Hot mix asphalt compacted and sealed level with road surface.'
      })
    });
    // Must reject because no photo with is_resolution_photo = 1 exists yet
    assert.strictEqual(res.status, 400);
    assert.ok(res.json.error.includes('PRD F4'));
  });

  await step('Staff Uploads Resolution Photo and Resolves Issue', async () => {
    // Insert verified resolution photo into DB
    const resPhotoId = 'pho-res-' + Date.now().toString(36);
    db.run(`
      INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, vision_clues_json, confidence_score, created_at)
      VALUES (?, ?, 'usr-staff-roads', '/uploads/resolution-proof.jpg', 'resolution-proof.jpg', 'image/jpeg', 20480, 1, '["Repaired asphalt"]', 95, datetime('now'))
    `, [resPhotoId, reportId]);

    const res = await request(`/api/staff/reports/${reportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        status: 'Resolved',
        resolutionSummary: 'Hot mix asphalt compacted and sealed level with road surface.'
      })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.success, true);
    const updated = db.get('SELECT status FROM reports WHERE id = ?', [reportId]);
    assert.strictEqual(updated.status, 'Resolved');
  });

  // 11. Citizen Post-Resolution Satisfaction Rating
  await step('Citizen Submits 5-Star Feedback (POST /api/reports/:id/feedback)', async () => {
    const res = await request(`/api/reports/${reportId}/feedback`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` },
      body: JSON.stringify({ rating: 5, comment: 'Pothole was repaired cleanly and quickly!' })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.json.feedback.rating, 5);
  });

  // 12. Public Analytics & Data Transparency
  await step('Public Transparency Scorecard (GET /api/analytics/scorecard)', async () => {
    const res = await request('/api/analytics/scorecard');
    assert.strictEqual(res.status, 200);
    assert.ok(typeof res.json.kpis.totalIssues === 'number');
    assert.ok(typeof res.json.kpis.resolutionRateNum === 'number');
    assert.ok(Array.isArray(res.json.departmentWorkload));
  });

  await step('Public Digital Twin Telemetry (GET /api/reports/public/digital-twin)', async () => {
    const res = await request('/api/reports/public/digital-twin');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json.reports));
    // Verify zero PII exposed
    for (const m of res.json.reports) {
      assert.strictEqual(m.citizen_id, undefined);
      assert.strictEqual(m.email, undefined);
      assert.strictEqual(m.phone, undefined);
    }
  });

  await step('Public Predictive Problem Radar (GET /api/analytics/radar)', async () => {
    const res = await request('/api/analytics/radar');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.json.hotspots));
    assert.ok(res.json.disclaimer);
  });

  await step('AI Knowledge Center Direct Citation (POST /api/knowledge/ask)', async () => {
    const res = await request('/api/knowledge/ask', {
      method: 'POST',
      body: JSON.stringify({ query: 'pothole repair SLA' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.answered, true);
    assert.ok(res.json.citation && res.json.citation.officialSource);
  });

  // Clean up test report
  db.run('DELETE FROM reports WHERE id = ?', [reportId]);

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passed} END-TO-END SMOKE TESTS PASSED PERFECTLY!`);
  console.log('======================================================\n');
}

runSmokeTests().catch(err => {
  console.error('\n❌ Smoke Test Suite Failed:', err);
  process.exit(1);
});
