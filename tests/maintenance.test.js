/**
 * Dedicated Automated Test Suite: Maintenance Calendar
 * Tests scheduling maintenance activities, viewing upcoming/overdue works,
 * status updates, cancellations, and calendar routing.
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const app = require('../server/index.js');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const reqStream = new Readable({
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

  // 5. POST /api/maintenance validation: rejects missing title or dates
  await test('POST /api/maintenance rejects missing required fields with 400', async () => {
    const res = await request('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        title: '',
        departmentName: 'Roads & Transport'
      })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('title is required'));
  });

  // 6. POST /api/maintenance schedules a new maintenance activity
  let newMaintId = null;
  await test('POST /api/maintenance schedules new municipal maintenance activity', async () => {
    const res = await request('/api/maintenance', {
      method: 'POST',
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

  // 7. PATCH /api/maintenance/:id/status updates task status
  await test('PATCH /api/maintenance/:id/status updates status to In Progress', async () => {
    const res = await request(`/api/maintenance/${newMaintId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.schedule.status, 'In Progress');
  });

  // 8. Overdue task detection
  await test('Maintenance stats accurately track overdue tasks', async () => {
    // Schedule a past date task that is not completed
    const pastTaskRes = await request('/api/maintenance', {
      method: 'POST',
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
    await request(`/api/maintenance/${pastTaskId}`, { method: 'DELETE' });
  });

  // 9. DELETE /api/maintenance/:id cancels scheduled task
  await test('DELETE /api/maintenance/:id removes scheduled maintenance activity', async () => {
    const res = await request(`/api/maintenance/${newMaintId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);

    // Verify it is gone
    const getRes = await request(`/api/maintenance/${newMaintId}`);
    assert.strictEqual(getRes.status, 404);
  });

  console.log('\n====================================================');
  console.log(`  MAINTENANCE SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMaintenanceSuite();

