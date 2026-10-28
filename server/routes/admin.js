// Civic Resolve AI: Admin API Routes
// Enforces PRD FR-05, FR-06, FR-07, FR-08, FR-12: Action-first queues, mapped department assignment, audited transitions.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { checkEscalations } = require('../services/escalation');

// All endpoints in this router require 'admin' role
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/queues - Action-first Admin Dashboard queues
router.get('/queues', (req, res) => {
  // 1. Urgent Safety Alerts & High-Priority Unassigned
  const urgentQueue = db.all(`
    SELECT r.*, c.name as category_name, d.name as department_name, p.display_name as citizen_name
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles p ON r.citizen_id = p.id
    WHERE (r.safety_flag = 1 OR r.priority_score >= 80)
      AND r.status IN ('Submitted', 'Under Review')
    ORDER BY r.safety_flag DESC, r.priority_score DESC, r.created_at ASC
  `);

  // 2. Reports Requiring Review (low AI confidence, citizen challenges, unmapped dept, duplicates)
  const reviewQueue = db.all(`
    SELECT r.*, c.name as category_name, d.name as department_name, p.display_name as citizen_name
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles p ON r.citizen_id = p.id
    WHERE r.review_required = 1 AND r.status NOT IN ('Resolved', 'Rejected', 'Withdrawn')
    ORDER BY r.created_at ASC
  `);

  // 3. Blocked Issues
  const blockedQueue = db.all(`
    SELECT r.*, c.name as category_name, d.name as department_name, staff.display_name as staff_name
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles staff ON r.assigned_staff_id = staff.id
    WHERE r.status = 'Blocked'
    ORDER BY r.updated_at DESC
  `);

  // 4. Staff Workload Summary by Department
  const departmentWorkload = db.all(`
    SELECT d.id, d.name as department_name,
           COUNT(DISTINCT p.id) as staff_count,
           COUNT(DISTINCT CASE WHEN r.status IN ('Assigned', 'In Progress', 'Blocked') THEN r.id END) as active_workload,
           COUNT(DISTINCT CASE WHEN r.status = 'Resolved' THEN r.id END) as resolved_count
    FROM departments d
    LEFT JOIN profiles p ON p.department_id = d.id AND p.active = 1
    LEFT JOIN reports r ON r.department_id = d.id
    GROUP BY d.id, d.name
    ORDER BY active_workload DESC
  `);

  // 5. Citizen Appeals Queue (Pending arbitration)
  const appealsQueue = db.all(`
    SELECT a.*, r.reference_number as report_reference, r.title as report_title, r.status as report_status,
           c.name as category_name, d.name as department_name, p.display_name as citizen_name, p.email as citizen_email
    FROM report_appeals a
    JOIN reports r ON a.report_id = r.id
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    JOIN profiles p ON a.citizen_id = p.id
    WHERE a.status = 'Pending'
    ORDER BY a.created_at ASC
  `);

  // 6. SLA Escalations Queue
  const escalationsQueue = db.all(`
    SELECT r.*, c.name as category_name, d.name as department_name, staff.display_name as staff_name, p.display_name as citizen_name
    FROM reports r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    LEFT JOIN profiles staff ON r.assigned_staff_id = staff.id
    LEFT JOIN profiles p ON r.citizen_id = p.id
    WHERE r.escalation_level >= 1 AND r.status NOT IN ('Resolved', 'Rejected', 'Withdrawn')
    ORDER BY r.escalation_level DESC, r.sla_deadline ASC
  `);

  res.json({
    urgentQueue,
    reviewQueue,
    blockedQueue,
    appealsQueue,
    escalationsQueue,
    departmentWorkload
  });
});

// GET /api/admin/staff - Get active staff grouped by department
router.get('/staff', (req, res) => {
  const staffMembers = db.all(`
    SELECT p.id, p.display_name, p.email, p.department_id, d.name as department_name,
           COUNT(r.id) as current_assigned_count
    FROM profiles p
    JOIN departments d ON p.department_id = d.id
    LEFT JOIN reports r ON r.assigned_staff_id = p.id AND r.status IN ('Assigned', 'In Progress', 'Blocked')
    WHERE p.role = 'staff' AND p.active = 1
    GROUP BY p.id, p.display_name, p.email, p.department_id, d.name
    ORDER BY d.name ASC, p.display_name ASC
  `);
  res.json({ staff: staffMembers });
});

// POST /api/admin/reports/:id/assign - Assign or reassign report to active staff member
router.post('/reports/:id/assign', (req, res) => {
  const { staffId, reason } = req.body;
  const reportId = req.params.id;

  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  if (['Resolved', 'Rejected', 'Withdrawn', 'Duplicate'].includes(report.status)) {
    return res.status(400).json({ error: `Cannot assign report in terminal or inactive status '${report.status}'.` });
  }

  // Validate Staff
  const staff = db.get("SELECT * FROM profiles WHERE id = ? AND role = 'staff'", [staffId]);
  if (!staff) {
    return res.status(400).json({ error: 'Invalid staff member.' });
  }
  if (!staff.active) {
    return res.status(400).json({ error: 'Cannot assign to a deactivated staff member.' });
  }

  // Verify staff belongs to report's mapped department
  if (report.department_id && staff.department_id !== report.department_id) {
    const reportDept = db.get('SELECT name FROM departments WHERE id = ?', [report.department_id]);
    const staffDept = db.get('SELECT name FROM departments WHERE id = ?', [staff.department_id]);
    return res.status(400).json({
      error: `Department mismatch! Report belongs to '${reportDept ? reportDept.name : report.department_id}', but staff member is in '${staffDept ? staffDept.name : staff.department_id}'. Admin can only assign staff from the mapped department.`
    });
  }

  const isReassignment = Boolean(report.assigned_staff_id && report.assigned_staff_id !== staffId);
  if (isReassignment && (!reason || reason.trim().length < 5)) {
    return res.status(400).json({ error: 'Reassignment requires an audited reason (minimum 5 characters).' });
  }

  const previousStaffId = report.assigned_staff_id;
  const newStatus = 'Assigned';

  db.transaction(() => {
    // 1. Deactivate old assignments if any
    if (previousStaffId) {
      db.run('UPDATE assignments SET active = 0, ended_at = datetime("now") WHERE report_id = ? AND active = 1', [reportId]);
    }

    // 2. Insert new assignment
    const assignId = 'asg-' + crypto.randomUUID().slice(0, 8);
    db.run(`
      INSERT INTO assignments (id, report_id, staff_id, assigned_by, assigned_at, reason, active)
      VALUES (?, ?, ?, ?, datetime('now'), ?, 1)
    `, [assignId, reportId, staffId, req.user.id, reason || 'Initial assignment']);

    // 3. Update Report
    db.run(`
      UPDATE reports
      SET assigned_staff_id = ?,
          status = ?,
          review_required = 0,
          review_reason = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `, [staffId, newStatus, reportId]);

    // 4. Report Event
    const eventMsg = isReassignment
      ? `Reassigned to ${staff.display_name}. Reason: ${reason}`
      : `Assigned to department staff: ${staff.display_name}.`;
    
    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'assigned', 1, ?, ?, datetime('now'))
    `, ['evt-' + crypto.randomUUID().slice(0, 8), reportId, req.user.id, eventMsg, JSON.stringify({ staffId, isReassignment })]);

    // 5. Audit Event
    db.run(`
      INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
      VALUES (?, ?, ?, 'reports', ?, ?, ?, ?, datetime('now'))
    `, [
      'aud-' + crypto.randomUUID().slice(0, 8),
      req.user.id,
      isReassignment ? 'REASSIGN_STAFF' : 'ASSIGN_STAFF',
      reportId,
      JSON.stringify({ assignedStaffId: previousStaffId, status: report.status }),
      JSON.stringify({ assignedStaffId: staffId, status: newStatus }),
      reason || 'Staff assignment'
    ]);

    // 6. Notify Citizen
    db.run(`
      INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
      VALUES (?, ?, ?, 'Report Assigned', ?, 0, ?, datetime('now'))
    `, [
      'ntf-' + crypto.randomUUID().slice(0, 8),
      report.citizen_id,
      reportId,
      `Your report ${report.reference_number} has been assigned to our field department team.`,
      `notif-assign-${reportId}-${Date.now()}`
    ]);
  });

  res.json({
    success: true,
    message: isReassignment ? 'Report successfully reassigned.' : 'Report successfully assigned to staff member.'
  });
});

// POST /api/admin/reports/:id/status - Move report to Under Review or Reject
router.post('/reports/:id/status', (req, res) => {
  const { newStatus, reason } = req.body;
  const reportId = req.params.id;

  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  // Only allowed Admin status transitions:
  // Submitted -> Under Review
  // Submitted / Under Review -> Rejected (requires category and reason)
  // Rejected -> Under Review (Audited Admin Recovery)
  if (newStatus === 'Under Review') {
    if (!['Submitted', 'Rejected', 'Duplicate'].includes(report.status)) {
      return res.status(400).json({ error: `Cannot move report in status '${report.status}' to 'Under Review'.` });
    }
  } else if (newStatus === 'Rejected') {
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Rejection requires a detailed reason for the citizen (minimum 10 characters).' });
    }
  } else {
    return res.status(400).json({ error: 'Invalid administrative status transition.' });
  }

  db.transaction(() => {
    db.run(`
      UPDATE reports
      SET status = ?,
          rejected_reason = ?,
          review_required = 0,
          updated_at = datetime('now')
      WHERE id = ?
    `, [newStatus, newStatus === 'Rejected' ? reason.trim() : report.rejected_reason, reportId]);

    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'status_changed', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      reportId,
      req.user.id,
      newStatus === 'Rejected' ? `Report Rejected: ${reason}` : `Status changed to Under Review.`,
      JSON.stringify({ previousStatus: report.status, newStatus, reason })
    ]);

    db.run(`
      INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
      VALUES (?, ?, 'ADMIN_STATUS_CHANGE', 'reports', ?, ?, ?, ?, datetime('now'))
    `, [
      'aud-' + crypto.randomUUID().slice(0, 8),
      req.user.id,
      reportId,
      JSON.stringify({ status: report.status }),
      JSON.stringify({ status: newStatus }),
      reason || 'Status update by admin'
    ]);

    if (newStatus === 'Rejected') {
      db.run(`
        INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
        VALUES (?, ?, ?, 'Report Rejected', ?, 0, ?, datetime('now'))
      `, [
        'ntf-' + crypto.randomUUID().slice(0, 8),
        report.citizen_id,
        reportId,
        `Your report ${report.reference_number} was rejected. Reason: ${reason}`,
        `notif-reject-${reportId}`
      ]);
    }
  });

  res.json({ success: true, message: `Report status updated to ${newStatus}.` });
});

// POST /api/admin/reports/:id/clear-safety-flag - Audited clear of safety hazard flag
router.post('/reports/:id/clear-safety-flag', (req, res) => {
  const { reason } = req.body;
  const reportId = req.params.id;

  if (!reason || reason.trim().length < 10) {
    return res.status(400).json({ error: 'Safety flag cannot be cleared without a recorded reason (minimum 10 characters).' });
  }

  const report = db.get('SELECT * FROM reports WHERE id = ?', [reportId]);
  if (!report) return res.status(404).json({ error: 'Report not found.' });

  db.transaction(() => {
    db.run(`
      UPDATE reports
      SET safety_flag = 0,
          review_required = 0,
          review_reason = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `, [reportId]);

    db.run(`
      INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
      VALUES (?, ?, 'CLEAR_SAFETY_FLAG', 'reports', ?, ?, ?, ?, datetime('now'))
    `, [
      'aud-' + crypto.randomUUID().slice(0, 8),
      req.user.id,
      reportId,
      JSON.stringify({ safetyFlag: report.safety_flag, reason: report.safety_flag_reason }),
      JSON.stringify({ safetyFlag: 0 }),
      reason
    ]);

    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'hazard_cleared', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      reportId,
      req.user.id,
      `Safety hazard flag reviewed and cleared by Municipal Admin. Note: ${reason}`,
      JSON.stringify({ reason })
    ]);
  });

  res.json({ success: true, message: 'Safety hazard flag cleared and recorded in audit log.' });
});

// POST /api/admin/reports/:id/confirm-duplicate - Link duplicate report to primary canonical report
router.post('/reports/:id/confirm-duplicate', (req, res) => {
  const duplicateId = req.params.id;
  const { primaryId, reason } = req.body;

  if (!primaryId) return res.status(400).json({ error: 'Primary report ID is required.' });
  if (duplicateId === primaryId) return res.status(400).json({ error: 'A report cannot be marked as a duplicate of itself.' });

  const duplicateReport = db.get('SELECT * FROM reports WHERE id = ?', [duplicateId]);
  const primaryReport = db.get('SELECT * FROM reports WHERE id = ?', [primaryId]);

  if (!duplicateReport || !primaryReport) {
    return res.status(404).json({ error: 'Duplicate or primary report not found.' });
  }

  // Prevent duplicate chains: Primary cannot itself be a duplicate
  if (primaryReport.primary_report_id) {
    return res.status(400).json({ error: 'The chosen target report is already a duplicate. Multi-hop chains are not permitted.' });
  }

  db.transaction(() => {
    // 1. Record duplicate relationship
    const dupRelId = 'dup-' + crypto.randomUUID().slice(0, 8);
    db.run(`
      INSERT INTO duplicate_relationships (id, duplicate_report_id, primary_report_id, status, reason, confirmed_by, created_at)
      VALUES (?, ?, ?, 'Confirmed', ?, ?, datetime('now'))
      ON CONFLICT(duplicate_report_id) DO UPDATE SET
        primary_report_id = excluded.primary_report_id,
        status = 'Confirmed',
        reason = excluded.reason,
        confirmed_by = excluded.confirmed_by,
        reversed_at = NULL
    `, [dupRelId, duplicateId, primaryId, reason || 'Confirmed duplicate report by Admin', req.user.id]);

    // 2. Update duplicate report status
    db.run(`
      UPDATE reports
      SET status = 'Duplicate',
          primary_report_id = ?,
          review_required = 0,
          updated_at = datetime('now')
      WHERE id = ?
    `, [primaryId, duplicateId]);

    // 3. Insert report event for citizen
    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'duplicate_linked', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      duplicateId,
      req.user.id,
      `Report confirmed as duplicate. Linked to canonical report ${primaryReport.reference_number}.`,
      JSON.stringify({ primaryId, primaryRef: primaryReport.reference_number })
    ]);

    // 4. Audit event
    db.run(`
      INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
      VALUES (?, ?, 'CONFIRM_DUPLICATE', 'reports', ?, ?, ?, ?, datetime('now'))
    `, [
      'aud-' + crypto.randomUUID().slice(0, 8),
      req.user.id,
      duplicateId,
      JSON.stringify({ status: duplicateReport.status }),
      JSON.stringify({ status: 'Duplicate', primaryReportId: primaryId }),
      reason || 'Duplicate confirmed'
    ]);

    // 5. Notify Citizen with primary link
    db.run(`
      INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
      VALUES (?, ?, ?, 'Duplicate Identified', ?, 0, ?, datetime('now'))
    `, [
      'ntf-' + crypto.randomUUID().slice(0, 8),
      duplicateReport.citizen_id,
      duplicateId,
      `Your report was confirmed as a duplicate of ${primaryReport.reference_number}. You can track progress on the primary issue.`,
      `notif-dup-${duplicateId}`
    ]);
  });

  res.json({ success: true, message: 'Duplicate relationship confirmed.' });
});

// POST /api/admin/reports/:id/reverse-duplicate - Reverse duplicate relationship
router.post('/reports/:id/reverse-duplicate', (req, res) => {
  const duplicateId = req.params.id;
  const { reason } = req.body;

  const report = db.get('SELECT * FROM reports WHERE id = ?', [duplicateId]);
  if (!report || report.status !== 'Duplicate') {
    return res.status(400).json({ error: 'Report is not an active duplicate.' });
  }

  db.transaction(() => {
    db.run(`
      UPDATE duplicate_relationships
      SET status = 'Reversed',
          reversed_at = datetime('now')
      WHERE duplicate_report_id = ?
    `, [duplicateId]);

    db.run(`
      UPDATE reports
      SET status = 'Under Review',
          primary_report_id = NULL,
          review_required = 1,
          review_reason = 'Duplicate status reversed. Admin review required.',
          updated_at = datetime('now')
      WHERE id = ?
    `, [duplicateId]);

    db.run(`
      INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
      VALUES (?, ?, ?, 'duplicate_reversed', 1, ?, ?, datetime('now'))
    `, [
      'evt-' + crypto.randomUUID().slice(0, 8),
      duplicateId,
      req.user.id,
      `Duplicate status was reversed by Admin. Report restored to independent review.`,
      JSON.stringify({ reason })
    ]);

    db.run(`
      INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
      VALUES (?, ?, 'REVERSE_DUPLICATE', 'reports', ?, ?, ?, ?, datetime('now'))
    `, [
      'aud-' + crypto.randomUUID().slice(0, 8),
      req.user.id,
      duplicateId,
      JSON.stringify({ status: 'Duplicate', primaryReportId: report.primary_report_id }),
      JSON.stringify({ status: 'Under Review' }),
      reason || 'Admin duplicate reversal'
    ]);
  });

  res.json({ success: true, message: 'Duplicate link reversed. Report returned to Under Review.' });
});

// GET /api/admin/audit-logs - View privileged audit events
router.get('/audit-logs', (req, res) => {
  const logs = db.all(`
    SELECT a.*, p.display_name as actor_name, p.role as actor_role
    FROM audit_events a
    LEFT JOIN profiles p ON a.actor_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 100
  `);
  res.json({ auditLogs: logs });
});

// --------------------------------------------------------------------------
// PRD Section 4 & 5: Administrative Appeals Queue & Arbitration Endpoints
// --------------------------------------------------------------------------

// GET /api/admin/appeals - View all citizen appeals
router.get('/appeals', (req, res) => {
  const appeals = db.all(`
    SELECT a.*, r.reference_number as report_reference, r.title as report_title, r.status as report_status,
           c.name as category_name, d.name as department_name, p.display_name as citizen_name, p.email as citizen_email,
           decider.display_name as decider_name
    FROM report_appeals a
    JOIN reports r ON a.report_id = r.id
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN departments d ON r.department_id = d.id
    JOIN profiles p ON a.citizen_id = p.id
    LEFT JOIN profiles decider ON a.decided_by = decider.id
    ORDER BY CASE a.status WHEN 'Pending' THEN 1 ELSE 2 END, a.created_at DESC
  `);
  res.json({ appeals });
});

// POST /api/admin/appeals/:id/decide - Arbitrate citizen appeal (Approve -> Reopen, Reject -> Uphold)
router.post('/appeals/:id/decide', (req, res) => {
  const appealId = req.params.id;
  const { decision, adminNotes } = req.body;

  if (!['Approved', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: "Invalid appeal decision. Must be 'Approved' or 'Rejected'." });
  }

  const appeal = db.get(`
    SELECT a.*, r.reference_number as report_reference, r.status as report_status, r.citizen_id
    FROM report_appeals a
    JOIN reports r ON a.report_id = r.id
    WHERE a.id = ?
  `, [appealId]);

  if (!appeal) return res.status(404).json({ error: 'Appeal not found.' });

  if (appeal.status !== 'Pending') {
    return res.status(400).json({ error: `Appeal has already been decided (${appeal.status}).` });
  }

  db.transaction(() => {
    // 1. Update appeal record
    db.run(`
      UPDATE report_appeals
      SET status = ?,
          admin_notes = ?,
          decided_by = ?,
          decided_at = datetime('now')
      WHERE id = ?
    `, [decision, adminNotes ? adminNotes.trim() : null, req.user.id, appealId]);

    // 2. If Approved: Reopen report to Under Review for investigation
    if (decision === 'Approved') {
      db.run(`
        UPDATE reports
        SET status = 'Under Review',
            review_required = 0,
            review_reason = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `, [appeal.report_id]);

      db.run(`
        INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
        VALUES (?, ?, ?, 'appeal_approved', 1, ?, ?, datetime('now'))
      `, [
        'evt-' + crypto.randomUUID().slice(0, 8),
        appeal.report_id,
        req.user.id,
        `Citizen Appeal Approved by Municipal Administrator. Report reopened to Under Review. Notes: ${adminNotes ? adminNotes.trim() : 'Approved upon re-examination.'}`,
        JSON.stringify({ appealId, decision, adminNotes })
      ]);

      db.run(`
        INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
        VALUES (?, ?, 'APPROVE_APPEAL', 'report_appeals', ?, ?, ?, ?, datetime('now'))
      `, [
        'aud-' + crypto.randomUUID().slice(0, 8),
        req.user.id,
        appealId,
        JSON.stringify({ appealStatus: 'Pending', reportStatus: appeal.report_status }),
        JSON.stringify({ appealStatus: 'Approved', reportStatus: 'Under Review' }),
        adminNotes || 'Appeal approved'
      ]);

      // Notify citizen
      db.run(`
        INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
        VALUES (?, ?, ?, 'Appeal Approved: Issue Reopened', ?, 0, ?, datetime('now'))
      `, [
        'ntf-' + crypto.randomUUID().slice(0, 8),
        appeal.citizen_id,
        appeal.report_id,
        `Your appeal for report #${appeal.report_reference} was approved. The issue has been reopened for priority investigation.`,
        `notif-app-dec-${appealId}`
      ]);
    } else {
      // If Rejected: Uphold closure/rejection
      db.run(`
        UPDATE reports
        SET review_required = 0,
            review_reason = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `, [appeal.report_id]);

      db.run(`
        INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
        VALUES (?, ?, ?, 'appeal_rejected', 1, ?, ?, datetime('now'))
      `, [
        'evt-' + crypto.randomUUID().slice(0, 8),
        appeal.report_id,
        req.user.id,
        `Citizen Appeal Reviewed & Upheld: Original determination confirmed. Notes: ${adminNotes ? adminNotes.trim() : 'Upheld based on operational review.'}`,
        JSON.stringify({ appealId, decision, adminNotes })
      ]);

      db.run(`
        INSERT INTO audit_events (id, actor_id, action, entity_type, entity_id, before_state_json, after_state_json, reason, created_at)
        VALUES (?, ?, 'REJECT_APPEAL', 'report_appeals', ?, ?, ?, ?, datetime('now'))
      `, [
        'aud-' + crypto.randomUUID().slice(0, 8),
        req.user.id,
        appealId,
        JSON.stringify({ appealStatus: 'Pending' }),
        JSON.stringify({ appealStatus: 'Rejected' }),
        adminNotes || 'Appeal rejected'
      ]);

      // Notify citizen
      db.run(`
        INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
        VALUES (?, ?, ?, 'Appeal Decision', ?, 0, ?, datetime('now'))
      `, [
        'ntf-' + crypto.randomUUID().slice(0, 8),
        appeal.citizen_id,
        appeal.report_id,
        `Your appeal for report #${appeal.report_reference} was reviewed. The original determination has been upheld. Reason: ${adminNotes ? adminNotes.trim() : 'Operational review completed.'}`,
        `notif-app-dec-${appealId}`
      ]);
    }
  });

  const updatedAppeal = db.get('SELECT * FROM report_appeals WHERE id = ?', [appealId]);
  res.json({
    success: true,
    message: `Appeal decision recorded as '${decision}'.`,
    appeal: updatedAppeal
  });
});

// --------------------------------------------------------------------------
// PRD F5: Smart Escalation Trigger Endpoint
// --------------------------------------------------------------------------

// POST /api/admin/escalations/check - Run on-demand smart escalation evaluation
router.post('/escalations/check', (req, res) => {
  const result = checkEscalations();
  res.json({
    success: true,
    ...result
  });
});

module.exports = router;
