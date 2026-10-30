// Civic Resolve AI: Real PostgreSQL Integration Test Suite
// Executes the complete 12-step end-to-end scenario against a live PostgreSQL instance when TEST_DATABASE_URL is provided.
// If TEST_DATABASE_URL is not configured, logs notice and reports live PG testing blocked per protocol.

require('dotenv').config();
const http = require('http');
const assert = require('assert');
const bcrypt = require('bcryptjs');

const testDbUrl = (process.env.TEST_DATABASE_URL || '').trim();

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

async function runPostgresIntegrationSuite() {
  console.log('\n======================================================');
  console.log('  CIVIC RESOLVE AI — POSTGRESQL INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  if (!testDbUrl || !testDbUrl.startsWith('postgres')) {
    console.log('⚠️  [BLOCKED / SKIPPED]');
    console.log('   TEST_DATABASE_URL environment variable is not configured.');
    console.log('   To execute live PostgreSQL end-to-end integration tests:');
    console.log('   1. Provision a PostgreSQL test database or Supabase test project.');
    console.log('   2. Export TEST_DATABASE_URL=postgresql://user:password@host:port/dbname?sslmode=require');
    console.log('   3. Run: node tests/postgres_integration.test.js\n');
    return { skipped: true, reason: 'TEST_DATABASE_URL_NOT_CONFIGURED' };
  }

  console.log('Connecting to live PostgreSQL database configured via TEST_DATABASE_URL...');
  process.env.DATABASE_URL = testDbUrl;
  
  // Clear require cache to reinitialize db and app with PostgreSQL
  delete require.cache[require.resolve('../server/db')];
  delete require.cache[require.resolve('../server')];
  
  const db = require('../server/db');
  const app = require('../server');

  assert.strictEqual(db.mode, 'postgres', 'Database adapter must operate in postgres mode');

  console.log('Running schema and seed migration on test database...');
  const { runMigration } = require('../scripts/migrate_to_postgres');
  await runMigration();

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
    VALUES (?, ?, ?, ?, ?, ?, TRUE, 'en')
    ON CONFLICT (id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash, department_id = excluded.department_id, active = TRUE
  `, [
    'usr-staff-roads-2',
    'roads2@civicsync.demo',
    staffHash,
    'Rajesh Kumar (Roads Staff 2)',
    'staff',
    'dept-roads'
  ]);

  console.log('Step 1: Authenticating as citizen...');
  const citLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'citizen@civicsync.demo',
    password: 'DemoCitizen123!'
  });
  assert.strictEqual(citLoginRes.status, 200, `Citizen login failed: ${JSON.stringify(citLoginRes.body)}`);
  assert.ok(citLoginRes.body.token, 'Expected JWT token in citizen login response');
  citizenToken = citLoginRes.body.token;
  citizenUser = citLoginRes.body.user;
  console.log(`  ✓ Authenticated as ${citizenUser.displayName} (${citizenUser.role}) (${citizenUser.id})`);

  console.log('\nStep 2: Submitting civic complaint with valid category and location...');
  const reportPayload = {
    title: 'Severe Pothole on PG Test Expressway',
    description: 'A deep pothole measuring over 2 feet across is damaging vehicle rims on the inner lane.',
    categoryId: 'cat-roads',
    locationText: 'Near Hitec City flyover pillar 42, Hyderabad',
    latitude: 17.4435,
    longitude: 78.3772,
    idempotencyKey: 'idemp-pg-test-' + Date.now(),
    privacyNoticeAcknowledged: true
  };
  const submitRes = await makeRequest(app, 'POST', '/api/reports', {
    'Authorization': `Bearer ${citizenToken}`
  }, reportPayload);
  assert.strictEqual(submitRes.status, 201, `Report submission failed: ${JSON.stringify(submitRes.body)}`);
  submittedReport = submitRes.body.report;
  assert.ok(submittedReport.id, 'Report must have an id');
  assert.strictEqual(submittedReport.status, 'Submitted');
  console.log(`  ✓ Report submitted: ${submittedReport.referenceNumber} (ID: ${submittedReport.id})`);

  console.log('\nStep 3: Verifying report persistence directly in durable PostgreSQL database...');
  const dbReport = await db.get('SELECT * FROM reports WHERE id = ?', [submittedReport.id]);
  assert.ok(dbReport, 'Report record must be found in database');
  assert.strictEqual(dbReport.id, submittedReport.id);
  assert.strictEqual(dbReport.title, reportPayload.title);
  assert.strictEqual(dbReport.status, 'Submitted');
  console.log(`  ✓ Direct DB read verified: Report ${dbReport.id} is stored with status ${dbReport.status}`);

  console.log('\nStep 4: Verifying department routing matches category rules...');
  assert.strictEqual(dbReport.department_id, 'dept-roads', 'Category cat-roads must route to dept-roads');
  console.log(`  ✓ Department resolved correctly: ${dbReport.department_id} (Roads Department)`);

  console.log('\nStep 5: Authenticating as Roads field staff...');
  const staffLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'roads@civicsync.demo',
    password: 'DemoStaff123!'
  });
  assert.strictEqual(staffLoginRes.status, 200, `Roads staff login failed: ${JSON.stringify(staffLoginRes.body)}`);
  roadsStaffToken = staffLoginRes.body.token;
  console.log(`  ✓ Authenticated as ${staffLoginRes.body.user.displayName} (${staffLoginRes.body.user.departmentId})`);

  console.log('\nStep 6: Verifying report appears in department inbox as claimable...');
  const staffReportsRes = await makeRequest(app, 'GET', '/api/staff/reports', {
    'Authorization': `Bearer ${roadsStaffToken}`
  });
  assert.strictEqual(staffReportsRes.status, 200, 'Staff queue request must return 200');
  const foundInQueue = (staffReportsRes.body.reports || []).find(r => r.id === submittedReport.id);
  assert.ok(foundInQueue, `Report ${submittedReport.id} must be visible in Roads staff queue`);
  assert.strictEqual(foundInQueue.isAssignedToMe, false, 'Should be unassigned initially');
  assert.strictEqual(foundInQueue.isClaimable, true, 'Should be claimable by Roads staff');
  console.log(`  ✓ Report ${submittedReport.referenceNumber} is visible and claimable in Roads staff queue`);

  console.log('\nStep 7: Field staff claims the report...');
  const claimRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/claim`, {
    'Authorization': `Bearer ${roadsStaffToken}`
  }, { reason: 'Roads crew dispatched to patch asphalt.' });
  assert.strictEqual(claimRes.status, 200, `Claim failed: ${JSON.stringify(claimRes.body)}`);
  assert.strictEqual(claimRes.body.report.status, 'Assigned');
  assert.strictEqual(claimRes.body.report.assignedStaffId, staffLoginRes.body.user.id);
  console.log(`  ✓ Report successfully claimed by ${staffLoginRes.body.user.id}; status changed to Assigned`);

  console.log('\nStep 8: Second staff member attempts to claim the same report...');
  const staff2LoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'roads2@civicsync.demo',
    password: 'DemoStaff123!'
  });
  assert.strictEqual(staff2LoginRes.status, 200);
  roadsStaff2Token = staff2LoginRes.body.token;

  const doubleClaimRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/claim`, {
    'Authorization': `Bearer ${roadsStaff2Token}`
  }, { reason: 'Attempting conflicting claim.' });
  assert.strictEqual(doubleClaimRes.status, 409, 'Double claim must be rejected with 409 Conflict');
  console.log(`  ✓ Double-claim rejected with 409 Conflict`);

  console.log('\nStep 9: Updating status to "In Progress" and verifying timeline & notification...');
  const progressRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/status`, {
    'Authorization': `Bearer ${roadsStaffToken}`
  }, {
    status: 'In Progress',
    note: 'Crew is actively filling pothole with asphalt mixture.'
  });
  assert.strictEqual(progressRes.status, 200, `Status update to In Progress failed: ${JSON.stringify(progressRes.body)}`);

  const events = await db.all('SELECT * FROM report_events WHERE report_id = ? ORDER BY created_at ASC', [submittedReport.id]);
  const statusEvent = events.find(e => e.event_type === 'status_changed' && e.message.includes('In Progress'));
  assert.ok(statusEvent, 'A status_changed timeline event must be recorded');
  console.log(`  ✓ Timeline event recorded: "${statusEvent.event_type}: ${statusEvent.message}"`);

  const notifications = await db.all('SELECT * FROM notifications WHERE recipient_id = ? AND report_id = ?', [citizenUser.id, submittedReport.id]);
  assert.ok(notifications.length > 0, 'Citizen must receive notification');
  console.log(`  ✓ Notification generated for citizen: "${notifications[0].title}"`);

  console.log('\nStep 10: Citizen verifies report and status update...');
  const citizenDetailRes = await makeRequest(app, 'GET', `/api/reports/${submittedReport.id}`, {
    'Authorization': `Bearer ${citizenToken}`
  });
  assert.strictEqual(citizenDetailRes.status, 200);
  assert.strictEqual(citizenDetailRes.body.report.status, 'In Progress');
  assert.ok(citizenDetailRes.body.timeline.length >= 3, 'Timeline must show history');
  console.log(`  ✓ Citizen read confirmed: Report ${submittedReport.referenceNumber} is In Progress with ${citizenDetailRes.body.timeline.length} timeline events`);

  console.log('\nStep 11: Testing department boundary enforcement with Sanitation staff...');
  const sanLoginRes = await makeRequest(app, 'POST', '/api/auth/login', {}, {
    email: 'sanitation@civicsync.demo',
    password: 'DemoStaff123!'
  });
  assert.strictEqual(sanLoginRes.status, 200);
  sanitationStaffToken = sanLoginRes.body.token;

  const sanQueueRes = await makeRequest(app, 'GET', '/api/staff/reports', {
    'Authorization': `Bearer ${sanitationStaffToken}`
  });
  assert.strictEqual(sanQueueRes.status, 200);
  const foundInSan = (sanQueueRes.body.reports || []).find(r => r.id === submittedReport.id);
  assert.strictEqual(foundInSan, undefined, 'Roads report must NOT be visible to Sanitation staff queue');

  const sanClaimRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/claim`, {
    'Authorization': `Bearer ${sanitationStaffToken}`
  }, { reason: 'Unauthorized cross-dept claim' });
  assert.strictEqual(sanClaimRes.status, 403, 'Cross-department claim must return 403 Forbidden');

  const sanStatusRes = await makeRequest(app, 'POST', `/api/staff/reports/${submittedReport.id}/status`, {
    'Authorization': `Bearer ${sanitationStaffToken}`
  }, { status: 'Resolved', note: 'Unauthorized cross-dept update' });
  assert.strictEqual(sanStatusRes.status, 403, 'Cross-department status change must return 403 Forbidden');
  console.log('  ✓ Department boundaries strictly enforced: Cross-department visibility (hidden), claim (403), status update (403)');

  console.log('\nStep 12: Simulating full instance restart / re-instantiation...');
  delete require.cache[require.resolve('../server/db')];
  delete require.cache[require.resolve('../server')];
  const reloadedDb = require('../server/db');
  const reloadedApp = require('../server');

  const reloadedReportRes = await makeRequest(reloadedApp, 'GET', `/api/reports/${submittedReport.id}`, {
    'Authorization': `Bearer ${citizenToken}`
  });
  assert.strictEqual(reloadedReportRes.status, 200);
  assert.strictEqual(reloadedReportRes.body.report.status, 'In Progress');
  assert.strictEqual(reloadedReportRes.body.report.assignedStaffId, staffLoginRes.body.user.id);
  console.log('  ✓ Restart verification confirmed: Report, assignment, and status preserved intact');

  console.log('\n======================================================');
  console.log('🎉 ALL 12 END-TO-END SCENARIO STEPS FULLY VERIFIED IN POSTGRESQL!');
  console.log('======================================================\n');
  return { success: true };
}

if (require.main === module) {
  runPostgresIntegrationSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runPostgresIntegrationSuite };
