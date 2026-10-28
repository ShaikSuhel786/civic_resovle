/**
 * Automated Test Suite: Phase 1 Database Migrations & Public Endpoints
 * Tests:
 * 1. Civic Transparency Scorecard (GET /api/analytics/scorecard)
 * 2. Civic Digital Twin (GET /api/reports/public/digital-twin)
 * 3. AI Civic Knowledge Center (GET /api/knowledge and POST /api/knowledge/ask)
 * 4. Predictive Problem Radar (GET /api/analytics/radar)
 * 5. Page routing and privacy compliance
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
        if (options.body) this.push(Buffer.from(options.body));
        this.push(null);
      }
    });

    reqStream.method = method;
    reqStream.url = url;
    reqStream.headers = {
      host: 'localhost:3050',
      accept: 'application/json,text/html,*/*',
      ...(options.headers || {})
    };
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

async function runPhase1Tests() {
  console.log('\n====================================================');
  console.log('  RUNNING PHASE 1: DATABASE & PUBLIC ENDPOINTS SUITE');
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

  // 1. Transparency Scorecard Tests
  await test('GET /api/analytics/scorecard returns 200 with genuine database aggregate metrics', async () => {
    const res = await request('/api/analytics/scorecard?period=all');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.kpis, 'Should contain kpis object');
    assert.ok(typeof res.body.kpis.totalIssues === 'number', 'totalIssues should be a number');
    assert.ok(typeof res.body.kpis.resolvedIssues === 'number', 'resolvedIssues should be a number');
    assert.ok(res.body.kpis.resolutionRate.endsWith('%'), 'resolutionRate should be formatted as percentage');
    assert.ok(Array.isArray(res.body.categoryDistribution), 'categoryDistribution should be an array');
    assert.ok(Array.isArray(res.body.departmentWorkload), 'departmentWorkload should be an array');
    assert.ok(Array.isArray(res.body.monthlyTrend), 'monthlyTrend should be an array');
  });

  await test('GET /api/analytics/scorecard respects period filtering (30d and q4)', async () => {
    const res30d = await request('/api/analytics/scorecard?period=30d');
    const resQ4 = await request('/api/analytics/scorecard?period=q4');
    assert.strictEqual(res30d.status, 200);
    assert.strictEqual(resQ4.status, 200);
    assert.strictEqual(res30d.body.period, '30d');
    assert.strictEqual(resQ4.body.period, 'q4');
  });

  await test('GET /api/analytics/scorecard protects citizen privacy and exposes zero PII', async () => {
    const res = await request('/api/analytics/scorecard');
    const raw = JSON.stringify(res.body).toLowerCase();
    assert.strictEqual(raw.includes('password_hash'), false);
    assert.strictEqual(raw.includes('citizen_id'), false);
    assert.strictEqual(raw.includes('@example.com'), false);
    assert.strictEqual(raw.includes('phone'), false);
  });

  // 2. Digital Twin Telemetry Tests
  await test('GET /api/reports/public/digital-twin returns privacy-safe geospatial telemetry', async () => {
    const res = await request('/api/reports/public/digital-twin');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.reports), 'reports should be an array');
    assert.ok(res.body.total >= 0, 'total should be non-negative');

    if (res.body.reports.length > 0) {
      const sample = res.body.reports[0];
      assert.ok(sample.referenceNumber, 'Should contain referenceNumber');
      assert.ok(sample.title, 'Should contain title');
      assert.ok(typeof sample.latitude === 'number', 'latitude should be number');
      assert.ok(typeof sample.longitude === 'number', 'longitude should be number');
      assert.strictEqual(sample.citizen_id, undefined, 'Must not expose citizen_id');
      assert.strictEqual(sample.email, undefined, 'Must not expose citizen email');
    }
  });

  await test('GET /api/reports/public/digital-twin filters by department and status', async () => {
    const resDept = await request('/api/reports/public/digital-twin?department=Roads%20%26%20Transport');
    assert.strictEqual(resDept.status, 200);
    for (const r of resDept.body.reports) {
      assert.ok(r.department.includes('Roads'), `Department should match Roads (got ${r.department})`);
    }

    const resStatus = await request('/api/reports/public/digital-twin?status=resolved');
    assert.strictEqual(resStatus.status, 200);
    for (const r of resStatus.body.reports) {
      assert.strictEqual(r.status, 'Resolved');
    }
  });

  // 3. AI Civic Knowledge Center Tests
  await test('GET /api/knowledge returns verified statutory municipal knowledge articles', async () => {
    const res = await request('/api/knowledge');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.articles), 'articles should be an array');
    assert.ok(res.body.articles.length >= 4, 'Should contain seeded municipal articles');
    assert.ok(res.body.articles[0].official_source, 'Should cite official municipal source');
  });

  await test('POST /api/knowledge/ask returns verified citation for matching civic inquiry', async () => {
    const res = await request('/api/knowledge/ask', {
      method: 'POST',
      body: JSON.stringify({ query: 'pothole repair timeline and response tiers' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.answered, true);
    assert.ok(res.body.answer, 'Should provide grounded answer');
    assert.ok(res.body.citation.officialSource.includes('Municipal Works Bylaw'), 'Should cite Municipal Works Bylaw');
  });

  await test('POST /api/knowledge/ask never hallucinates: returns explicit unverified fallback for unknown query', async () => {
    const res = await request('/api/knowledge/ask', {
      method: 'POST',
      body: JSON.stringify({ query: 'how to build a personal nuclear reactor in living room' })
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.answered, false);
    assert.ok(res.body.message.includes('No verified municipal citation found'), 'Should disclose lack of official citation');
    assert.ok(res.body.officialHelpline, 'Should provide official helpline');
  });

  await test('POST /api/knowledge/ask rejects invalid query with 400 Bad Request', async () => {
    const res = await request('/api/knowledge/ask', {
      method: 'POST',
      body: JSON.stringify({ query: 'hi' })
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error, 'Should return validation error');
  });

  // 4. Predictive Problem Radar Tests
  await test('GET /api/analytics/radar computes density clusters, risk scores (0-100), and statistical disclaimer', async () => {
    const res = await request('/api/analytics/radar');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.disclaimer, 'Must include statistical estimate disclaimer');
    assert.ok(typeof res.body.totalAnalyzedReports === 'number');

    if (!res.body.insufficientData) {
      assert.ok(Array.isArray(res.body.hotspots), 'hotspots should be array');
      if (res.body.hotspots.length > 0) {
        const spot = res.body.hotspots[0];
        assert.ok(spot.zone, 'Hotspot must have a zone name');
        assert.ok(spot.category, 'Hotspot must have a category');
        assert.ok(spot.predictedRiskScore >= 0 && spot.predictedRiskScore <= 100, 'Risk score must be 0-100');
        assert.ok(Array.isArray(spot.factors), 'Must list key driving factors');
        assert.ok(spot.recommendedAction, 'Must list recommended preventive action');
        assert.ok(spot.derivationExplanation, 'Must disclose derivation formula');
      }
    }
  });

  // 5. HTML Frontend Routing Integrity Tests
  await test('All 4 dedicated pages serve HTTP 200 with their respective frontend assets', async () => {
    const [t, dt, k, r] = await Promise.all([
      request('/transparency'),
      request('/digital-twin'),
      request('/knowledge'),
      request('/radar')
    ]);
    assert.strictEqual(t.status, 200);
    assert.strictEqual(dt.status, 200);
    assert.strictEqual(k.status, 200);
    assert.strictEqual(r.status, 200);
    assert.ok(t.raw.includes('Civic Transparency Scorecard'));
    assert.ok(dt.raw.includes('Civic Digital Twin'));
    assert.ok(k.raw.includes('AI Civic Knowledge Center'));
    assert.ok(r.raw.includes('Predictive Problem Radar'));
  });

  console.log('----------------------------------------------------');
  console.log(`  PHASE 1 RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runPhase1Tests();
}

module.exports = runPhase1Tests;

