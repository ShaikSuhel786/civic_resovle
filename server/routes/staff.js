// Civic Resolve AI: Department Staff API Routes
// Enforces PRD FR-06, FR-07: Access restricted ONLY to currently assigned reports; status validations.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All endpoints in this router require 'staff' role
router.use(requireAuth, requireRole('staff'));

// GET /api/staff/reports - List only reports currently assigned to the authenticated staff member
router.get('/reports', (req, res) => {
  const reports = db.all(`
    SELECT r.*, c.name as category_name, d.name as department_name, p.display_name as citizen_name
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles p ON r.citizen_id = p.id
    WHERE r.assigned_staff_id = ?
    ORDER BY r.priority_score DESC, r.updated_at DESC
  `, [req.user.id]);

  res.json({ reports });
});

// POST /api/staff/reports/:id/status - Update permitted status for assigned report
router.post('/reports/:id/status', (req, res) => {
  const reportId = req.params.id;
  const newStatus = req.body.newStatus || req.body.status;
  const { reason, resolutionSummary } = req.body;

  // Verify report belongs to this staff member
  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (report.assigned_staff_id !== req.user.id) {
    return res.status(403).json({
      error: 'Security boundary violation: Staff can only update reports currently assigned to them.'
    });
  }

  // Validate state machine transitions
  if (newStatus === 'In Progress') {
    if (!['Assigned', 'Blocked'].includes(report.status)) {
      return res.status(400).json({ error: `Cannot transition from '${report.status}' to 'In Progress'.` });
    }
  } else if (newStatus === 'Blocked') {
    if (report.status !== 'In Progress') {
      return res.status(400).json({ error: 'Report must be In Progress before it can be marked as Blocked.' });
    }
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Marking a report as Blocked requires a detailed reason (minimum 10 characters).' });
    }
  } else if (newStatus === 'Resolved') {
    if (report.status !== 'In Progress' && report.status !== 'Assigned') {
      return res.status(400).json({ error: `Report must be In Progress to be Resolved (current status is '${report.status}').` });
    }
    if (!resolutionSummary || resolutionSummary.trim().length < 15) {
      return res.status(400).json({ error: 'Resolution requires a comprehensive summary of actions taken (minimum 15 characters).' });
    }
    // PRD F4: Proof of Resolution — Staff must upload an after-repair photo before marking resolved
    const resolutionPhoto = db.get(`
      SELECT id, file_name, storage_path, created_at
      FROM photo_metadata
      WHERE report_id = ? AND is_resolution_photo = 1
    `, [reportId]);
    if (!resolutionPhoto) {
      return res.status(400).json({
        error: 'Proof of Resolution Required (PRD F4): An after-repair photo must be attached before marking this complaint resolved.'
      });
    }
  } else {
    return res.status(400).json({ error: `Invalid staff status transition '${newStatus}'.` });
  }

  db.transaction(() => {
    // 1. Update report
    let blockedReason = report.blocked_reason;
    let finalResolution = report.resolution_summary;

    if (newStatus === 'Blocked') {
      blockedReason = reason.trim();
    } else if (newStatus === 'In Progress') {
      blockedReason = null; // Unblocked
    } else if (newStatus === 'Resolved') {
      finalResolution = resolutionSummary.trim();
    }

    db.run(`
      UPDATE reports
      SET status = ?,
          blocked_reason = ?,
          resolution_summary = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [newStatus, blockedReason, finalResolution, reportId]);

    // 2. Add Timeline Event
    let eventMessage = `Status updated to ${newStatus}.`;
    if (newStatus === 'Blocked') {
      eventMessage = `Issue Blocked: ${reason.trim()}`;
    } else if (newStatus === 'Resolved') {
      eventMessage = `Issue Resolved: ${resolutionSummary.trim()}`;
    } else if (newStatus === 'In Progress' && report.status === 'Blocked') {
      eventMessage = `Work resumed on issue. Issue unblocked.`;
    }

    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'status_changed', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      reportId,
      req.user.id,
      eventMessage,
      JSON.stringify({ previousStatus: report.status, newStatus, reason, resolutionSummary })
    ]);

    // 3. Notify Citizen
    let notifTitle = `Report Status: ${newStatus}`;
    let notifMsg = `Your issue ${report.reference_number} is now ${newStatus}.`;
    if (newStatus === 'Resolved') {
      notifTitle = 'Civic Issue Resolved!';
      notifMsg = `Your report ${report.reference_number} has been resolved: ${resolutionSummary.trim()}`;
    } else if (newStatus === 'Blocked') {
      notifTitle = 'Issue Progress Update (Blocked)';
      notifMsg = `Work on report ${report.reference_number} is temporarily delayed: ${reason.trim()}`;
    }

    db.run(`
      INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))
    `, [
      'ntf-' + crypto.randomUUID().slice(0, 8),
      report.citizen_id,
      reportId,
      notifTitle,
      notifMsg,
      `notif-status-${reportId}-${newStatus}-${Date.now()}`
    ]);
  });

  res.json({ success: true, message: `Report status updated to ${newStatus}.` });
});

// POST /api/staff/reports/:id/notes - Add private internal note (visible only to assigned staff & admin)
router.post('/reports/:id/notes', (req, res) => {
  const reportId = req.params.id;
  const { note } = req.body;

  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (report.assigned_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied: You are not assigned to this report.' });
  }

  if (!note || note.trim().length < 5) {
    return res.status(400).json({ error: 'Note must be at least 5 characters.' });
  }

  const noteId = 'not-' + crypto.randomUUID().slice(0, 8);
  db.run(`
    INSERT INTO private_notes (id, report_id, author_id, note, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `, [noteId, reportId, req.user.id, note.trim()]);

  res.json({ success: true, message: 'Private note recorded successfully.' });
});

// GET /api/staff/reports/:id/notes - View private notes for assigned report
router.get('/reports/:id/notes', (req, res) => {
  const reportId = req.params.id;
  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (report.assigned_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const notes = db.all(`
    SELECT n.*, p.display_name as author_name, p.role as author_role
    FROM private_notes n
    JOIN profiles p ON n.author_id = p.id
    WHERE n.report_id = ?
    ORDER BY n.created_at ASC
  `, [reportId]);

  res.json({ notes });
});

// ================================================================
// CIVIC MAINTENANCE CALENDAR: STAFF WORK QUEUE ENDPOINTS
// ================================================================

// GET /api/staff/maintenance - List maintenance activities assigned to this staff member or their department
router.get('/maintenance', (req, res) => {
  try {
    const schedules = db.all(`
      SELECT * FROM maintenance_schedules
      WHERE assigned_staff_id = ? OR (department_id = ? AND (assigned_staff_id IS NULL OR assigned_staff_id = ''))
      ORDER BY 
        CASE status 
          WHEN 'In Progress' THEN 1 
          WHEN 'Delayed' THEN 2 
          WHEN 'Scheduled' THEN 3 
          ELSE 4 END, 
        start_date ASC
    `, [req.user.id, req.user.department_id]);

    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve staff maintenance tasks: ' + err.message });
  }
});

// POST /api/staff/maintenance/:id/status - Update execution status for assigned maintenance activity
function handleStaffMaintStatus(req, res) {
  try {
    const maintId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Delayed'];
    const newStatus = status === 'Overdue' ? 'Delayed' : status;
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const task = db.get('SELECT * FROM maintenance_schedules WHERE id = ?', [maintId]);
    if (!task) {
      return res.status(404).json({ error: 'Maintenance task not found.' });
    }

    // Verify staff boundary: must be assigned staff or in the same department
    const isAssigned = task.assigned_staff_id === req.user.id;
    const isDeptMatch = req.user.department_id && task.department_id === req.user.department_id;
    if (!isAssigned && !isDeptMatch) {
      return res.status(403).json({
        error: 'Security boundary: You can only update maintenance tasks assigned to you or within your department.'
      });
    }

    // If task was unassigned in this department, claim assignment upon status action
    let staffId = task.assigned_staff_id || req.user.id;
    let staffName = task.assigned_staff_name || req.user.display_name;

    db.run(`
      UPDATE maintenance_schedules
      SET status = ?, assigned_staff_id = ?, assigned_staff_name = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [newStatus, staffId, staffName, maintId]);

    const updated = db.get('SELECT * FROM maintenance_schedules WHERE id = ?', [maintId]);

    res.json({
      success: true,
      message: `Maintenance task status updated to ${newStatus}.`,
      schedule: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update maintenance task: ' + err.message });
  }
}

router.post('/maintenance/:id/status', handleStaffMaintStatus);
router.patch('/maintenance/:id/status', handleStaffMaintStatus);

module.exports = router;
