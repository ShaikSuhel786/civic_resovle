/**
 * Civic Resolve AI: Citizen to Field Staff Portal Integration Test Suite
 * Validates the complete flow from citizen report submission through category-department mapping,
 * staff department inbox visibility, secure claim concurrency, and field execution.
 *
 * Verifies 10 Core Functional Requirements:
 * 1. Citizen submits a valid report.
 * 2. Selected category produces the correct department mapping.
 * 3. Report appears in that department's staff inbox before individual assignment.
 * 4. Staff member from another department cannot see or claim that report.
 * 5. Correctly matched staff member successfully claims it.
 * 6. Second staff member cannot claim an already claimed report (409 Conflict).
 * 7. Unauthorized citizen cannot use the staff claim endpoint (403 Forbidden).
 * 8. Existing report status transitions and authorization continue to work.
 * 9. Missing or invalid department mappings are handled safely (no leak, routes to admin review).
 * 10. Report and assignment changes appear correctly after a fresh API request.
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../server/index.js');
const db = require('../server/db/index.js');
const { JWT_SECRET } = require('../server/middleware/auth.js');

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, department_id: user.department_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

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
      'accept': 'application/json,text/html,*/*',
      ...(options.headers || {})
    };
    for (const [k, v] of Object.entries(options.headers || {})) {
      reqStream.headers[k.toLowerCase()] = v;
    }
    if (options.body && !reqStream.headers['content-type']) {
      reqStream.headers['content-type'] = 'application/json';
      reqStream.headers['content-length'] = Buffer.byteLength(options.body).toString();
    }

    const res = new ServerResponse(reqStream);
    let chunks = [];
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

    try {
      app.handle(reqStream, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function runStaffIntegrationSuite() {
  console.log('\n======================================================');
  console.log('  CIVIC RESOLVE AI — STAFF INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    process.stdout.write(`Test ${total}: ${name}... `);
    try {
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (e) {
      console.log('FAILED ✗');
      console.error(e.message);
      if (e.stack) console.error(e.stack);
      process.exit(1);
    }
  }

  // Load profiles from database
  const citizen = db.get("SELECT * FROM profiles WHERE id = 'usr-citizen-01'");
  const roadsStaff1 = db.get("SELECT * FROM profiles WHERE id = 'usr-staff-roads'");
  const waterStaff = db.get("SELECT * FROM profiles WHERE id = 'usr-staff-water'");
  const electricalStaff = db.get("SELECT * FROM profiles WHERE id = 'usr-staff-electrical'");
  const adminProfile = db.get("SELECT * FROM profiles WHERE role = 'admin' LIMIT 1");

  assert.ok(citizen, 'Citizen profile must exist');
  assert.ok(roadsStaff1, 'Roads staff profile must exist');
  assert.ok(waterStaff, 'Water staff profile must exist');

  // Create a second roads staff profile for concurrency/conflict testing
  let roadsStaff2 = db.get("SELECT * FROM profiles WHERE id = 'usr-staff-roads-2'");
  if (!roadsStaff2) {
    db.run(`
      INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash, created_at)
      VALUES ('usr-staff-roads-2', 'roads2@civicsync.demo', 'Ramesh Chandra (Roads Staff 2)', 'staff', 'dept-roads', 1, 'en', '$2b$10$7h7VUFK/wxhDGBjnbZl.8Ou5LOPIi9OVjO17q/cED5aXFNP6FUQ/S', datetime('now'))
    `);
    roadsStaff2 = db.get("SELECT * FROM profiles WHERE id = 'usr-staff-roads-2'");
  }

  const citizenToken = makeToken(citizen);
  const roadsStaff1Token = makeToken(roadsStaff1);
  const roadsStaff2Token = makeToken(roadsStaff2);
  const waterStaffToken = makeToken(waterStaff);
  const adminToken = makeToken(adminProfile);

  let submittedReportId = null;
  let submittedRefNumber = null;

  // 1. Citizen submits a valid report
  await test('Citizen submitting a valid report produces a 201 response with unassigned state', async () => {
    const res = await request('/api/reports', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` },
      body: JSON.stringify({
        title: 'Dangerous Pothole on Srinagar Colony Main Road',
        description: 'Large deep pothole on Srinagar Colony Main Road causing hazards to vehicles and pedestrians.',
        categoryId: 'cat-roads',
        locationText: 'Srinagar Colony Main Road, Hyderabad',
        latitude: 17.4300,
        longitude: 78.4400
      })
    });

    assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);
    assert.ok(res.json.report, 'Response should contain report');
    assert.strictEqual(res.json.report.status, 'Submitted', 'Initial status must be Submitted');
    assert.strictEqual(res.json.report.assigned_staff_id, null, 'Must not be automatically assigned to staff');

    submittedReportId = res.json.report.id;
    submittedRefNumber = res.json.report.reference_number;
  });

  // 2. Selected category producing the correct department mapping
  await test('Selected category correctly resolves and maps to the corresponding department', async () => {
    const report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.ok(report, 'Report must exist in database');
    assert.strictEqual(report.category_id, 'cat-roads', 'Category ID must match selected category');
    assert.strictEqual(report.department_id, 'dept-roads', 'Department ID must resolve to dept-roads');

    // Also test streetlights category mapping to electrical department
    const elecRes = await request('/api/reports', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` },
      body: JSON.stringify({
        title: 'Dark Streetlights Near Community Park',
        description: 'Streetlights have been completely unlit for the past week near the children community park.',
        categoryId: 'cat-streetlights',
        locationText: 'Park Street, Hyderabad',
        latitude: 17.4350,
        longitude: 78.4450
      })
    });
    assert.strictEqual(elecRes.status, 201);
    const elecReport = db.get('SELECT * FROM reports WHERE id = ?', [elecRes.json.report.id]);
    assert.strictEqual(elecReport.category_id, 'cat-streetlights');
    assert.strictEqual(elecReport.department_id, 'dept-electrical', 'Streetlights must map to dept-electrical');

    // Clean up temporary electrical report
    db.run('DELETE FROM report_events WHERE report_id = ?', [elecRes.json.report.id]);
    db.run('DELETE FROM reports WHERE id = ?', [elecRes.json.report.id]);
  });

  // 3. Report appears in that department's staff inbox before individual assignment
  await test('Report appears in that department staff inbox as unassigned/claimable before assignment', async () => {
    const res = await request('/api/staff/reports', {
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` }
    });

    assert.strictEqual(res.status, 200, `Expected status 200, got ${res.status}`);
    assert.ok(Array.isArray(res.json.reports), 'Reports must be an array');

    const matched = res.json.reports.find(r => r.id === submittedReportId);
    assert.ok(matched, 'Submitted roads report must be visible in Roads staff queue');
    assert.strictEqual(matched.is_claimable, 1, 'Report must be flagged as claimable');
    assert.strictEqual(matched.is_assigned_to_me, 0, 'Report must not be marked as assigned to me yet');
    assert.strictEqual(matched.assigned_staff_id, null, 'Staff ID must be null');

    // Check availableReports structure
    assert.ok(Array.isArray(res.json.availableReports), 'availableReports must be returned');
    assert.ok(res.json.availableReports.some(r => r.id === submittedReportId), 'Must be in availableReports');
  });

  // 4. Staff member from another department being unable to see or claim that report
  await test('Staff member from another department cannot see or claim that report (403)', async () => {
    // Water staff queries their inbox
    const waterInbox = await request('/api/staff/reports', {
      headers: { 'Authorization': `Bearer ${waterStaffToken}` }
    });
    assert.strictEqual(waterInbox.status, 200);
    const leaked = waterInbox.json.reports.find(r => r.id === submittedReportId);
    assert.strictEqual(leaked, undefined, 'Roads report MUST NOT appear in Water staff inbox');

    // Water staff attempts to claim the Roads report
    const claimRes = await request(`/api/staff/reports/${submittedReportId}/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${waterStaffToken}` }
    });
    assert.strictEqual(claimRes.status, 403, 'Must reject cross-department claim with 403 Forbidden');
    assert.ok(claimRes.json.error.includes('Security boundary violation'), 'Error should specify security boundary');

    // Verify report remains unchanged in database
    const report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.strictEqual(report.assigned_staff_id, null, 'Must still be unassigned in database');
    assert.strictEqual(report.status, 'Submitted', 'Must still be Submitted in database');
  });

  // 5. Correctly matched staff member successfully claiming it
  await test('Correctly matched staff member successfully claims the report', async () => {
    const claimRes = await request(`/api/staff/reports/${submittedReportId}/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` }
    });

    assert.strictEqual(claimRes.status, 200, `Expected 200, got ${claimRes.status}`);
    assert.strictEqual(claimRes.json.success, true);
    assert.strictEqual(claimRes.json.report.assigned_staff_id, roadsStaff1.id);
    assert.strictEqual(claimRes.json.report.status, 'Assigned');

    // Verify database state
    const report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.strictEqual(report.assigned_staff_id, roadsStaff1.id);
    assert.strictEqual(report.status, 'Assigned');

    // Verify assignments record
    const assignment = db.get('SELECT * FROM assignments WHERE report_id = ? AND active = 1', [submittedReportId]);
    assert.ok(assignment, 'Active assignment record must exist');
    assert.strictEqual(assignment.staff_id, roadsStaff1.id);
    assert.strictEqual(assignment.assigned_by, roadsStaff1.id);

    // Verify timeline event
    const event = db.get("SELECT * FROM report_events WHERE report_id = ? AND event_type = 'assigned'", [submittedReportId]);
    assert.ok(event, 'Assigned timeline event must exist');
    assert.strictEqual(event.actor_id, roadsStaff1.id);

    // Verify notification
    const notification = db.get('SELECT * FROM notifications WHERE report_id = ? AND recipient_id = ?', [submittedReportId, citizen.id]);
    assert.ok(notification, 'Citizen must receive assignment notification');
  });

  // 6. Second staff member being unable to claim an already claimed report (409 Conflict)
  await test('Second staff member cannot claim an already claimed report (409 Conflict)', async () => {
    const claimRes2 = await request(`/api/staff/reports/${submittedReportId}/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${roadsStaff2Token}` }
    });

    assert.strictEqual(claimRes2.status, 409, `Expected 409 Conflict, got ${claimRes2.status}`);
    assert.ok(claimRes2.json.error.includes('already been claimed'), 'Error message should indicate conflict');

    // Verify assignment was NOT overwritten
    const report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.strictEqual(report.assigned_staff_id, roadsStaff1.id, 'Report must remain assigned to original claimant');
  });

  // 7. Unauthorized citizen being unable to use the staff claim endpoint
  await test('Unauthorized citizen or anonymous caller cannot use staff claim endpoint (403/401)', async () => {
    // Citizen attempts claim
    const citizenClaim = await request(`/api/staff/reports/${submittedReportId}/claim`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    assert.strictEqual(citizenClaim.status, 403, 'Citizen must receive 403 Forbidden on staff claim endpoint');

    // Unauthenticated attempt
    const anonClaim = await request(`/api/staff/reports/${submittedReportId}/claim`, {
      method: 'POST'
    });
    assert.strictEqual(anonClaim.status, 401, 'Anonymous caller must receive 401 Unauthorized');
  });

  // 8. Existing report status transitions and authorization continuing to work
  await test('Existing report status transitions and authorization continue to work as expected', async () => {
    // Roads staff 1 starts work -> In Progress
    const inProgressRes = await request(`/api/staff/reports/${submittedReportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` },
      body: JSON.stringify({ newStatus: 'In Progress' })
    });
    assert.strictEqual(inProgressRes.status, 200);

    let report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.strictEqual(report.status, 'In Progress');

    // Roads staff 1 marks as Blocked with required reason
    const blockedRes = await request(`/api/staff/reports/${submittedReportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` },
      body: JSON.stringify({
        newStatus: 'Blocked',
        reason: 'Heavy rain delay preventing hot asphalt application'
      })
    });
    assert.strictEqual(blockedRes.status, 200);

    report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.strictEqual(report.status, 'Blocked');
    assert.strictEqual(report.blocked_reason, 'Heavy rain delay preventing hot asphalt application');

    // Non-assigned staff cannot modify this report
    const unauthorizedRes = await request(`/api/staff/reports/${submittedReportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${roadsStaff2Token}` },
      body: JSON.stringify({ newStatus: 'In Progress' })
    });
    assert.strictEqual(unauthorizedRes.status, 403, 'Other staff must be rejected with 403');

    // Unblock back to In Progress
    const unblockRes = await request(`/api/staff/reports/${submittedReportId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` },
      body: JSON.stringify({ newStatus: 'In Progress' })
    });
    assert.strictEqual(unblockRes.status, 200);

    report = db.get('SELECT * FROM reports WHERE id = ?', [submittedReportId]);
    assert.strictEqual(report.status, 'In Progress');
    assert.strictEqual(report.blocked_reason, null);
  });

  // 9. Missing or invalid department mappings being handled safely
  await test('Missing or invalid department mappings are handled safely without leaking to staff queues', async () => {
    // Submit with an invalid category ID
    const invalidCatRes = await request('/api/reports', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` },
      body: JSON.stringify({
        title: 'Strange Issue With Nonexistent Category',
        description: 'Citizen submitted an issue specifying a non-existent category identifier in the payload.',
        categoryId: 'cat-nonexistent-99999',
        locationText: 'Some Unknown Location, Hyderabad',
        latitude: 17.4000,
        longitude: 78.4500
      })
    });
    assert.strictEqual(invalidCatRes.status, 201, 'Should create report rather than crash with FK violation');

    const unmappedReport = db.get('SELECT * FROM reports WHERE id = ?', [invalidCatRes.json.report.id]);
    assert.ok(unmappedReport, 'Unmapped report must exist in database');
    assert.strictEqual(unmappedReport.department_id, null, 'Department ID must be null for unmapped category');
    assert.strictEqual(unmappedReport.review_required, 1, 'Must flag review_required for administrator');

    // Ensure it does NOT leak into any department staff queue
    const roadsInbox = await request('/api/staff/reports', {
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` }
    });
    assert.strictEqual(roadsInbox.json.reports.some(r => r.id === unmappedReport.id), false, 'Must not leak into Roads inbox');

    const waterInbox = await request('/api/staff/reports', {
      headers: { 'Authorization': `Bearer ${waterStaffToken}` }
    });
    assert.strictEqual(waterInbox.json.reports.some(r => r.id === unmappedReport.id), false, 'Must not leak into Water inbox');

    // Verify it appears in Admin Review Queue
    const adminQueues = await request('/api/admin/queues', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminQueues.status, 200);
    const inReview = adminQueues.json.reviewQueue.find(r => r.id === unmappedReport.id);
    assert.ok(inReview, 'Unmapped report MUST appear in Admin review queue for manual routing');

    // Clean up temporary unmapped report
    db.run('DELETE FROM report_events WHERE report_id = ?', [unmappedReport.id]);
    db.run('DELETE FROM reports WHERE id = ?', [unmappedReport.id]);
  });

  // 10. Report and assignment changes appearing correctly after a fresh API request
  await test('Report and assignment changes appear correctly after fresh API requests', async () => {
    // Roads staff 1 fetches their queue
    const freshRes = await request('/api/staff/reports', {
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` }
    });
    assert.strictEqual(freshRes.status, 200);

    // It must appear in assignedReports with current status
    const assignedItem = freshRes.json.assignedReports.find(r => r.id === submittedReportId);
    assert.ok(assignedItem, 'Claimed report must be in assignedReports');
    assert.strictEqual(assignedItem.status, 'In Progress');
    assert.strictEqual(assignedItem.is_assigned_to_me, 1);
    assert.strictEqual(assignedItem.is_claimable, 0);

    // It must NOT appear in availableReports anymore
    const availableItem = freshRes.json.availableReports.find(r => r.id === submittedReportId);
    assert.strictEqual(availableItem, undefined, 'Claimed report must not be in availableReports');

    // Detailed report API check
    const detailRes = await request(`/api/reports/${submittedReportId}`, {
      headers: { 'Authorization': `Bearer ${roadsStaff1Token}` }
    });
    assert.strictEqual(detailRes.status, 200);
    assert.strictEqual(detailRes.json.report.status, 'In Progress');
    assert.strictEqual(detailRes.json.report.assigned_staff_id, roadsStaff1.id);
    assert.ok(detailRes.json.timeline.some(e => e.event_type === 'assigned'), 'Timeline must show assigned event');
  });

  // Clean up main test report
  db.run('DELETE FROM notifications WHERE report_id = ?', [submittedReportId]);
  db.run('DELETE FROM report_events WHERE report_id = ?', [submittedReportId]);
  db.run('DELETE FROM assignments WHERE report_id = ?', [submittedReportId]);
  db.run('DELETE FROM reports WHERE id = ?', [submittedReportId]);

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passed}/${total} STAFF INTEGRATION TESTS PASSED!`);
  console.log('======================================================\n');
}

runStaffIntegrationSuite().catch(err => {
  console.error('Test suite execution failure:', err);
  process.exit(1);
});

