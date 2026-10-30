/**
 * Dedicated Automated Test Suite: Maintenance Calendar
 * Tests scheduling maintenance activities, viewing upcoming/overdue works,
 * status updates, cancellations, security boundaries, and calendar routing.
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const jwt = require('jsonwebtoken');
const app = require('../server/index.js');
const db = require('../server/db/index.js');
const { JWT_SECRET } = require('../server/middleware/auth.js');

function makeToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role, department_id: user.department_id }, JWT_SECRET, { expiresIn: '1h' });
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const reqStream = new Readable({
      destroy(err, cb) { if (cb) cb(err); },
      read() {
        if (options.body) {
          this.push(Buffer.from(options.body));
        }
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
    if (options.body) {
      reqStream.headers['content-type'] = reqStream.headers['content-type'] || 'application/json';
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
      const bodyBuffer = Buffer.concat(chunks);
      const text = bodyBuffer.toString('utf8');
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (_) {}

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        text,
        data
      });
    };

    try {
      app.handle(reqStream, res);
    } catch (err) {
      reject(err);
    }
  });
}

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

async function runMaintenanceSuite() {
  console.log('\n====================================================');
  console.log('  RUNNING CIVIC MAINTENANCE CALENDAR TEST SUITE');
  console.log('====================================================\n');

  const adminUser = db.get("SELECT * FROM profiles WHERE role = 'admin' LIMIT 1");
  const adminToken = makeToken(adminUser);

  const citizenUser = db.get("SELECT * FROM profiles WHERE role = 'citizen' LIMIT 1");
  const citizenToken = makeToken(citizenUser);

  // 1. Dedicated Route GET /maintenance
  await test('GET /maintenance renders Civic Maintenance Calendar page with Glass Calendar', async () => {
    const res = await request('/maintenance');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Civic Maintenance Calendar'));
    assert.ok(res.text.includes('cal-month-container'));
    assert.ok(res.text.includes('maint-cards-container'));
    assert.ok(res.text.includes('maint-glass-view'));
    assert.ok(res.text.includes('Schedule Activity'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
  });

  // 2. GET /api/maintenance returns confirmed maintenance list and KPIs
  await test('GET /api/maintenance returns confirmed works and KPI stats', async () => {
    const res = await request('/api/maintenance');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.schedules));
    assert.ok(res.data.schedules.length > 0);
    assert.ok(res.data.stats);
    assert.ok(typeof res.data.stats.total === 'number');
    assert.ok(typeof res.data.stats.inProgress === 'number');
    assert.ok(typeof res.data.stats.upcoming === 'number');
    assert.ok(typeof res.data.stats.overdue === 'number');
    assert.ok(typeof res.data.stats.completed === 'number');
  });

  // 3. Department filter query
  await test('GET /api/maintenance?department=Water returns filtered department schedules', async () => {
    const res = await request('/api/maintenance?department=Water');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.schedules));
    assert.ok(res.data.schedules.every(s => s.department_name.toLowerCase().includes('water')));
  });

  // 4. Status filter query
  await test('GET /api/maintenance?status=in_progress returns active in-progress schedules', async () => {
    const res = await request('/api/maintenance?status=in_progress');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.schedules));
    assert.ok(res.data.schedules.every(s => s.status === 'In Progress'));
  });

  // 5. Security: POST /api/maintenance rejects unauthenticated and citizen users
  await test('POST /api/maintenance rejects unauthenticated requests with 401', async () => {
    const res = await request('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Unauthorized Road Digging',
        departmentName: 'Roads & Transport'
      })
    });
    assert.strictEqual(res.status, 401);
  });

  await test('POST /api/maintenance rejects citizen users with 403', async () => {
    const res = await request('/api/maintenance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${citizenToken}` },
      body: JSON.stringify({
        title: 'Unauthorized Road Digging',
        departmentName: 'Roads & Transport'
      })
    });
    assert.strictEqual(res.status, 403);
  });

  // 6. POST /api/maintenance validation: rejects missing title or dates for admin
  await test('POST /api/maintenance rejects missing required fields with 400', async () => {
    const res = await request('/api/maintenance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: '',
        departmentName: 'Roads & Transport'
      })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('title is required'));
  });

  // 7. POST /api/maintenance schedules a new maintenance activity
  let newMaintId = null;
  await test('POST /api/maintenance schedules new municipal maintenance activity', async () => {
    const res = await request('/api/maintenance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Hitec City Junction Flyover Expansion Joint Servicing',
        departmentId: 'dept-roads',
        departmentName: 'Roads & Transport',
        area: 'Cyber Towers to Inorbit Flyover',
        startDate: '2026-11-05',
        endDate: '2026-11-15',
        status: 'Scheduled',
        officialSource: 'MW-2026-RDS-771',
        description: 'Nightly replacement of mechanical expansion joints to ensure vehicular safety.'
      })
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.schedule.id);
    assert.strictEqual(res.data.schedule.title, 'Hitec City Junction Flyover Expansion Joint Servicing');
    newMaintId = res.data.schedule.id;
  });

  // 8. PATCH /api/maintenance/:id/status updates task status
  await test('PATCH /api/maintenance/:id/status updates status to In Progress', async () => {
    const res = await request(`/api/maintenance/${newMaintId}/status`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.schedule.status, 'In Progress');
  });

  // 9. Overdue task detection
  await test('Maintenance stats accurately track overdue tasks', async () => {
    // Schedule a past date task that is not completed
    const pastTaskRes = await request('/api/maintenance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Overdue Drainage Canal Clearing Test',
        departmentId: 'dept-sanitation',
        departmentName: 'Sanitation',
        area: 'Ward 5 Culvert',
        startDate: '2026-09-01',
        endDate: '2026-09-10',
        status: 'Delayed',
        description: 'Desilting canal with crane dredging equipment.'
      })
    });
    assert.strictEqual(pastTaskRes.status, 201);
    const pastTaskId = pastTaskRes.data.schedule.id;

    const listRes = await request('/api/maintenance?status=overdue');
    assert.strictEqual(listRes.status, 200);
    assert.ok(listRes.data.schedules.some(s => s.id === pastTaskId));

    // Clean up past task
    await request(`/api/maintenance/${pastTaskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
  });

  // 10. DELETE /api/maintenance/:id cancels scheduled task
  await test('DELETE /api/maintenance/:id removes scheduled maintenance activity', async () => {
    const res = await request(`/api/maintenance/${newMaintId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    // Verify it is gone
    const getRes = await request(`/api/maintenance/${newMaintId}`);
    assert.strictEqual(getRes.status, 404);
  });

  // 11. GET /api/staff/maintenance returns maintenance activities for staff's department
  await test('GET /api/staff/maintenance returns assigned department tasks for staff', async () => {
    const staffRoads = db.get("SELECT * FROM profiles WHERE role = 'staff' AND department_id = 'dept-roads' LIMIT 1");
    const token = makeToken(staffRoads);

    const res = await request('/api/staff/maintenance', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.schedules));
    assert.ok(res.data.schedules.every(s => s.department_id === 'dept-roads'));
  });

  // 12. Staff updates status of task within their department
  await test('POST /api/staff/maintenance/:id/status updates execution status within department', async () => {
    const staffRoads = db.get("SELECT * FROM profiles WHERE role = 'staff' AND department_id = 'dept-roads' LIMIT 1");
    const token = makeToken(staffRoads);

    // Create a temporary task in dept-roads
    const createRes = await request('/api/maintenance', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Road Surface Inspection & Curb Painting',
        departmentId: 'dept-roads',
        departmentName: 'Roads & Transport',
        area: 'Banjara Hills Road 12',
        startDate: '2026-11-01',
        endDate: '2026-11-08',
        status: 'Scheduled',
        description: 'Inspection of road curbs and applying reflective yellow thermoplastic paint.'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const tempTaskId = createRes.data.schedule.id;

    // Staff updates status to In Progress
    const updateRes = await request(`/api/staff/maintenance/${tempTaskId}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.schedule.status, 'In Progress');
    assert.strictEqual(updateRes.data.schedule.assigned_staff_id, staffRoads.id);

    // Clean up
    await request(`/api/maintenance/${tempTaskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
  });

  // 13. Security boundary: Staff cannot update maintenance task of another department
  await test('POST /api/staff/maintenance/:id/status rejects staff from a different department (403)', async () => {
    const staffRoads = db.get("SELECT * FROM profiles WHERE role = 'staff' AND department_id = 'dept-roads' LIMIT 1");
    const token = makeToken(staffRoads);

    // Find or create task in dept-water
    const waterTask = db.get("SELECT * FROM maintenance_schedules WHERE department_id = 'dept-water' LIMIT 1");
    assert.ok(waterTask, 'Water department task must exist');

    const res = await request(`/api/staff/maintenance/${waterTask.id}/status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.strictEqual(res.status, 403);
    assert.ok(res.data.error.includes('Security boundary'));
  });

  console.log('\n====================================================');
  console.log(`  MAINTENANCE SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMaintenanceSuite();
