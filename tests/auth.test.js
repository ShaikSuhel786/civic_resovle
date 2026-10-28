// Civic Resolve AI: P0 Authentication & Security Authorization Test Suite
// Verifies password enforcement, demo login boundaries, header forge prevention, and role isolation.

const assert = require('assert');
const http = require('http');
const app = require('../server/index');

async function runAuthTests() {
  console.log('----------------------------------------------------');
  console.log('  RUNNING CIVIC RESOLVE AI P0 AUTH & SECURITY TESTS');
  console.log('----------------------------------------------------\n');

  let passed = 0;
  let failed = 0;

  // Spin up temporary test HTTP server on an ephemeral port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Missing password tests
    await test('POST /api/auth/login rejects login when password is missing', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'citizen@civicsync.demo' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error, 'Email and password are required.');
    });

    await test('POST /api/auth/login rejects login when password is an empty string', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'citizen@civicsync.demo', password: '   ' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.error, 'Email and password are required.');
    });

    // 2. Incorrect password tests
    await test('POST /api/auth/login rejects login with incorrect password', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'citizen@civicsync.demo', password: 'WrongPassword123!' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Invalid email or password.');
    });

    await test('POST /api/auth/login rejects previously hardcoded bypass passwords', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'citizen@civicsync.demo', password: 'password123' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Invalid email or password.');
    });

    // 3. Valid login test
    let citizenToken = null;
    let adminToken = null;

    await test('POST /api/auth/login succeeds with correct password hash match', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'citizen@civicsync.demo', password: 'DemoCitizen123!' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.token, 'Should return a JWT token');
      assert.strictEqual(data.user.email, 'citizen@civicsync.demo');
      assert.strictEqual(data.user.role, 'citizen');
      citizenToken = data.token;
    });

    // 4. Demo login mode tests
    await test('POST /api/auth/login succeeds for seeded demo account in demo/dev mode', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoUserId: 'usr-admin-01' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(data.token);
      assert.strictEqual(data.user.role, 'admin');
      adminToken = data.token;
    });

    await test('POST /api/auth/login rejects arbitrary or unseeded demoUserId', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoUserId: 'usr-attacker-injected' })
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Invalid demo user account.');
    });

    await test('POST /api/auth/login rejects demo login when in production mode', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevAllow = process.env.ALLOW_DEMO_LOGIN;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_DEMO_LOGIN;

        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demoUserId: 'usr-admin-01' })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 403);
        assert.strictEqual(data.error, 'Demo login is disabled in production environments.');
      } finally {
        process.env.NODE_ENV = prevEnv;
        if (prevAllow !== undefined) process.env.ALLOW_DEMO_LOGIN = prevAllow;
      }
    });

    // 5. Forged Header & Query Parameter tests
    await test('GET /api/admin/queues rejects forged x-demo-user-id header without Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/admin/queues`, {
        headers: {
          'x-demo-user-id': 'usr-admin-01'
        }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Authentication required. Please sign in.');
    });

    await test('GET /api/admin/queues rejects forged ?demo_user_id query param without Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/admin/queues?demo_user_id=usr-admin-01`);
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Authentication required. Please sign in.');
    });

    // 6. Invalid JWT tests
    await test('GET /api/reports rejects request with invalid Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/reports`, {
        headers: {
          'Authorization': 'Bearer invalid.jwt.token'
        }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Invalid or expired session token.');
    });

    await test('GET /api/reports rejects request with malformed authorization header', async () => {
      const res = await fetch(`${baseUrl}/api/reports`, {
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz'
        }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(data.error, 'Authentication required. Please sign in.');
    });

    // 7. Role-based Access Control (RBAC) tests
    await test('Citizen token is rejected with 403 on admin-only route (/api/admin/queues)', async () => {
      assert.ok(citizenToken, 'Citizen token must be available from earlier test');
      const res = await fetch(`${baseUrl}/api/admin/queues`, {
        headers: {
          'Authorization': `Bearer ${citizenToken}`
        }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 403);
      assert.ok(data.error.includes('Access denied'));
    });

    await test('Admin token is allowed on admin-only route (/api/admin/queues)', async () => {
      assert.ok(adminToken, 'Admin token must be available from earlier test');
      const res = await fetch(`${baseUrl}/api/admin/queues`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(data.urgentQueue));
      assert.ok(Array.isArray(data.reviewQueue));
    });

  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('\n----------------------------------------------------');
  console.log(`  P0 AUTH TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAuthTests().catch(err => {
    console.error('Test suite uncaught error:', err);
    process.exit(1);
  });
}

module.exports = { runAuthTests };
