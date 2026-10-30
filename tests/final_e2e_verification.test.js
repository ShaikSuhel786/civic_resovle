/**
 * Civic Resolve AI — Final End-to-End Scenario Verification Test
 * 
 * Verifies the 12-step end-to-end flow:
 * 1. Authenticate as citizen.
 * 2. Submit civic complaint with valid category and location.
 * 3. Verify persistence in configured database.
 * 4. Verify department matches category-routing rules.
 * 5. Authenticate as field staff in that department.
 * 6. Verify report appears in department inbox without manual admin assignment.
 * 7. Claim the report.
 * 8. Verify second staff member cannot claim it (409 Conflict).
 * 9. Start work, record status update, verify timeline event & citizen notification.
 * 10. Sign in as citizen again, verify report and status update.
 * 11. Repeat access checks with staff from another department (403 Forbidden).
 * 12. Restart/recreate application instance, verify persistence remains available.
 */

const http = require('http');
const assert = require('assert');
const bcrypt = require('bcryptjs');

function makeRequest(app, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const payload = body ? JSON.stringify(body) : null;
      const reqHeaders = { ...headers };
      if (payload) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(payload);
      }

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          server.close(() => {
            let json = null;
            try {
              json = JSON.parse(data);
            } catch (_) {}
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: json,
              raw: data
            });
          });
        });
      });

      req.on('error', (err) => {
        server.close(() => reject(err));
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  });
}

async function runEndToEndScenario() {
  console.log('\n======================================================');
  console.log('  CIVIC RESOLVE AI — FINAL END-TO-END VERIFICATION');
  console.log('======================================================\n');

  let db = require('../server/db');
  let app = require('../server');

  let citizenToken = null;
  let citizenUser = null;
  let submittedReport = null;
  let roadsStaffToken = null;
  let roadsStaff2Token = null;
  let sanitationStaffToken = null;

  // Setup: Ensure a second roads staff member exists for concurrency testing
  const staffHash = bcrypt.hashSync('DemoStaff123!', 10);
  await db.run(`
    INSERT INTO profiles (id, email, password_hash, display_name, role, department_id, active, preferred_language)
    VALUES (?, ?, ?, ?, ?, ?, 1, 'en')
    ON CONFLICT (id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash, department_id = excluded.department_id, active = 1
  `, [
    'usr-staff-roads-2',
    'roads2@civicsync.demo',
    staffHash,
    'Rajesh Kumar (Roads Staff 2)',
    'staff',
    'dept-roads'
  ]);

  // Step 1: Authenticate as citizen
  console.log('Step 1: Authenticating as citizen...');
  const citizenLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'citizen@civicsync.demo',
    password: 'DemoCitizen123!'
  });
  assert.strictEqual(citizenLoginRes.status, 200, `Citizen login failed: ${JSON.stringify(citizenLoginRes.body)}`);
  assert.ok(citizenLoginRes.body.token, 'Expected JWT token for citizen');
  assert.strictEqual(citizenLoginRes.body.user.role, 'citizen');
  citizenToken = citizenLoginRes.body.token;
  citizenUser = citizenLoginRes.body.user;
  console.log(`  ✓ Authenticated as ${citizenUser.displayName} (${citizenUser.id})`);

  // Step 2: Submit a civic complaint with valid category and location
  console.log('\nStep 2: Submitting civic complaint with valid category and location...');
  const testIdempotencyKey = 'e2e-test-key-' + Date.now();
  const submissionRes = await makeRequest(app, 'POST', '/api/reports', {
    'Authorization': `Bearer ${citizenToken}`
  }, {
    title: 'Severe Pothole on Banjara Hills Main Road',
    description: 'Deep road depression causing traffic bottleneck and accident risk near intersection.',
    categoryId: 'cat-roads',
    locationText: 'Road No. 12, Banjara Hills, Hyderabad',
    latitude: 17.4156,
    longitude: 78.4350,
    idempotencyKey: testIdempotencyKey,
    privacyNoticeAcknowledged: true
  });
  assert.strictEqual(submissionRes.status, 201, `Submission failed: ${JSON.stringify(submissionRes.body)}`);
  assert.ok(submissionRes.body.report, 'Expected created report in response');
  submittedReport = submissionRes.body.report;
  assert.strictEqual(submittedReport.status, 'Submitted', 'Initial status should be Submitted');
  assert.strictEqual(submittedReport.assigned_staff_id, null, 'Initial report must be unassigned');
  console.log(`  ✓ Report submitted: ${submittedReport.reference_number} (ID: ${submittedReport.id})`);

  // Step 3: Verify that it is persisted in the configured durable database
  console.log('\nStep 3: Verifying report persistence directly in durable database...');
  const dbReport = await db.get('SELECT * FROM reports WHERE id = ?', [submittedReport.id]);
  assert.ok(dbReport, 'Report record must exist in durable database');
  assert.strictEqual(dbReport.id, submittedReport.id);
  assert.strictEqual(dbReport.citizen_id, citizenUser.id);
  assert.strictEqual(dbReport.reference_number, submittedReport.reference_number);
  assert.strictEqual(dbReport.status, 'Submitted');
  assert.strictEqual(dbReport.assigned_staff_id, null);
  console.log(`  ✓ Direct DB read verified: Report ${dbReport.id} is stored with status ${dbReport.status}`);

  // Step 4: Verify that its department matches the category-routing rules
  console.log('\nStep 4: Verifying department routing matches category rules...');
  const categoryRecord = await db.get('SELECT department_id FROM categories WHERE id = ?', ['cat-roads']);
  assert.ok(categoryRecord, 'Category cat-roads must exist');
  assert.strictEqual(categoryRecord.department_id, 'dept-roads', 'Category cat-roads must map to dept-roads');
  assert.strictEqual(dbReport.department_id, 'dept-roads', 'Report department must match category routing rule (dept-roads)');
  console.log(`  ✓ Department resolved correctly: ${dbReport.department_id} (Roads Department)`);

  // Step 5: Authenticate as field staff in that department
  console.log('\nStep 5: Authenticating as Roads field staff...');
  const staffLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'staff.roads@civicsync.demo',
    password: 'DemoStaff123!'
  });
  assert.strictEqual(staffLoginRes.status, 200, `Staff login failed: ${JSON.stringify(staffLoginRes.body)}`);
  assert.strictEqual(staffLoginRes.body.user.role, 'staff');
  assert.strictEqual(staffLoginRes.body.user.departmentId, 'dept-roads');
  roadsStaffToken = staffLoginRes.body.token;
  console.log(`  ✓ Authenticated as ${staffLoginRes.body.user.displayName} (dept-roads)`);

  // Step 6: Verify report appears in department inbox without requiring admin assignment
  console.log('\nStep 6: Verifying report appears in department inbox as claimable...');
  const staffReportsRes = await makeRequest(app, 'GET', '/api/staff/reports', {
    'Authorization': `Bearer ${roadsStaffToken}`
  });
  assert.strictEqual(staffReportsRes.status, 200, 'GET /api/staff/reports should succeed');
  const availableReports = staffReportsRes.body.availableReports || [];
  const foundInAvailable = availableReports.find(r => r.id === submittedReport.id);
  assert.ok(foundInAvailable, `Report ${submittedReport.id} should appear in department availableReports without manual assignment`);
  assert.strictEqual(foundInAvailable.is_claimable, 1, 'Report should be marked is_claimable = 1');
  assert.strictEqual(foundInAvailable.assigned_staff_id, null, 'Report should not have assigned_staff_id');
  console.log(`  ✓ Report ${submittedReport.reference_number} is visible and claimable in Roads staff queue`);

  // Step 7: Claim the report
  console.log('\nStep 7: Field staff claims the report...');
  const claimRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/claim`, {
    'Authorization': `Bearer ${roadsStaffToken}`
  });
  assert.strictEqual(claimRes.status, 200, `Claim failed: ${JSON.stringify(claimRes.body)}`);
  assert.strictEqual(claimRes.body.success, true);
  assert.strictEqual(claimRes.body.report.status, 'Assigned');
  assert.strictEqual(claimRes.body.report.assigned_staff_id, 'usr-staff-roads');

  // Verify in database
  const claimedDbReport = await db.get('SELECT * FROM reports WHERE id = ?', [submittedReport.id]);
  assert.strictEqual(claimedDbReport.status, 'Assigned');
  assert.strictEqual(claimedDbReport.assigned_staff_id, 'usr-staff-roads');
  console.log(`  ✓ Report successfully claimed by usr-staff-roads; status changed to Assigned`);

  // Step 8: Verify a second staff member cannot claim it (409 Conflict)
  console.log('\nStep 8: Second staff member attempts to claim the same report...');
  const staff2LoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'roads2@civicsync.demo',
    password: 'DemoStaff123!'
  });
  assert.strictEqual(staff2LoginRes.status, 200);
  roadsStaff2Token = staff2LoginRes.body.token;

  const doubleClaimRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/claim`, {
    'Authorization': `Bearer ${roadsStaff2Token}`
  });
  assert.strictEqual(doubleClaimRes.status, 409, `Expected 409 Conflict for double claim, got: ${doubleClaimRes.status}`);
  console.log('  ✓ Double-claim rejected with 409 Conflict');

  // Step 9: Start work, record status update, verify timeline event & notification
  console.log('\nStep 9: Updating status to "In Progress" and verifying timeline & notification...');
  const statusUpdateRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/status`, {
    'Authorization': `Bearer ${roadsStaffToken}`
  }, {
    status: 'In Progress'
  });
  assert.strictEqual(statusUpdateRes.status, 200, `Status update failed: ${JSON.stringify(statusUpdateRes.body)}`);
  assert.strictEqual(statusUpdateRes.body.success, true);

  // Verify in database that report status transitioned to In Progress
  const inProgressReport = await db.get('SELECT * FROM reports WHERE id = ?', [submittedReport.id]);
  assert.strictEqual(inProgressReport.status, 'In Progress', 'Report status must transition to In Progress');

  // Verify timeline event in report_events
  const timelineEvents = await db.all('SELECT * FROM report_events WHERE report_id = ? ORDER BY created_at ASC', [submittedReport.id]);
  const progressEvent = timelineEvents.find(e => (e.event_type === 'status_changed' || e.event_type === 'Status Change') && ((e.message || '') + (e.description || '')).includes('In Progress'));
  assert.ok(progressEvent, 'Expected timeline event for In Progress transition');
  console.log(`  ✓ Timeline event recorded: "${progressEvent.event_type}: ${progressEvent.message || progressEvent.description}"`);

  // Verify notification created for citizen
  const notifications = await db.all('SELECT * FROM notifications WHERE report_id = ? AND recipient_id = ?', [submittedReport.id, citizenUser.id]);
  assert.ok(notifications.length > 0, 'Expected notification created for citizen');
  console.log(`  ✓ Notification generated for citizen: "${notifications[notifications.length - 1].title}"`);

  // Step 10: Sign in as citizen again and verify report and status update
  console.log('\nStep 10: Citizen verifies report and status update...');
  const citizenFetchRes = await makeRequest(app, 'GET', `/api/reports/${submittedReport.id}`, {
    'Authorization': `Bearer ${citizenToken}`
  });
  assert.strictEqual(citizenFetchRes.status, 200, 'Citizen should be able to fetch their report');
  assert.strictEqual(citizenFetchRes.body.report.status, 'In Progress');
  assert.ok(citizenFetchRes.body.timeline && citizenFetchRes.body.timeline.length > 0, 'Timeline should be populated');
  console.log(`  ✓ Citizen read confirmed: Report ${citizenFetchRes.body.report.reference_number} is In Progress with ${citizenFetchRes.body.timeline.length} timeline events`);

  // Step 11: Repeat access checks with a staff account from another department
  console.log('\nStep 11: Testing department boundary enforcement with Sanitation staff...');
  const sanitationLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'staff.sanitation@civicsync.demo',
    password: 'DemoStaff123!'
  });
  assert.strictEqual(sanitationLoginRes.status, 200);
  sanitationStaffToken = sanitationLoginRes.body.token;

  // 11a: Report must not appear in sanitation staff inbox
  const sanitationReportsRes = await makeRequest(app, 'GET', '/api/staff/reports', {
    'Authorization': `Bearer ${sanitationStaffToken}`
  });
  assert.strictEqual(sanitationReportsRes.status, 200);
  const foundBySanitation = (sanitationReportsRes.body.reports || []).find(r => r.id === submittedReport.id);
  assert.strictEqual(foundBySanitation, undefined, 'Sanitation staff must NOT see Roads department report in their inbox');

  // 11b: Sanitation staff cannot claim a Roads report
  const crossDeptClaimRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/claim`, {
    'Authorization': `Bearer ${sanitationStaffToken}`
  });
  assert.strictEqual(crossDeptClaimRes.status, 403, `Expected 403 Forbidden for cross-department claim, got: ${crossDeptClaimRes.status}`);

  // 11c: Sanitation staff cannot modify status of a Roads report
  const crossDeptStatusRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/status`, {
    'Authorization': `Bearer ${sanitationStaffToken}`
  }, {
    status: 'Resolved',
    resolutionSummary: 'Should fail'
  });
  assert.strictEqual(crossDeptStatusRes.status, 403, `Expected 403 Forbidden for cross-department status update, got: ${crossDeptStatusRes.status}`);
  console.log('  ✓ Department boundaries strictly enforced: Cross-department visibility (hidden), claim (403), status update (403)');

  // Step 12: Restart / recreate application instance and verify persistence
  console.log('\nStep 12: Simulating full instance restart / re-instantiation...');
  
  // Clear require caches for db and server to simulate cold restart
  delete require.cache[require.resolve('../server/db')];
  delete require.cache[require.resolve('../server')];
  delete require.cache[require.resolve('../server/routes/reports')];
  delete require.cache[require.resolve('../server/routes/staff')];
  delete require.cache[require.resolve('../server/middleware/auth')];

  const restartedDb = require('../server/db');
  const restartedApp = require('../server');

  // Query database directly after simulated restart
  const restartedReport = await restartedDb.get('SELECT * FROM reports WHERE id = ?', [submittedReport.id]);
  assert.ok(restartedReport, 'Report must persist after restart');
  assert.strictEqual(restartedReport.id, submittedReport.id);
  assert.strictEqual(restartedReport.status, 'In Progress');
  assert.strictEqual(restartedReport.assigned_staff_id, 'usr-staff-roads');
  assert.strictEqual(restartedReport.department_id, 'dept-roads');

  // Re-verify via API request on restarted app
  const postRestartApiRes = await makeRequest(restartedApp, 'GET', `/api/reports/${submittedReport.id}`, {
    'Authorization': `Bearer ${citizenToken}`
  });
  assert.strictEqual(postRestartApiRes.status, 200, 'API request after restart must succeed');
  assert.strictEqual(postRestartApiRes.body.report.status, 'In Progress');
  assert.strictEqual(postRestartApiRes.body.report.assigned_staff_id, 'usr-staff-roads');
  console.log('  ✓ Restart verification confirmed: Report, assignment, and status preserved intact');

  console.log('\n======================================================');
  console.log('🎉 ALL 12 END-TO-END SCENARIO STEPS FULLY VERIFIED!');
  console.log('======================================================\n');
}

runEndToEndScenario().catch((err) => {
  console.error('\n❌ END-TO-END SCENARIO FAILED:', err);
  process.exit(1);
});
