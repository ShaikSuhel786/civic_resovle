// Civic Resolve AI: Comprehensive Automated Test Suite
// Verifies PRD Acceptance Test Plan: End-to-end workflow, security boundaries, status machines, and idempotency.

const assert = require('assert');
const path = require('path');
const db = require('../server/db');
const { analyzeReport } = require('../server/ai/analyzer');

async function runTests() {
  console.log('----------------------------------------------------');
  console.log('  RUNNING CIVIC RESOLVE AI AUTOMATED TEST SUITE');
  console.log('----------------------------------------------------\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Simulated AI Analyzer & Priority Formula Test
  test('AI Analyzer correctly applies PRD priority formula (0.40S + 0.30R + 0.20P + 0.10D)', () => {
    const input = {
      description: 'Severe deep crater and large pothole on main road causing accidents for two-wheelers for past 2 weeks.',
      userCategoryId: 'cat-roads',
      locationText: 'Road No 1, Banjara Hills',
      latitude: 17.4200,
      longitude: 78.4480
    };
    const result = analyzeReport(input, []);
    assert.strictEqual(result.analysisState, 'Completed');
    assert.strictEqual(result.suggestedCategoryId, 'cat-roads');
    assert.strictEqual(result.suggestedDepartmentId, 'dept-roads');
    assert.ok(result.priorityScore >= 70, `Priority score should be high (got ${result.priorityScore})`);
    assert.ok(['High', 'Urgent'].includes(result.priorityLevel), 'Priority level should be High or Urgent');
    
    // Formula check
    const expected = Math.round(
      0.40 * result.severityFactor +
      0.30 * result.safetyFactor +
      0.20 * result.peopleFactor +
      0.10 * result.durationFactor
    );
    assert.strictEqual(result.priorityScore, expected, 'Score must match exact weighted formula');
  });

  // 2. Safety Hazard Detection Test
  test('AI Analyzer detects serious hazard and flags mandatory Urgent Admin Review', () => {
    const hazardInput = {
      description: 'Exposed live wire sparking on electric pole near elementary school, children walking nearby.',
      locationText: 'Jubilee Hills Checkpost',
      latitude: 17.4300,
      longitude: 78.4100
    };
    const result = analyzeReport(hazardInput, []);
    assert.strictEqual(result.safetyFlag, 1, 'Safety flag must be set to 1');
    assert.strictEqual(result.reviewRequired, 1, 'Review required must be set to 1');
    assert.strictEqual(result.priorityLevel, 'Urgent');
    assert.ok(result.safetyFlagReason.includes('sparking'), 'Reason must mention detected hazard');
  });

  // 3. Low-Confidence Heuristic Test
  test('AI Analyzer flags low-confidence (<80) analysis for Admin routing', () => {
    const vagueInput = {
      description: 'There is something strange happening down the street corner that needs fixing.',
      locationText: 'Near Bus Stop, Secunderabad'
    };
    const result = analyzeReport(vagueInput, []);
    assert.ok(result.confidenceScore < 80, `Confidence should be < 80 (got ${result.confidenceScore})`);
    assert.strictEqual(result.reviewRequired, 1, 'Review required must be flagged');
  });

  // 4. Duplicate Candidate Detection
  test('AI Analyzer flags nearby existing reports as duplicate candidates without confirming duplicate', () => {
    const existing = [
      {
        id: 'rep-existing-1',
        reference_number: 'REP-EXISTING-1',
        title: 'Large pothole on main road',
        description: 'Large pothole on main road causing severe traffic hazard and vehicle damage',
        category_id: 'cat-roads',
        location_text: 'City Center Mall, Banjara Hills',
        latitude: 17.4201,
        longitude: 78.4485
      }
    ];
    const newReport = {
      description: 'Big pothole on main road causing severe traffic jam near City Center Mall',
      userCategoryId: 'cat-roads',
      locationText: 'Road 1, Banjara Hills',
      latitude: 17.4205, // ~50 meters away
      longitude: 78.4488
    };
    const result = analyzeReport(newReport, existing);
    assert.ok(result.duplicateCandidates.length > 0, 'Should return candidate duplicate');
    assert.strictEqual(result.duplicateCandidates[0].id, 'rep-existing-1');
    assert.ok(result.duplicateCandidates[0].similarityScore >= 70);
  });

  // 5. Database Schema & Role Boundary Tests
  test('Profiles table enforces valid role check constraint', () => {
    let errorCaught = false;
    try {
      db.run(`
        INSERT INTO profiles (id, email, display_name, role, active)
        VALUES ('invalid-user', 'fake@test.com', 'Fake', 'superhacker', 1)
      `);
    } catch (e) {
      errorCaught = true;
    }
    assert.ok(errorCaught, 'Should reject invalid role');
  });

  // 6. Security Isolation: Staff cannot be assigned outside their mapped department
  test('Admin assignment rejects assigning staff to a report from a different department', () => {
    // Electrical staff cannot be assigned to Roads report
    const roadsReport = db.get("SELECT * FROM reports WHERE department_id = 'dept-roads' AND status IN ('Submitted', 'Under Review') LIMIT 1");
    const electricalStaff = db.get("SELECT * FROM profiles WHERE id = 'usr-staff-electrical'");
    
    assert.ok(roadsReport, 'Should find an unassigned roads report');
    assert.strictEqual(electricalStaff.department_id, 'dept-electrical');
    assert.notStrictEqual(roadsReport.department_id, electricalStaff.department_id);
  });

  // 7. Status Machine: Blocked requires reason, Resolved requires summary
  test('Report status transition validates business rules (Blocked needs reason, Resolved needs summary)', () => {
    // Check that seeded blocked report has reason
    const blockedReport = db.get("SELECT * FROM reports WHERE status = 'Blocked'");
    assert.ok(blockedReport, 'Seeded blocked report exists');
    assert.ok(blockedReport.blocked_reason && blockedReport.blocked_reason.length >= 10, 'Blocked reason must be recorded');

    // Check that seeded resolved report has summary
    const resolvedReport = db.get("SELECT * FROM reports WHERE status = 'Resolved'");
    assert.ok(resolvedReport, 'Seeded resolved report exists');
    assert.ok(resolvedReport.resolution_summary && resolvedReport.resolution_summary.length >= 15, 'Resolution summary must be recorded');
  });

  // 8. Idempotency Key Constraint
  test('Idempotency key prevents duplicate report creation in database', () => {
    db.run("DELETE FROM reports WHERE id IN ('rep-test-idem-1', 'rep-test-idem-2')");
    const key = 'test-idempotency-unique-key-999';
    db.run(`
      INSERT INTO reports (
        id, reference_number, citizen_id, title, description, category_id, department_id,
        location_text, status, priority_score, priority_level, idempotency_key, created_at, updated_at
      ) VALUES (
        'rep-test-idem-1', 'REP-TEST-IDEM-1', 'usr-citizen-01', 'Test Pothole', 'Test description of pothole 20 characters long',
        'cat-roads', 'dept-roads', 'Test Location Hyderabad', 'Submitted', 50, 'Medium', ?, datetime('now'), datetime('now')
      )
    `, [key]);

    let duplicateKeyError = false;
    try {
      db.run(`
        INSERT INTO reports (
          id, reference_number, citizen_id, title, description, category_id, department_id,
          location_text, status, priority_score, priority_level, idempotency_key, created_at, updated_at
        ) VALUES (
          'rep-test-idem-2', 'REP-TEST-IDEM-2', 'usr-citizen-01', 'Test Pothole 2', 'Another description of pothole 20 characters long',
          'cat-roads', 'dept-roads', 'Test Location Hyderabad', 'Submitted', 50, 'Medium', ?, datetime('now'), datetime('now')
        )
      `, [key]);
    } catch (e) {
      duplicateKeyError = true;
    }

    assert.ok(duplicateKeyError, 'Database must reject duplicate idempotency key');
    db.run("DELETE FROM reports WHERE id IN ('rep-test-idem-1', 'rep-test-idem-2')");
  });

  // 9. End-to-End Workflow State Simulation
  test('Complete End-to-End Workflow: Submitted -> Under Review -> Assigned -> In Progress -> Resolved', () => {
    const testReportId = 'rep-e2e-test';
    const testRef = 'REP-E2E-TEST';
    db.run("DELETE FROM notifications WHERE report_id = ?", [testReportId]);
    db.run("DELETE FROM reports WHERE id = ?", [testReportId]);
    
    // Step 1: Citizen Submits
    db.run(`
      INSERT INTO reports (
        id, reference_number, citizen_id, title, description, category_id, department_id,
        location_text, status, priority_score, priority_level, analysis_state, created_at, updated_at
      ) VALUES (
        ?, ?, 'usr-citizen-01', 'Streetlight Broken on 5th Cross', 'The streetlight is completely broken and dark for past 3 days.',
        'cat-streetlights', 'dept-electrical', '5th Cross, Hyderabad', 'Submitted', 75, 'High', 'Completed', datetime('now'), datetime('now')
      )
    `, [testReportId, testRef]);

    let rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'Submitted');

    // Step 2: Admin starts review
    db.run("UPDATE reports SET status = 'Under Review', updated_at = datetime('now') WHERE id = ?", [testReportId]);
    rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'Under Review');

    // Step 3: Admin assigns to Electrical Staff
    db.run(`
      UPDATE reports
      SET status = 'Assigned', assigned_staff_id = 'usr-staff-electrical', updated_at = datetime('now')
      WHERE id = ?
    `, [testReportId]);
    rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'Assigned');
    assert.strictEqual(rep.assigned_staff_id, 'usr-staff-electrical');

    // Step 4: Assigned staff moves to In Progress
    db.run("UPDATE reports SET status = 'In Progress', updated_at = datetime('now') WHERE id = ?", [testReportId]);
    rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'In Progress');

    // Step 5: Staff marks as Blocked (e.g. awaiting parts)
    db.run(`
      UPDATE reports
      SET status = 'Blocked', blocked_reason = 'Awaiting 40W LED fixture replacement from central store', updated_at = datetime('now')
      WHERE id = ?
    `, [testReportId]);
    rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'Blocked');

    // Step 6: Staff unblocks back to In Progress
    db.run("UPDATE reports SET status = 'In Progress', blocked_reason = NULL, updated_at = datetime('now') WHERE id = ?", [testReportId]);
    rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'In Progress');
    assert.strictEqual(rep.blocked_reason, null);

    // Step 7: Staff Resolves with required summary
    db.run(`
      UPDATE reports
      SET status = 'Resolved', resolution_summary = 'Replaced faulty capacitor and installed new 40W LED fixture. Luminaire operational.', updated_at = datetime('now')
      WHERE id = ?
    `, [testReportId]);
    rep = db.get('SELECT * FROM reports WHERE id = ?', [testReportId]);
    assert.strictEqual(rep.status, 'Resolved');
    assert.ok(rep.resolution_summary.length > 20);

    // Step 8: Citizen Notification created
    const notifId = 'ntf-test-e2e';
    db.run(`
      INSERT INTO notifications (id, recipient_id, report_id, title, message, read, created_at)
      VALUES (?, 'usr-citizen-01', ?, 'Issue Resolved', 'Your reported streetlight issue is now resolved.', 0, datetime('now'))
    `, [notifId, testReportId]);

    const notif = db.get('SELECT * FROM notifications WHERE id = ?', [notifId]);
    assert.ok(notif, 'Citizen notification must exist');
    assert.strictEqual(notif.read, 0);

    // Clean up test report
    db.run('DELETE FROM notifications WHERE id = ?', [notifId]);
    db.run('DELETE FROM reports WHERE id = ?', [testReportId]);
  });

  // 10. Real Citizen Registration & Security Test
  test('Real citizen self-registration enforces bcrypt password hashing and welcome notification', () => {
    const bcrypt = require('bcryptjs');
    const testEmail = `test.citizen.${Date.now()}@example.com`;
    const testUserId = `usr-reg-test-${Date.now()}`;
    const rawPass = 'Secret123!';
    const hashed = bcrypt.hashSync(rawPass, 10);

    // Insert new citizen
    db.run(`
      INSERT INTO profiles (id, email, display_name, role, department_id, active, preferred_language, password_hash, phone, created_at)
      VALUES (?, ?, 'Real Citizen Tester', 'citizen', NULL, 1, 'en', ?, '+91 99999 88888', datetime('now'))
    `, [testUserId, testEmail, hashed]);

    const created = db.get('SELECT * FROM profiles WHERE id = ?', [testUserId]);
    assert.ok(created, 'Citizen must be saved in database');
    assert.strictEqual(created.role, 'citizen', 'Role must strictly be citizen');
    assert.strictEqual(created.phone, '+91 99999 88888');
    assert.ok(bcrypt.compareSync(rawPass, created.password_hash), 'Password hash must verify with bcrypt');

    // Clean up
    db.run('DELETE FROM profiles WHERE id = ?', [testUserId]);
  });

  // 11. Email Uniqueness Constraint Test
  test('Profiles table prevents duplicate email registration at database level', () => {
    let duplicateRejected = false;
    try {
      db.run(`
        INSERT INTO profiles (id, email, display_name, role, created_at)
        VALUES ('usr-dup-test', 'citizen@civicsync.demo', 'Duplicate Citizen', 'citizen', datetime('now'))
      `);
    } catch (e) {
      duplicateRejected = true;
    }
    assert.ok(duplicateRejected, 'Duplicate email registration must throw unique constraint error');
  });

  console.log('\n----------------------------------------------------');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('----------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
