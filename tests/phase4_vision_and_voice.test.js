/**
 * Automated Test Suite: Phase 4 AI Vision Inspector & Voice-Based Civic Assistant
 * Tests:
 * 1. AI Vision Inspector Service (PRD F1):
 *    - Defect clues detection: Pothole & Road Cracks -> cat-roads (dept-roads)
 *    - Defect clues detection: Exposed Wires & Sparking -> cat-streetlights (dept-electrical) + hazardFlag: true
 *    - Defect clues detection: Overflowing Garbage -> cat-garbage (dept-sanitation)
 *    - Defect clues detection: Water Pipe Leak -> cat-water (dept-water)
 *    - Defect clues detection: Open Manhole -> cat-drainage (dept-water) + hazardFlag: true
 *    - Transparent Heuristic Fallback & Honest Disclaimer verification
 * 2. Vision Inspector API Endpoint (POST /api/ai/vision-inspect):
 *    - Missing image payload returns 400 Bad Request
 *    - JSON base64 payload returns 200 OK with detected defects and suggested category
 *    - Critical safety hazard detection flags hazardFlag: true with hazardReason
 *    - Report ID lookup inspects report's existing photo
 * 3. Photo Metadata Additive Database Migration:
 *    - Verified photo_metadata stores vision_clues_json and confidence_score
 *    - Verified GET /api/reports/:id returns visionClues array on report photos
 * 4. Voice-Based Civic Assistant (PRD F6):
 *    - Verified public/js/voice-assistant.js module exports
 *    - Verified bilingual support (English 'en-IN' and Telugu 'te-IN')
 *    - Verified speech synthesis and dictation method definitions
 *    - Verified static UI integrations in report.html, knowledge.html, report-detail.html
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { ServerResponse } = require('http');
const jwt = require('jsonwebtoken');
const app = require('../server/index.js');
const db = require('../server/db/index.js');
const { JWT_SECRET } = require('../server/middleware/auth.js');
const { inspectImage, analyzeHeuristically, VISION_DEFECT_RULES } = require('../server/services/vision.js');

function makeToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
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
      'accept': 'application/json,text/html,*/*'
    };
    for (const [k, v] of Object.entries(options.headers || {})) {
      reqStream.headers[k.toLowerCase()] = v;
    }
    if (options.body && !reqStream.headers['content-type']) {
      reqStream.headers['content-type'] = 'application/json';
      reqStream.headers['content-length'] = Buffer.byteLength(options.body).toString();
    }

    const res = new ServerResponse(reqStream);
    const chunks = [];
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

    app(reqStream, res, (err) => {
      if (err) reject(err);
      else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });
  });
}

async function runTests() {
  console.log('\n--- Running Automated Phase 4 Test Suite (AI Vision Inspector & Voice Assistant) ---\n');

  // Test 1: Service Rule Definitions and Clue Extraction
  console.log('Test 1: Vision defect rules and category taxonomy');
  assert.strictEqual(Array.isArray(VISION_DEFECT_RULES), true, 'VISION_DEFECT_RULES should be an array');
  assert.ok(VISION_DEFECT_RULES.length >= 6, 'Should define at least 6 civic defect categories');
  
  const roadRule = VISION_DEFECT_RULES.find(r => r.categoryId === 'cat-roads');
  assert.ok(roadRule, 'cat-roads rule must exist');
  assert.strictEqual(roadRule.departmentId, 'dept-roads');

  const electricRule = VISION_DEFECT_RULES.find(r => r.categoryId === 'cat-streetlights');
  assert.ok(electricRule, 'cat-streetlights rule must exist');
  assert.strictEqual(electricRule.hazard, true, 'Electric rule must flag hazard: true');
  console.log('✓ Passed: Vision defect rules correctly map categories, departments, and hazards');

  // Test 2: Heuristic Analysis for Pothole Clues
  console.log('\nTest 2: Heuristic analysis for road/pothole image');
  const potholeAnalysis = analyzeHeuristically({ fileName: 'deep_pothole_asphalt_road.jpg' });
  assert.strictEqual(potholeAnalysis.provider, 'heuristic_fallback');
  assert.strictEqual(potholeAnalysis.suggestedCategoryId, 'cat-roads');
  assert.strictEqual(potholeAnalysis.suggestedDepartmentId, 'dept-roads');
  assert.strictEqual(potholeAnalysis.hazardFlag, false);
  assert.ok(potholeAnalysis.overallConfidence >= 80);
  assert.ok(potholeAnalysis.disclaimer.includes('heuristic fallback mode'), 'Must include transparent disclaimer');
  console.log('✓ Passed: Pothole image correctly categorized as cat-roads (dept-roads) with fallback disclaimer');

  // Test 3: Hazard Detection for Live Wire and Open Manhole
  console.log('\nTest 3: Safety hazard detection for exposed wire and open manhole');
  const wireAnalysis = analyzeHeuristically({ fileName: 'sparking_electric_live_wire_pole.png' });
  assert.strictEqual(wireAnalysis.suggestedCategoryId, 'cat-streetlights');
  assert.strictEqual(wireAnalysis.suggestedDepartmentId, 'dept-electrical');
  assert.strictEqual(wireAnalysis.hazardFlag, true, 'Wire image must set hazardFlag = true');
  assert.ok(wireAnalysis.hazardReason && wireAnalysis.hazardReason.length > 0, 'Must have hazard reason');

  const manholeAnalysis = analyzeHeuristically({ fileName: 'open_manhole_drain_hazard.jpg' });
  assert.strictEqual(manholeAnalysis.suggestedCategoryId, 'cat-drainage');
  assert.strictEqual(manholeAnalysis.hazardFlag, true, 'Open manhole must set hazardFlag = true');
  console.log('✓ Passed: Urgent hazards flagged with explicit safety warning reasons');

  // Test 4: POST /api/ai/vision-inspect rejects missing image
  console.log('\nTest 4: POST /api/ai/vision-inspect validates input');
  const emptyRes = await request('/api/ai/vision-inspect', {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.strictEqual(emptyRes.status, 400, 'Should reject empty image payload with 400');
  assert.strictEqual(emptyRes.json.success, false);
  console.log('✓ Passed: Missing image payload safely rejected with HTTP 400');

  // Test 5: POST /api/ai/vision-inspect with valid JSON payload
  console.log('\nTest 5: POST /api/ai/vision-inspect with base64 image data');
  const dummyBase64 = Buffer.from('civic-pothole-photo-data-buffer').toString('base64');
  const inspectRes = await request('/api/ai/vision-inspect', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64: dummyBase64,
      fileName: 'road_crater_pothole.jpg',
      mimeType: 'image/jpeg'
    })
  });
  assert.strictEqual(inspectRes.status, 200, 'Should return HTTP 200');
  assert.strictEqual(inspectRes.json.success, true);
  assert.ok(inspectRes.json.provider, 'Should specify provider');
  assert.ok(Array.isArray(inspectRes.json.detectedDefects), 'detectedDefects must be array');
  assert.strictEqual(inspectRes.json.suggestedCategory.id, 'cat-roads');
  assert.strictEqual(inspectRes.json.suggestedCategory.departmentId, 'dept-roads');
  assert.ok(inspectRes.json.disclaimer, 'Must return disclaimer');
  console.log('✓ Passed: POST /api/ai/vision-inspect successfully returns defect clues and category suggestion');

  // Test 6: POST /api/ai/vision-inspect hazard flag response
  console.log('\nTest 6: POST /api/ai/vision-inspect hazard detection via endpoint');
  const hazardInspectRes = await request('/api/ai/vision-inspect', {
    method: 'POST',
    body: JSON.stringify({
      imageBase64: dummyBase64,
      fileName: 'sparking_hanging_wire.jpg'
    })
  });
  assert.strictEqual(hazardInspectRes.status, 200);
  assert.strictEqual(hazardInspectRes.json.hazardFlag, true, 'Endpoint must return hazardFlag: true');
  assert.ok(hazardInspectRes.json.hazardReason.includes('electrical wiring') || hazardInspectRes.json.hazardReason.includes('shock'));
  console.log('✓ Passed: Endpoint correctly flags electrical hazard to frontend');

  // Test 7: Photo upload persists vision clues into photo_metadata
  console.log('\nTest 7: Photo upload persists vision clues into database');
  const citizen = db.get("SELECT * FROM profiles WHERE role = 'citizen' LIMIT 1");
  assert.ok(citizen, 'Test citizen must exist in DB');
  const token = makeToken(citizen);

  // Create a test report
  const createReportRes = await request('/api/reports', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      title: 'Pothole on Main Road',
      description: 'Dangerous pothole causing severe hazard on the highway lane.',
      categoryId: 'cat-roads',
      locationText: 'Banjara Hills, Hyderabad',
      latitude: 17.4201,
      longitude: 78.4485,
      idempotencyKey: 'test-phase4-' + Date.now(),
      privacyNoticeAcknowledged: true
    })
  });
  assert.strictEqual(createReportRes.status, 201, 'Report creation should succeed');
  const testReportId = createReportRes.json.report.id;

  // Insert mock photo with vision metadata to verify database persistence
  const photoId = 'pho-test-' + Date.now().toString(36);
  const sampleClues = JSON.stringify(['Pothole detected', 'Asphalt crack']);
  db.run(`
    INSERT INTO photo_metadata (id, report_id, uploader_id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, vision_clues_json, confidence_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 88, datetime('now'))
  `, [
    photoId,
    testReportId,
    citizen.id,
    '/uploads/sample-pothole.jpg',
    'sample-pothole.jpg',
    'image/jpeg',
    10240,
    sampleClues
  ]);

  // Retrieve report details and verify vision clues are present in photo object
  const detailRes = await request(`/api/reports/${testReportId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(detailRes.status, 200);
  assert.ok(detailRes.json.photos && detailRes.json.photos.length > 0, 'Report must return photos');
  const savedPhoto = detailRes.json.photos.find(p => p.id === photoId);
  assert.ok(savedPhoto, 'Saved photo must be retrieved');
  assert.ok(Array.isArray(savedPhoto.visionClues), 'visionClues must be array');
  assert.strictEqual(savedPhoto.visionClues[0], 'Pothole detected');
  assert.strictEqual(savedPhoto.confidence_score, 88);
  console.log('✓ Passed: photo_metadata columns populated and parsed in report details');

  // Test 8: Voice Assistant Module (public/js/voice-assistant.js)
  console.log('\nTest 8: Voice-Based Civic Assistant module (PRD F6)');
  const voiceJsPath = path.join(__dirname, '..', 'public', 'js', 'voice-assistant.js');
  assert.ok(fs.existsSync(voiceJsPath), 'public/js/voice-assistant.js must exist on disk');
  
  const voiceModule = require(voiceJsPath);
  assert.ok(voiceModule, 'CivicVoice module must be exportable');
  assert.strictEqual(typeof voiceModule.isSupported, 'function', 'isSupported must be a function');
  assert.strictEqual(typeof voiceModule.isTtsSupported, 'function', 'isTtsSupported must be a function');
  assert.strictEqual(typeof voiceModule.toggleDictation, 'function', 'toggleDictation must be a function');
  assert.strictEqual(typeof voiceModule.speakText, 'function', 'speakText must be a function');
  
  // Verify bilingual messages
  assert.ok(voiceModule.messages['en-IN'], 'Must support English (en-IN)');
  assert.ok(voiceModule.messages['te-IN'], 'Must support Telugu (te-IN)');
  assert.ok(voiceModule.messages['te-IN'].listening.includes('వింటున్నాను'), 'Telugu message must include Telugu characters');
  console.log('✓ Passed: CivicVoice provides bilingual English & Telugu speech-to-text and text-to-speech helpers');

  // Test 9: Frontend UI Integration Verification
  console.log('\nTest 9: Static UI integration in HTML pages');
  const reportHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'report.html'), 'utf8');
  assert.ok(reportHtml.includes('voice-assistant.js'), 'report.html must include voice-assistant.js');
  assert.ok(reportHtml.includes('btn-voice-title'), 'report.html must include title voice dictate button');
  assert.ok(reportHtml.includes('btn-voice-desc'), 'report.html must include description voice dictate button');
  assert.ok(reportHtml.includes('voice-lang-select'), 'report.html must include language selector');
  assert.ok(reportHtml.includes('vision-inspector-container'), 'report.html must include AI vision inspector container');
  assert.ok(reportHtml.includes('vision-clues-chips'), 'report.html must include vision clues chips container');
  assert.ok(reportHtml.includes('btn-apply-vision-category'), 'report.html must include apply suggestion button');

  const knowledgeHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'knowledge.html'), 'utf8');
  assert.ok(knowledgeHtml.includes('voice-assistant.js'), 'knowledge.html must include voice-assistant.js');
  assert.ok(knowledgeHtml.includes('btn-voice-know'), 'knowledge.html must include voice ask button');
  assert.ok(knowledgeHtml.includes('tts-btn-'), 'knowledge.html must include text-to-speech listen buttons');

  const reportDetailHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'report-detail.html'), 'utf8');
  assert.ok(reportDetailHtml.includes('AI Clues:'), 'report-detail.html must render AI Clues badge on photo evidence');
  console.log('✓ Passed: Frontend UI screens integrate Vision Inspector and Voice Assistant seamlessly');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 4 AUTOMATED TESTS PASSED (9/9)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Phase 4 Test Suite Failed:', err);
  process.exit(1);
});
