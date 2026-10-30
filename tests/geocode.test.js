/**
 * Automated Test Suite: Geolocation & Spatial Addressing Endpoints
 * Tests:
 * 1. GET /api/geocode/reverse - Parameter validation & spatial resolution
 * 2. GET /api/geocode/search - Autocomplete & landmark fuzzy matching
 */

const assert = require('assert');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const app = require('../server/index.js');

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
      host: 'localhost:3050',
      accept: 'application/json,*/*',
      ...(options.headers || {})
    };

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

async function runGeocodeTests() {
  console.log('\n======================================================');
  console.log('  CIVIC RESOLVE AI — GEOCODING & SPATIAL TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function check(desc, condition) {
    total++;
    process.stdout.write(`Test ${total}: ${desc}... `);
    if (condition) {
      console.log('PASSED ✓');
      passed++;
    } else {
      console.log('FAILED ✗');
      throw new Error(`Failed: ${desc}`);
    }
  }

  // Test 1: GET /api/geocode/reverse without coordinates returns 400
  {
    const res = await request('/api/geocode/reverse');
    check('Reverse geocode without coordinates returns 400', res.status === 400 && res.body && res.body.error);
  }

  // Test 2: GET /api/geocode/reverse with invalid/non-numeric lat returns 400
  {
    const res = await request('/api/geocode/reverse?lat=invalid&lng=78.3489');
    check('Reverse geocode with invalid numeric lat returns 400', res.status === 400);
  }

  // Test 3: GET /api/geocode/reverse with out of bounds latitude returns 400
  {
    const res = await request('/api/geocode/reverse?lat=195.0&lng=78.3489');
    check('Reverse geocode with out-of-range lat (>90) returns 400', res.status === 400);
  }

  // Test 4: GET /api/geocode/reverse with known landmark coordinates (Gachibowli)
  {
    const res = await request('/api/geocode/reverse?lat=17.4401&lng=78.3489');
    check(
      'Reverse geocode resolves Gachibowli landmark coordinates correctly',
      res.status === 200 &&
      res.body.success === true &&
      res.body.displayName &&
      (res.body.displayName.includes('Gachibowli') || res.body.locality.includes('Gachibowli'))
    );
  }

  // Test 5: GET /api/geocode/reverse with Banjara Hills coordinates
  {
    const res = await request('/api/geocode/reverse?lat=17.4177&lng=78.4399');
    check(
      'Reverse geocode resolves Banjara Hills coordinates correctly',
      res.status === 200 &&
      res.body.success === true &&
      res.body.displayName &&
      (res.body.displayName.includes('Banjara Hills') || res.body.locality.includes('Banjara Hills'))
    );
  }

  // Test 6: GET /api/geocode/reverse caches subsequent requests
  {
    const start = Date.now();
    const res = await request('/api/geocode/reverse?lat=17.4177&lng=78.4399');
    const elapsed = Date.now() - start;
    check(
      'Reverse geocode cache responds immediately for identical coordinates',
      res.status === 200 && res.body.success === true && elapsed < 50
    );
  }

  // Test 7: GET /api/geocode/search with empty query returns empty results
  {
    const res = await request('/api/geocode/search?q=');
    check(
      'Search with empty query returns empty results array',
      res.status === 200 && Array.isArray(res.body.results) && res.body.results.length === 0
    );
  }

  // Test 8: GET /api/geocode/search with 1 char returns empty results (min 2 chars)
  {
    const res = await request('/api/geocode/search?q=a');
    check(
      'Search with single character query returns empty results array',
      res.status === 200 && Array.isArray(res.body.results) && res.body.results.length === 0
    );
  }

  // Test 9: GET /api/geocode/search for "gachibowli" returns matched landmarks
  {
    const res = await request('/api/geocode/search?q=gachibowli');
    check(
      'Search for "gachibowli" returns matched landmark with lat/lng',
      res.status === 200 &&
      Array.isArray(res.body.results) &&
      res.body.results.length > 0 &&
      res.body.results[0].latitude &&
      res.body.results[0].longitude &&
      res.body.results[0].name.toLowerCase().includes('gachibowli')
    );
  }

  // Test 10: GET /api/geocode/search for "charminar" returns monument location
  {
    const res = await request('/api/geocode/search?q=charminar');
    check(
      'Search for "charminar" returns Charminar location',
      res.status === 200 &&
      Array.isArray(res.body.results) &&
      res.body.results.length > 0 &&
      res.body.results[0].name.toLowerCase().includes('charminar')
    );
  }

  // Test 11: GET /api/geocode/search by postal code returns corresponding area
  {
    const res = await request('/api/geocode/search?q=500081');
    check(
      'Search by pin code (500081) matches Madhapur/Hitech City',
      res.status === 200 &&
      Array.isArray(res.body.results) &&
      res.body.results.length > 0 &&
      (res.body.results[0].name.includes('500081') || res.body.results[0].name.includes('Hitech') || res.body.results[0].name.includes('Madhapur'))
    );
  }

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passed}/${total} GEOCODING TESTS PASSED!`);
  console.log('======================================================\n');
}

runGeocodeTests().catch(err => {
  console.error('\n❌ Geocoding test suite failure:', err);
  process.exit(1);
});
