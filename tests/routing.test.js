/**
 * Step 1: Routing & Page Separation Verification Test Suite
 * Verifies that each route renders its own distinct page component,
 * never duplicates the Home page, and unknown routes return 404.
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
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

async function runRoutingSuite() {
  console.log('\n====================================================');
  console.log('  RUNNING ROUTING FOUNDATION & PAGE SEPARATION TESTS');
  console.log('====================================================\n');

  // 1. Home page
  await test('GET / serves Home page (index.html) with unique landing content', async () => {
    const res = await request('/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Smarter Cities'));
    assert.ok(res.text.includes('How It Works'));
  });

  // 2. City Impact & Transparency
  await test('GET /transparency serves Civic Transparency Scorecard (NOT Home page)', async () => {
    const res = await request('/transparency');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Civic Transparency Scorecard'));
    // Must NOT contain Home page's unique landing content
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
    assert.strictEqual(res.text.includes('How It Works'), false);
  });

  // 3. Civic Digital Twin
  await test('GET /digital-twin serves Civic Digital Twin Geo Map (NOT Home page)', async () => {
    const res = await request('/digital-twin');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Civic Digital Twin'));
    assert.ok(res.text.includes('digital-twin-map'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
    assert.strictEqual(res.text.includes('How It Works'), false);
  });

  // 4. Civic Maintenance Calendar
  await test('GET /maintenance serves Confirmed Maintenance Calendar (NOT Home page)', async () => {
    const res = await request('/maintenance');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Confirmed Civic Maintenance Calendar'));
    assert.ok(res.text.includes('cal-grid-month'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
    assert.strictEqual(res.text.includes('How It Works'), false);
  });

  // 5. AI Civic Knowledge Center
  await test('GET /knowledge serves AI Civic Knowledge Center (NOT Home page)', async () => {
    const res = await request('/knowledge');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('AI Civic Knowledge Center'));
    assert.ok(res.text.includes('knowledge-query-input'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
    assert.strictEqual(res.text.includes('How It Works'), false);
  });

  // 6. Predictive Problem Radar
  await test('GET /radar serves Predictive Problem Radar (NOT Home page)', async () => {
    const res = await request('/radar');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Predictive Problem Radar'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
    assert.strictEqual(res.text.includes('How It Works'), false);
  });

  // 7. Citizen Dashboard
  await test('GET /dashboard serves Citizen Dashboard (NOT Home page)', async () => {
    const res = await request('/dashboard');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('My Reported Issues') || res.text.includes('Citizen'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
  });

  // 8. Admin Command Center
  await test('GET /admin serves Admin Command Center (NOT Home page)', async () => {
    const res = await request('/admin');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Command Center') || res.text.includes('Municipal Admin'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
  });

  // 9. Staff Task Queue
  await test('GET /staff serves Staff Task Queue (NOT Home page)', async () => {
    const res = await request('/staff');
    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes('Field') || res.text.includes('Staff Member'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
  });

  // 10. Strict 404 Handler - Unknown HTML route
  await test('GET /unknown-random-page-12345 returns 404 and does NOT silently render Home page', async () => {
    const res = await request('/unknown-random-page-12345');
    assert.strictEqual(res.status, 404);
    assert.ok(res.text.includes('404'));
    assert.ok(res.text.includes('Page Not Found'));
    assert.strictEqual(res.text.includes('Smarter Cities'), false);
    assert.strictEqual(res.text.includes('How It Works'), false);
  });

  // 11. Strict 404 Handler - Unknown API route
  await test('GET /api/unknown-endpoint returns 404 JSON', async () => {
    const res = await request('/api/unknown-endpoint');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.error, 'API endpoint not found.');
  });

  // 12. Responsive Design & Mobile Navigation Verification
  await test('Responsive styles and mobile navigation rules are properly defined in style.css and auth.js', async () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    const authJs = fs.readFileSync(path.join(__dirname, '../public/js/auth.js'), 'utf8');
    
    assert.ok(css.includes('@media (max-width: 900px)'), 'Must include 900px breakpoint');
    assert.ok(css.includes('@media (max-width: 640px)'), 'Must include 640px mobile breakpoint');
    assert.ok(css.includes('nav-mobile-toggle'), 'Must define nav-mobile-toggle style');
    assert.ok(authJs.includes('setupMobileNav'), 'auth.js must include mobile nav setup');
  });

  console.log('\n====================================================');
  console.log(`  ROUTING SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRoutingSuite();

