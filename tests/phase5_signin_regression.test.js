/**
 * Phase 5 Comprehensive Sign-In & Authentication Regression Test Suite
 * Tests every requirement: Sign In, Registration, 1-Click Roles, Redirects, Error Handling.
 */

const assert = require('assert');
const http = require('http');

function postJSON(path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3050,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3050${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    }).on('error', reject);
  });
}

async function runRegressionTests() {
  console.log('\n======================================================');
  console.log('  CIVIC RESOLVE AI — PHASE 5 REGRESSION TEST SUITE');
  console.log('======================================================\n');

  const app = require('../server/index.js');
  let serverInstance = null;
  await new Promise((resolve, reject) => {
    const testReq = http.get('http://localhost:3050/api/health', (res) => {
      resolve();
    });
    testReq.on('error', () => {
      serverInstance = http.createServer(app);
      serverInstance.listen(3050, 'localhost', () => {
        resolve();
      });
      serverInstance.on('error', reject);
    });
  });

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
      process.exit(1);
    }
  }

  // 1. Static Asset Delivery & Integrity
  await test('GET /login delivers HTML surface', async () => {
    const res = await get('/login');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('CIVIC RESOLVE AI'));
    assert.ok(res.body.includes('auth-layout'));
    assert.ok(res.body.includes('1-Click Role Accounts'));
  });

  await test('GET /css/style.css delivers updated stylesheet', async () => {
    const res = await get('/css/style.css');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('.auth-layout'));
    assert.ok(res.body.includes('.auth-card'));
    assert.ok(res.body.includes('.auth-bg-image'));
  });

  await test('GET /images/civic-city-bg.jpg delivers background asset', async () => {
    const res = await get('/images/civic-city-bg.jpg');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'image/jpeg');
  });

  await test('GET /images/logo.png delivers brand logo', async () => {
    const res = await get('/images/logo.png');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'], 'image/png');
  });

  // 2. 1-Click Role Demo Logins (All 7 Pre-configured Roles)
  await test('1-Click Login: Priya Sharma (Citizen English - usr-citizen-01)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-citizen-01' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'citizen');
    assert.strictEqual(res.json.user.preferredLanguage, 'en');
  });

  await test('1-Click Login: Rajesh Kumar (Citizen Telugu - usr-citizen-02)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-citizen-02' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'citizen');
    assert.strictEqual(res.json.user.preferredLanguage, 'te');
  });

  await test('1-Click Login: Municipal Admin Officer (usr-admin-01)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-admin-01' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'admin');
  });

  await test('1-Click Login: Roads & Transport Staff (usr-staff-roads)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-staff-roads' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'staff');
    assert.strictEqual(res.json.user.departmentId, 'dept-roads');
  });

  await test('1-Click Login: Sanitation Staff (usr-staff-sanitation)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-staff-sanitation' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'staff');
    assert.strictEqual(res.json.user.departmentId, 'dept-sanitation');
  });

  await test('1-Click Login: Electrical Services Staff (usr-staff-electrical)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-staff-electrical' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'staff');
    assert.strictEqual(res.json.user.departmentId, 'dept-electrical');
  });

  await test('1-Click Login: Water & Drainage Staff (usr-staff-water)', async () => {
    const res = await postJSON('/api/auth/login', { demoUserId: 'usr-staff-water' });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'staff');
    assert.strictEqual(res.json.user.departmentId, 'dept-water');
  });

  // 3. Email & Password Authentication Flow
  await test('Sign In: Valid Citizen Email & Password', async () => {
    const res = await postJSON('/api/auth/login', {
      email: 'citizen@civicsync.demo',
      password: 'DemoCitizen123!'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.role, 'citizen');
  });

  await test('Sign In: Invalid Password Rejection (401)', async () => {
    const res = await postJSON('/api/auth/login', {
      email: 'citizen@civicsync.demo',
      password: 'wrong_password_xyz'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.json.error, 'Invalid email or password.');
  });

  await test('Sign In: Non-existent Email Rejection (401)', async () => {
    const res = await postJSON('/api/auth/login', {
      email: 'doesnotexist_9999@example.com',
      password: 'DemoCitizen123!'
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.json.error, 'Invalid email or password.');
  });

  // 4. Citizen Registration Flow
  const uniqueEmail = `testcitizen_${Date.now()}@example.com`;
  await test('Registration: Valid Citizen Account Creation', async () => {
    const res = await postJSON('/api/auth/register', {
      fullName: 'Ananya Roy',
      email: uniqueEmail,
      password: 'SecurePassword123!',
      phone: '+91 91234 56789',
      preferredLanguage: 'en'
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.json.token);
    assert.strictEqual(res.json.user.displayName, 'Ananya Roy');
    assert.strictEqual(res.json.user.role, 'citizen');
  });

  await test('Registration: Duplicate Email Rejection (409 Conflict)', async () => {
    const res = await postJSON('/api/auth/register', {
      fullName: 'Ananya Roy Duplicate',
      email: uniqueEmail,
      password: 'SecurePassword123!',
      preferredLanguage: 'en'
    });
    assert.strictEqual(res.status, 409);
    assert.ok(res.json.error.includes('already exists'));
  });

  await test('Registration: Short Password Rejection (< 8 chars, 400)', async () => {
    const res = await postJSON('/api/auth/register', {
      fullName: 'Short Pass User',
      email: `shortpass_${Date.now()}@example.com`,
      password: 'short'
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.json.error.includes('8 characters'));
  });

  // 5. Protected Destination Routes Accessibility
  await test('GET /dashboard serves Citizen Dashboard destination', async () => {
    const res = await get('/dashboard');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Dashboard') || res.body.includes('Citizen'));
  });

  await test('GET /admin serves Admin Command Center destination', async () => {
    const res = await get('/admin');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Admin') || res.body.includes('Triage'));
  });

  await test('GET /staff serves Staff Task Queue destination', async () => {
    const res = await get('/staff');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.includes('Staff') || res.body.includes('Work Queue'));
  });

  if (serverInstance) {
    serverInstance.close();
  }

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passed}/${total} PHASE 5 REGRESSION TESTS PASSED!`);
  console.log('======================================================\n');
}

runRegressionTests().catch(err => {
  console.error('[Regression Test Failure]:', err);
  process.exit(1);
});

