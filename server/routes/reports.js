// Civic Resolve AI: Reports API Routes
// Enforces PRD FR-03, FR-06, FR-09, FR-13: Idempotent persistence, role filtering, citizen safety.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { analyzeReport } = require('../ai/analyzer');
const { calculateSlaDeadline, getSlaStatus } = require('../services/escalation');

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

// GET /api/reports/public/digital-twin - Privacy-safe public telemetry for Civic Digital Twin (PRD F2)
router.get('/public/digital-twin', (req, res) => {
  try {
    const { department, status } = req.query;

    let query = `
      SELECT r.id, r.reference_number, r.title, r.status,
             r.latitude, r.longitude, r.location_text,
             r.priority_level, r.created_at, r.updated_at,
             c.name as category_name, d.name as department_name,
             COALESCE(r.community_votes, 0) as community_votes
      FROM reports r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
        AND r.status NOT IN ('Rejected', 'Withdrawn')
    `;
    const params = [];

    if (department && department !== 'all') {
      query += ` AND d.name = ? `;
      params.push(department);
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        query += ` AND r.status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Blocked') `;
      } else if (status === 'resolved') {
        query += ` AND r.status = 'Resolved' `;
      } else {
        query += ` AND r.status = ? `;
        params.push(status);
      }
    }

    query += ` ORDER BY r.updated_at DESC LIMIT 200 `;

    const rawRows = db.all(query, params);

    // Apply privacy protection:
    // 1. Coordinates: Round to 4 decimal places (~11m), with deterministic micro-offset to prevent exact residential door identification.
    // 2. Location Text: Strip exact flat/house numbers, preserve landmark/ward.
    // 3. Exclude citizen profile and private notes.
    const sanitizedReports = rawRows.map(r => {
      let hash = 0;
      for (let i = 0; i < r.id.length; i++) hash = ((hash << 5) - hash) + r.id.charCodeAt(i);
      const jitterLat = ((hash % 100) / 100000) * 0.3;
      const jitterLng = (((hash >> 2) % 100) / 100000) * 0.3;

      const roundedLat = parseFloat((r.latitude + jitterLat).toFixed(4));
      const roundedLng = parseFloat((r.longitude + jitterLng).toFixed(4));

      const locationTokens = (r.location_text || 'Metropolitan Ward Area')
        .split(',')
        .map(t => t.trim())
        .filter(t => !/^(flat|plot|h\.?no|door|house|apt|room)\b/i.test(t));
      const sanitizedLocation = locationTokens.length > 0 ? locationTokens.join(', ') : r.location_text;

      return {
        id: r.id,
        referenceNumber: r.reference_number,
        title: r.title,
        category: r.category_name || 'General Civic Issue',
        department: r.department_name || 'Municipal Administration',
        status: r.status,
        priorityLevel: r.priority_level || 'Medium',
        latitude: roundedLat,
        longitude: roundedLng,
        locationText: sanitizedLocation,
        communityVotes: r.community_votes || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    });

    res.json({
      governance: 'PRD F2 Privacy-Safe Civic Telemetry — Jittered Coordinates, Zero Citizen PII',
      total: sanitizedReports.length,
      reports: sanitizedReports
    });
  } catch (err) {
    console.error('[Digital Twin Error]', err);
    res.status(500).json({ error: 'Failed to retrieve digital twin telemetry.' });
  }
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
  const slaDeadline = calculateSlaDeadline(new Date().toISOString(), analysis.priorityLevel, finalCategoryId, analysis.safetyFlag);

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
        idempotency_key, privacy_acknowledged_at, privacy_notice_version, sla_deadline, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        'Submitted', ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, datetime('now'), ?, ?, datetime('now'), datetime('now')
      )
    `, [
      reportId, refNumber, req.user.id, reportTitle, description.trim(), finalCategoryId, finalDepartmentId,
      locationText.trim(), lat, lng, locationVerified ? 1 : 0, isOutOfBoundary,
      analysis.priorityScore, analysis.priorityLevel, analysis.severityFactor, analysis.safetyFactor, analysis.peopleFactor, analysis.durationFactor,
      analysis.safetyFlag, analysis.safetyFlagReason, analysis.reviewRequired, analysis.reviewReason, analysis.analysisState,
      analysis.suggestedCategoryId, analysis.suggestedDepartmentId, analysis.confidenceScore, analysis.analysisReasoning,
      idempotencyKey || ('key-' + reportId), privacyNoticeVersion, slaDeadline
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
  const rawPhotos = db.all(`
    SELECT id, storage_path, file_name, content_type, size_bytes, is_resolution_photo, vision_clues_json, confidence_score, created_at
    FROM photo_metadata
    WHERE report_id = ?
    ORDER BY created_at ASC
  `, [report.id]);

  const photos = rawPhotos.map(p => {
    let clues = [];
    if (p.vision_clues_json) {
      try { clues = JSON.parse(p.vision_clues_json); } catch (_) {}
    }
    return {
      ...p,
      visionClues: clues
    };
  });

  // If duplicate, get primary summary
  let primaryReport = null;
  if (report.primary_report_id) {
    primaryReport = db.get(`
      SELECT id, reference_number, title, status, priority_level, updated_at
      FROM reports WHERE id = ?
    `, [report.primary_report_id]);
  }

  // PRD F7: Check if requesting citizen has upvoted this report
  let hasVoted = false;
  if (req.user && req.user.role === 'citizen') {
    const v = db.get('SELECT id FROM community_votes WHERE report_id = ? AND citizen_id = ?', [report.id, req.user.id]);
    hasVoted = Boolean(v);
  }

  // PRD F5: Compute SLA metrics
  const sla = getSlaStatus(report);

  // PRD Section 4 & 5: Appeals and Feedback
  const appeals = db.all(`
    SELECT a.*, p.display_name as decider_name
    FROM report_appeals a
    LEFT JOIN profiles p ON a.decided_by = p.id
    WHERE a.report_id = ?
    ORDER BY a.created_at DESC
  `, [report.id]);
  const feedback = db.get('SELECT * FROM report_feedback WHERE report_id = ?', [report.id]);

  res.json({
    report: {
      ...report,
      hasVoted,
      communityVotes: report.community_votes || 0,
      sla
    },
    timeline,
    photos,
    primaryReport,
    appeals,
    feedback: feedback || null
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

// --------------------------------------------------------------------------
// PRD F7: Community Impact Voting Endpoints
// --------------------------------------------------------------------------

// POST /api/reports/:id/vote - Citizen casts Community Impact Upvote
router.post('/:id/vote', requireAuth, (req, res) => {
  // 1. Role enforcement: Only citizens can vote
  if (req.user.role !== 'citizen') {
    return res.status(403).json({ error: 'Access denied: Only citizens can cast community impact votes.' });
  }

  const reportId = req.params.id;
  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  // 2. Cannot vote on inactive or duplicate reports
  if (['Withdrawn', 'Duplicate'].includes(report.status)) {
    return res.status(400).json({ error: `Cannot upvote report in '${report.status}' status.` });
  }

  // 3. Citizen cannot upvote their own report
  if (report.citizen_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot upvote your own reported civic issue.' });
  }

  // 4. Duplicate vote check
  const existingVote = db.get('SELECT id FROM community_votes WHERE report_id = ? AND citizen_id = ?', [reportId, req.user.id]);
  if (existingVote) {
    return res.status(409).json({ error: 'You have already upvoted this civic issue.' });
  }

  // 5. Atomic vote insertion and count update
  let newVoteCount = 0;
  const voteId = 'vot-' + crypto.randomUUID().slice(0, 8);

  db.transaction(() => {
    db.run(`
      INSERT INTO community_votes (id, report_id, citizen_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [voteId, reportId, req.user.id]);

    db.run(`
      UPDATE reports
      SET community_votes = (SELECT COUNT(*) FROM community_votes WHERE report_id = ?),
          updated_at = datetime('now')
      WHERE id = ?
    `, [reportId, reportId]);

    newVoteCount = db.get('SELECT community_votes FROM reports WHERE id = ?', [reportId])?.community_votes || 0;
  });

  res.status(201).json({
    success: true,
    voted: true,
    communityVotes: newVoteCount,
    message: 'Community impact vote recorded successfully.'
  });
});

// DELETE /api/reports/:id/vote - Citizen removes previously cast upvote
router.delete('/:id/vote', requireAuth, (req, res) => {
  if (req.user.role !== 'citizen') {
    return res.status(403).json({ error: 'Access denied: Only citizens can manage votes.' });
  }

  const reportId = req.params.id;
  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const existingVote = db.get('SELECT id FROM community_votes WHERE report_id = ? AND citizen_id = ?', [reportId, req.user.id]);
  if (!existingVote) {
    return res.status(404).json({ error: 'You have not upvoted this civic issue.' });
  }

  let newVoteCount = 0;
  db.transaction(() => {
    db.run('DELETE FROM community_votes WHERE report_id = ? AND citizen_id = ?', [reportId, req.user.id]);

    db.run(`
      UPDATE reports
      SET community_votes = (SELECT COUNT(*) FROM community_votes WHERE report_id = ?),
          updated_at = datetime('now')
      WHERE id = ?
    `, [reportId, reportId]);

    newVoteCount = db.get('SELECT community_votes FROM reports WHERE id = ?', [reportId])?.community_votes || 0;
  });

  res.json({
    success: true,
    voted: false,
    communityVotes: newVoteCount,
    message: 'Community impact vote removed successfully.'
  });
});

// GET /api/reports/:id/vote-status - Check current user's voting status
router.get('/:id/vote-status', (req, res) => {
  const reportId = req.params.id;
  const report = db.get('SELECT community_votes FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  let hasVoted = false;
  let uid = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      uid = decoded.userId || decoded.id;
    } catch (_) {}
  } else if (req.headers['x-demo-user-id']) {
    uid = req.headers['x-demo-user-id'];
  }

  if (uid) {
    const v = db.get('SELECT id FROM community_votes WHERE report_id = ? AND citizen_id = ?', [reportId, uid]);
    hasVoted = Boolean(v);
  }

  res.json({
    reportId,
    hasVoted,
    communityVotes: report.community_votes || 0
  });
});

// --------------------------------------------------------------------------
// PRD F5: SLA Status Endpoint
// --------------------------------------------------------------------------

// GET /api/reports/:id/sla - Get live SLA deadline, countdown, and escalation state
router.get('/:id/sla', (req, res) => {
  const report = db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  const sla = getSlaStatus(report);
  res.json({
    reportId: report.id,
    sla
  });
});

// --------------------------------------------------------------------------
// PRD Section 4 & 5: Citizen Appeals & Review
// --------------------------------------------------------------------------

const handleAppealSubmission = (req, res) => {
  if (req.user.role !== 'citizen') {
    return res.status(403).json({ error: 'Access denied: Only citizens can submit appeals on their civic reports.' });
  }

  const report = db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (report.citizen_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied: You can only appeal decisions on your own reports.' });
  }

  if (!['Resolved', 'Rejected'].includes(report.status)) {
    return res.status(400).json({
      error: `Cannot submit appeal for report in '${report.status}' status. Appeals are only permitted for Resolved or Rejected reports.`
    });
  }

  const { reason, appealType } = req.body;
  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a clear and detailed appeal reason (minimum 10 characters).' });
  }

  // Prevent multiple simultaneous pending appeals
  const pendingAppeal = db.get("SELECT id FROM report_appeals WHERE report_id = ? AND status = 'Pending'", [report.id]);
  if (pendingAppeal) {
    return res.status(409).json({ error: 'An appeal is already pending administrative review for this report.' });
  }

  const appealId = 'app-' + crypto.randomUUID().slice(0, 8);
  const type = ['rejection', 'resolution', 'general'].includes(appealType)
    ? appealType
    : (report.status === 'Rejected' ? 'rejection' : 'resolution');

  db.transaction(() => {
    db.run(`
      INSERT INTO report_appeals (id, report_id, citizen_id, reason, appeal_type, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'Pending', datetime('now'))
    `, [appealId, report.id, req.user.id, reason.trim(), type]);

    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'appeal_submitted', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      report.id,
      req.user.id,
      `Citizen Appeal Submitted (${type.toUpperCase()}): ${reason.trim().slice(0, 75)}`,
      JSON.stringify({ appealId, appealType: type })
    ]);

    db.run(`
      UPDATE reports
      SET review_required = 1,
          review_reason = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [`Citizen Appeal (${type.toUpperCase()}): ${reason.trim().slice(0, 50)}`, report.id]);

    // Send notifications to admins
    const admins = db.all("SELECT id FROM profiles WHERE role = 'admin' AND active = 1");
    for (const adm of admins) {
      db.run(`
        INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
        VALUES (?, ?, ?, 'New Citizen Appeal', ?, 0, ?, datetime('now'))
      `, [
        'ntf-' + crypto.randomUUID().slice(0, 8),
        adm.id,
        report.id,
        `Citizen submitted an appeal for report #${report.reference_number}.`,
        `notif-app-${appealId}-${adm.id}`
      ]);
    }
  });

  const savedAppeal = db.get('SELECT * FROM report_appeals WHERE id = ?', [appealId]);
  res.status(201).json({
    success: true,
    message: 'Your appeal has been submitted for administrative arbitration.',
    appeal: savedAppeal
  });
};

router.post('/:id/appeal', requireAuth, handleAppealSubmission);
router.post('/:id/appeals', requireAuth, handleAppealSubmission);

// GET /api/reports/:id/appeals - Get appeal history for report
router.get('/:id/appeals', requireAuth, (req, res) => {
  const report = db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (req.user.role === 'citizen' && report.citizen_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const appeals = db.all(`
    SELECT a.*, p.display_name as decider_name
    FROM report_appeals a
    LEFT JOIN profiles p ON a.decided_by = p.id
    WHERE a.report_id = ?
    ORDER BY a.created_at DESC
  `, [report.id]);

  res.json({ appeals });
});

// --------------------------------------------------------------------------
// PRD Section 4 #48: Citizen Satisfaction Rating & Feedback
// --------------------------------------------------------------------------

// POST /api/reports/:id/feedback - Submit 1-5 star rating & feedback on resolved report
router.post('/:id/feedback', requireAuth, (req, res) => {
  if (req.user.role !== 'citizen') {
    return res.status(403).json({ error: 'Access denied: Only citizens can submit satisfaction ratings.' });
  }

  const report = db.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (report.citizen_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied: You can only rate your own reports.' });
  }

  if (report.status !== 'Resolved') {
    return res.status(400).json({ error: 'Satisfaction feedback can only be submitted for Resolved reports.' });
  }

  const { rating, comment } = req.body;
  const numRating = parseInt(rating, 10);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5 stars.' });
  }

  // Prevent duplicate feedback
  const existing = db.get('SELECT id FROM report_feedback WHERE report_id = ?', [report.id]);
  if (existing) {
    return res.status(409).json({ error: 'You have already submitted satisfaction feedback for this resolved report.' });
  }

  const feedbackId = 'fdb-' + crypto.randomUUID().slice(0, 8);
  db.transaction(() => {
    db.run(`
      INSERT INTO report_feedback (id, report_id, citizen_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [feedbackId, report.id, req.user.id, numRating, comment ? comment.trim() : null]);

    const stars = '★'.repeat(numRating) + '☆'.repeat(5 - numRating);
    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'feedback_submitted', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      report.id,
      req.user.id,
      `Citizen Satisfaction Rating: ${stars} (${numRating}/5 stars).`,
      JSON.stringify({ rating: numRating, comment: comment ? comment.trim() : null })
    ]);
  });

  const saved = db.get('SELECT * FROM report_feedback WHERE id = ?', [feedbackId]);
  res.status(201).json({
    success: true,
    message: 'Thank you for your feedback! Your rating has been recorded.',
    feedback: saved
  });
});

// GET /api/reports/:id/feedback - Get feedback for report
router.get('/:id/feedback', (req, res) => {
  const feedback = db.get('SELECT * FROM report_feedback WHERE report_id = ?', [req.params.id]);
  res.json({ feedback: feedback || null });
});

module.exports = router;
