// Civic Resolve AI: Reports API Routes
// Enforces PRD FR-03, FR-06, FR-09, FR-13: Idempotent persistence, role filtering, citizen safety.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { analyzeReport } = require('../ai/analyzer');

// Bounding box for demo municipality (Hyderabad Demo Area)
const BOUNDS = {
  minLat: parseFloat(process.env.BOUNDS_MIN_LAT || '17.2000'),
  maxLat: parseFloat(process.env.BOUNDS_MAX_LAT || '17.6000'),
  minLng: parseFloat(process.env.BOUNDS_MIN_LNG || '78.2000'),
  maxLng: parseFloat(process.env.BOUNDS_MAX_LNG || '78.7000')
};

// GET /api/reports/categories - List available civic categories
router.get('/categories', (req, res) => {
  const categories = db.all(`
    SELECT c.id, c.name, c.department_id, d.name as department_name 
    FROM categories c
    JOIN departments d ON c.department_id = d.id
    WHERE c.active = 1
    ORDER BY c.name ASC
  `);
  res.json({ categories });
});

// POST /api/reports - Submit a new civic issue report
router.post('/', requireAuth, (req, res) => {
  const {
    title,
    description,
    categoryId,
    locationText,
    latitude,
    longitude,
    locationVerified = true,
    idempotencyKey,
    privacyNoticeAcknowledged = true,
    privacyNoticeVersion = '1.0'
  } = req.body;

  // 1. Stable Idempotency Check
  if (idempotencyKey) {
    const existing = db.get('SELECT * FROM reports WHERE idempotency_key = ?', [idempotencyKey]);
    if (existing) {
      return res.status(200).json({
        report: existing,
        isIdempotentReplay: true,
        message: 'Report already submitted with this idempotency key.'
      });
    }
  }

  // 2. Validate Description Length (20 - 2,000 characters)
  if (!description || description.trim().length < 20 || description.trim().length > 2000) {
    return res.status(400).json({
      error: 'Description must be between 20 and 2,000 characters long.'
    });
  }

  // 3. Validate Usable Location
  if (!locationText || locationText.trim().length < 5) {
    return res.status(400).json({
      error: 'A usable address or location description is required.'
    });
  }

  // 4. Boundary Verification
  let isOutOfBoundary = 0;
  const lat = latitude ? parseFloat(latitude) : null;
  const lng = longitude ? parseFloat(longitude) : null;
  if (lat && lng) {
    if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
      isOutOfBoundary = 1;
    }
  }

  // 5. Generate Title if empty
  let reportTitle = title ? title.trim() : '';
  if (!reportTitle) {
    reportTitle = description.trim().slice(0, 60);
    if (description.trim().length > 60) reportTitle += '...';
  }

  // 6. Retrieve open reports for duplicate candidate detection
  const existingReports = db.all(`
    SELECT r.id, r.reference_number, r.title, r.description, r.category_id, c.name as category_name,
           r.location_text, r.latitude, r.longitude
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    WHERE r.status NOT IN ('Resolved', 'Rejected', 'Withdrawn')
    LIMIT 100
  `);

  // 7. Deterministic Simulated AI Analysis
  const analysis = analyzeReport({
    id: null,
    description: description.trim(),
    userCategoryId: categoryId || null,
    locationText: locationText.trim(),
    latitude: lat,
    longitude: lng
  }, existingReports);

  // 8. Generate Unique Reference Number & ID
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const refNumber = `REP-${dateStr}-${randomSuffix}`;
  const reportId = 'rep-' + crypto.randomUUID().slice(0, 8);

  const finalCategoryId = categoryId || analysis.suggestedCategoryId || 'cat-other';
  const finalDepartmentId = analysis.suggestedDepartmentId || null;

  // 9. Atomic Persistence
  db.transaction(() => {
    // Insert Report
    db.run(`
      INSERT INTO reports (
        id, reference_number, citizen_id, title, description, category_id, department_id,
        location_text, latitude, longitude, location_verified, is_out_of_boundary,
        status, priority_score, priority_level, severity_factor, safety_factor, people_factor, duration_factor,
        safety_flag, safety_flag_reason, review_required, review_reason, analysis_state,
        suggested_category_id, suggested_department_id, confidence_score, analysis_reasoning,
        idempotency_key, privacy_acknowledged_at, privacy_notice_version, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        'Submitted', ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, datetime('now'), ?, datetime('now'), datetime('now')
      )
    `, [
      reportId, refNumber, req.user.id, reportTitle, description.trim(), finalCategoryId, finalDepartmentId,
      locationText.trim(), lat, lng, locationVerified ? 1 : 0, isOutOfBoundary,
      analysis.priorityScore, analysis.priorityLevel, analysis.severityFactor, analysis.safetyFactor, analysis.peopleFactor, analysis.durationFactor,
      analysis.safetyFlag, analysis.safetyFlagReason, analysis.reviewRequired, analysis.reviewReason, analysis.analysisState,
      analysis.suggestedCategoryId, analysis.suggestedDepartmentId, analysis.confidenceScore, analysis.analysisReasoning,
      idempotencyKey || ('key-' + reportId), privacyNoticeVersion
    ]);

    // Insert Report Event: Submitted
    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'submitted', 1, 'Issue reported by citizen with location details.', ?, datetime('now'))
    `, ['evt-' + crypto.randomUUID().slice(0, 8), reportId, req.user.id, JSON.stringify({ isOutOfBoundary, locationVerified })]);

    // Insert Report Event: AI Analyzed
    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, null, 'ai_analyzed', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      reportId,
      `Simulated AI analysis completed. Priority calculated as ${analysis.priorityLevel} (${analysis.priorityScore}/100).`,
      JSON.stringify({
        confidenceScore: analysis.confidenceScore,
        safetyFlag: analysis.safetyFlag,
        reviewRequired: analysis.reviewRequired
      })
    ]);

    // Insert Citizen Notification
    db.run(`
      INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))
    `, [
      'ntf-' + crypto.randomUUID().slice(0, 8),
      req.user.id,
      reportId,
      'Report Submitted Successfully',
      `Your report ${refNumber} has been received and analyzed by Civic Resolve AI. Status: Submitted.`,
      'notif-submit-' + reportId
    ]);
  });

  const savedReport = db.get(`
    SELECT r.*, c.name as category_name, d.name as department_name
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    WHERE r.id = ?
  `, [reportId]);

  res.status(201).json({
    report: savedReport,
    analysis: {
      ...analysis,
      duplicateCandidates: analysis.duplicateCandidates
    },
    warning: isOutOfBoundary ? 'Location appears outside primary municipality boundary. Flagged for Admin review.' : null
  });
});

// GET /api/reports - List reports filtered by user role and query
router.get('/', requireAuth, (req, res) => {
  const { status, categoryId, departmentId, priorityLevel, search } = req.query;

  let query = `
    SELECT r.*, c.name as category_name, d.name as department_name, p.display_name as citizen_name,
           staff.display_name as staff_name, pri.reference_number as primary_reference_number
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles p ON r.citizen_id = p.id
    LEFT JOIN profiles staff ON r.assigned_staff_id = staff.id
    LEFT JOIN reports pri ON r.primary_report_id = pri.id
    WHERE 1=1
  `;
  const params = [];

  // Enforce server-side role boundaries
  if (req.user.role === 'citizen') {
    query += ` AND r.citizen_id = ? `;
    params.push(req.user.id);
  } else if (req.user.role === 'staff') {
    query += ` AND r.assigned_staff_id = ? `;
    params.push(req.user.id);
  }
  // Admin sees all operational reports

  if (status) {
    query += ` AND r.status = ? `;
    params.push(status);
  }
  if (categoryId) {
    query += ` AND r.category_id = ? `;
    params.push(categoryId);
  }
  if (departmentId) {
    query += ` AND r.department_id = ? `;
    params.push(departmentId);
  }
  if (priorityLevel) {
    query += ` AND r.priority_level = ? `;
    params.push(priorityLevel);
  }
  if (search) {
    query += ` AND (r.title LIKE ? OR r.description LIKE ? OR r.reference_number LIKE ? OR r.location_text LIKE ?) `;
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  query += ` ORDER BY r.updated_at DESC, r.priority_score DESC `;

  const reports = db.all(query, params);

  // Compute summary metrics for dashboard cards
  let activeCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;
  let needsAttentionCount = 0;

  for (const r of reports) {
    if (r.status === 'Resolved') {
      resolvedCount++;
    } else if (r.status === 'In Progress') {
      inProgressCount++;
      activeCount++;
    } else if (r.status !== 'Rejected' && r.status !== 'Withdrawn' && r.status !== 'Duplicate') {
      activeCount++;
    }

    if (r.status === 'Blocked' || r.review_required === 1 || r.safety_flag === 1) {
      needsAttentionCount++;
    }
  }

  res.json({
    reports,
    counts: {
      total: reports.length,
      active: activeCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      needsAttention: needsAttentionCount
    }
  });
});

// GET /api/reports/:id - Retrieve detailed report with timeline
router.get('/:id', requireAuth, (req, res) => {
  const report = db.get(`
    SELECT r.*, c.name as category_name, d.name as department_name, p.display_name as citizen_name,
           staff.display_name as staff_name, pri.reference_number as primary_reference_number
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles p ON r.citizen_id = p.id
    LEFT JOIN profiles staff ON r.assigned_staff_id = staff.id
    LEFT JOIN reports pri ON r.primary_report_id = pri.id
    WHERE r.id = ?
  `, [req.params.id]);

  if (!report) {
    return res.status(404).json({ error: 'Report not found.' });
  }

  // Authorization check:
  // Citizen can view if it's their report, or if it is the primary report of their confirmed duplicate
  if (req.user.role === 'citizen') {
    if (report.citizen_id !== req.user.id) {
      // Check if user has a duplicate report pointing to this report
      const isPrimaryOfUser = db.get('SELECT id FROM reports WHERE primary_report_id = ? AND citizen_id = ?', [report.id, req.user.id]);
      if (!isPrimaryOfUser) {
        return res.status(403).json({ error: 'Access denied: You do not own this report.' });
      }
    }
  } else if (req.user.role === 'staff') {
    // Staff can only view reports assigned to them
    if (report.assigned_staff_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this report.' });
    }
  }

  // Get timeline events
  let eventsQuery = `
    SELECT re.id, re.event_type, re.message, re.created_at, pr.display_name as actor_name, pr.role as actor_role
    FROM report_events re
    LEFT JOIN profiles pr ON re.actor_id = pr.id
    WHERE re.report_id = ?
  `;
  const eventsParams = [report.id];

  if (req.user.role === 'citizen') {
    eventsQuery += ` AND re.citizen_visible = 1 `;
  }
  eventsQuery += ` ORDER BY re.created_at ASC `;
  const timeline = db.all(eventsQuery, eventsParams);

  // Get photos
  const photos = db.all(`
    SELECT id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, created_at
    FROM photo_metadata
    WHERE report_id = ?
    ORDER BY created_at ASC
  `, [report.id]);

  // If duplicate, get primary summary
  let primaryReport = null;
  if (report.primary_report_id) {
    primaryReport = db.get(`
      SELECT id, reference_number, title, status, priority_level, updated_at
      FROM reports WHERE id = ?
    `, [report.primary_report_id]);
  }

  res.json({
    report,
    timeline,
    photos,
    primaryReport
  });
});

// POST /api/reports/:id/follow-up - Citizen adds follow-up note
router.post('/:id/follow-up', requireAuth, (req, res) => {
  const report = db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (req.user.role === 'citizen' && report.citizen_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { note } = req.body;
  if (!note || note.trim().length < 5) {
    return res.status(400).json({ error: 'Follow-up note must be at least 5 characters.' });
  }

  const eventId = 'evt-' + crypto.randomUUID().slice(0, 8);
  db.run(`
    INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
    VALUES (?, ?, ?, 'follow_up', 1, ?, ?, datetime('now'))
  `, [eventId, report.id, req.user.id, `Citizen Follow-up: ${note.trim()}`, JSON.stringify({ authorRole: req.user.role })]);

  db.run('UPDATE reports SET updated_at = datetime("now") WHERE id = ?', [report.id]);

  res.json({ success: true, message: 'Follow-up note recorded on timeline.' });
});

// POST /api/reports/:id/request-action - Citizen requests correction, challenge, withdrawal, or reopening
router.post('/:id/request-action', requireAuth, (req, res) => {
  const report = db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (req.user.role === 'citizen' && report.citizen_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const { actionType, reason, proposedValue } = req.body;
  if (!['correction', 'challenge', 'withdrawal', 'reopening'].includes(actionType)) {
    return res.status(400).json({ error: 'Invalid action request type.' });
  }
  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a clear reason (minimum 10 characters).' });
  }

  // Create an event and set review_required = 1 for admin attention
  db.transaction(() => {
    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'citizen_request', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      report.id,
      req.user.id,
      `Citizen Request (${actionType.toUpperCase()}): ${reason.trim()}`,
      JSON.stringify({ actionType, proposedValue, requestedAt: new Date().toISOString() })
    ]);

    db.run(`
      UPDATE reports
      SET review_required = 1,
          review_reason = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [`Citizen ${actionType} request: ${reason.trim().slice(0, 80)}`, report.id]);
  });

  res.json({
    success: true,
    message: `Your ${actionType} request has been submitted for administrative review.`
  });
});

module.exports = router;
