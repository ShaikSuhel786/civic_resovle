// Civic Resolve AI: Maintenance Calendar API Routes
// Handles scheduling, viewing upcoming/overdue tasks, date tracking, staff assignments, and task management.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dbHelper = require('../db');
const { db } = dbHelper;
const { requireAuth, requireRole, optionalAuth } = require('../middleware/auth');

/**
 * Format today as YYYY-MM-DD for date comparisons
 */
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * GET /api/maintenance
 * Retrieve confirmed maintenance schedules with optional filters and live KPI stats (Public Read)
 */
router.get('/', optionalAuth, (req, res) => {
  try {
    const { department, status, search, month, staffId, assignedToMe } = req.query;
    const today = getTodayStr();

    let query = 'SELECT * FROM maintenance_schedules WHERE 1=1';
    const params = [];

    // Filter by department
    if (department && department !== 'all') {
      query += ' AND (department_id = ? OR department_name LIKE ?)';
      params.push(department, `%${department}%`);
    }

    // Filter by status
    if (status && status !== 'all') {
      if (status === 'overdue') {
        query += " AND status NOT IN ('Completed') AND end_date < ?";
        params.push(today);
      } else if (status === 'upcoming') {
        query += ' AND status = ? AND start_date > ?';
        params.push('Scheduled', today);
      } else if (status === 'in_progress') {
        query += " AND status = 'In Progress'";
      } else if (status === 'delayed') {
        query += " AND status = 'Delayed'";
      } else if (status === 'completed') {
        query += " AND status = 'Completed'";
      } else {
        query += ' AND status = ?';
        params.push(status);
      }
    }

    // Search query across title, description, and area
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ' AND (title LIKE ? OR description LIKE ? OR area LIKE ? OR official_source LIKE ?)';
      params.push(term, term, term, term);
    }

    // Filter by month (YYYY-MM format)
    if (month) {
      query += " AND (strftime('%Y-%m', start_date) = ? OR strftime('%Y-%m', end_date) = ?)";
      params.push(month, month);
    }

    // Filter by assigned staff ID
    if (staffId) {
      query += ' AND assigned_staff_id = ?';
      params.push(staffId);
    }

    // Assigned to current logged-in staff member
    if (assignedToMe === 'true' && req.user && req.user.role === 'staff') {
      query += ' AND assigned_staff_id = ?';
      params.push(req.user.id);
    }

    query += ' ORDER BY start_date ASC, created_at DESC';

    const schedules = db.prepare(query).all(...params);

    // Compute live operational KPI stats
    const totalCount = db.prepare('SELECT count(*) as count FROM maintenance_schedules').get()?.count || 0;
    const inProgressCount = db.prepare("SELECT count(*) as count FROM maintenance_schedules WHERE status = 'In Progress'").get()?.count || 0;
    const completedCount = db.prepare("SELECT count(*) as count FROM maintenance_schedules WHERE status = 'Completed'").get()?.count || 0;
    const delayedCount = db.prepare("SELECT count(*) as count FROM maintenance_schedules WHERE status = 'Delayed'").get()?.count || 0;
    const overdueCount = db.prepare("SELECT count(*) as count FROM maintenance_schedules WHERE status NOT IN ('Completed') AND end_date < ?").get(today)?.count || 0;
    const upcomingCount = db.prepare("SELECT count(*) as count FROM maintenance_schedules WHERE status = 'Scheduled' AND start_date > ?").get(today)?.count || 0;

    res.json({
      success: true,
      count: schedules.length,
      schedules,
      stats: {
        total: totalCount,
        inProgress: inProgressCount,
        upcoming: upcomingCount,
        overdue: overdueCount,
        delayed: delayedCount,
        completed: completedCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve maintenance schedules: ' + err.message });
  }
});

/**
 * GET /api/maintenance/:id
 * Retrieve specific maintenance activity details (Public Read)
 */
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const { id } = req.params;
    const schedule = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    if (!schedule) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    // Compute dynamic flags
    const today = getTodayStr();
    const isOverdue = schedule.status !== 'Completed' && schedule.end_date < today;
    const isUpcoming = schedule.status === 'Scheduled' && schedule.start_date > today;

    res.json({
      success: true,
      schedule: {
        ...schedule,
        isOverdue,
        isUpcoming
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve maintenance details: ' + err.message });
  }
});

/**
 * POST /api/maintenance
 * Schedule a new municipal maintenance activity (Privileged Admin Mutation)
 */
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const {
      title,
      departmentId,
      departmentName,
      area,
      startDate,
      endDate,
      status = 'Scheduled',
      officialSource,
      description,
      assignedStaffId,
      assignedStaffName
    } = req.body;

    // Validation
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Maintenance project title is required.' });
    }
    if (!departmentName || !departmentName.trim()) {
      return res.status(400).json({ error: 'Responsible department name is required.' });
    }
    if (!area || !area.trim()) {
      return res.status(400).json({ error: 'Target area / location is required.' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date cannot be after end date.' });
    }
    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'Work scope description must be at least 10 characters long.' });
    }

    const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Delayed'];
    let finalStatus = status === 'Overdue' ? 'Delayed' : status;
    if (!validStatuses.includes(finalStatus)) {
      finalStatus = 'Scheduled';
    }

    // Resolve assigned staff member if provided
    let finalStaffId = null;
    let finalStaffName = null;

    if (assignedStaffId) {
      const staffProfile = db.prepare("SELECT id, display_name, department_id, role, active FROM profiles WHERE id = ?").get(assignedStaffId);
      if (staffProfile) {
        if (staffProfile.role !== 'staff' && staffProfile.role !== 'admin') {
          return res.status(400).json({ error: 'Assigned user must have a staff or admin role.' });
        }
        if (!staffProfile.active) {
          return res.status(400).json({ error: 'Cannot assign a deactivated staff member.' });
        }
        finalStaffId = staffProfile.id;
        finalStaffName = staffProfile.display_name;
      }
    } else if (assignedStaffName && assignedStaffName.trim()) {
      finalStaffName = assignedStaffName.trim();
    }

    const id = `maint-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const generatedRef = officialSource && officialSource.trim()
      ? officialSource.trim()
      : `MW-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const createdBy = req.user ? req.user.id : null;

    const stmt = db.prepare(`
      INSERT INTO maintenance_schedules (
        id, title, department_id, department_name, area, start_date, end_date,
        status, official_source, description, assigned_staff_id, assigned_staff_name, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      id,
      title.trim(),
      departmentId || null,
      departmentName.trim(),
      area.trim(),
      startDate,
      endDate,
      finalStatus,
      generatedRef,
      description.trim(),
      finalStaffId,
      finalStaffName,
      createdBy
    );

    const createdSchedule = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    // If staff was assigned, send in-app notification to the assigned staff member
    if (finalStaffId) {
      try {
        const notifId = `notif-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
        db.prepare(`
          INSERT INTO notifications (id, recipient_id, title, message, read, created_at)
          VALUES (?, ?, ?, ?, 0, datetime('now'))
        `).run(
          notifId,
          finalStaffId,
          'New Municipal Maintenance Task Assigned',
          `You have been assigned to oversee maintenance work: "${title.trim()}" in ${area.trim()} scheduled from ${startDate} to ${endDate}.`
        );
      } catch (notifErr) {
        console.warn('[Maintenance] Staff notification dispatch notice:', notifErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Maintenance activity scheduled successfully.',
      schedule: createdSchedule
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to schedule maintenance activity: ' + err.message });
  }
});

/**
 * PUT /api/maintenance/:id
 * Full update of maintenance schedule (Admin only)
 */
function handleFullUpdate(req, res) {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    const {
      title,
      departmentId,
      departmentName,
      area,
      startDate,
      endDate,
      status,
      officialSource,
      description,
      assignedStaffId,
      assignedStaffName
    } = req.body;

    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'Title cannot be empty.' });
    }
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: 'Start date cannot be after end date.' });
    }

    // Resolve assigned staff member if provided
    let finalStaffId = existing.assigned_staff_id;
    let finalStaffName = existing.assigned_staff_name;

    if (assignedStaffId !== undefined) {
      if (assignedStaffId === null || assignedStaffId === '') {
        finalStaffId = null;
        finalStaffName = null;
      } else {
        const staffProfile = db.prepare("SELECT id, display_name, role, active FROM profiles WHERE id = ?").get(assignedStaffId);
        if (staffProfile) {
          if (staffProfile.role !== 'staff' && staffProfile.role !== 'admin') {
            return res.status(400).json({ error: 'Assigned user must have a staff or admin role.' });
          }
          finalStaffId = staffProfile.id;
          finalStaffName = staffProfile.display_name;
        }
      }
    } else if (assignedStaffName !== undefined) {
      finalStaffName = assignedStaffName ? assignedStaffName.trim() : null;
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedDeptId = departmentId !== undefined ? departmentId : existing.department_id;
    const updatedDeptName = departmentName !== undefined ? departmentName.trim() : existing.department_name;
    const updatedArea = area !== undefined ? area.trim() : existing.area;
    const updatedStart = startDate !== undefined ? startDate : existing.start_date;
    const updatedEnd = endDate !== undefined ? endDate : existing.end_date;
    const updatedStatus = status !== undefined ? (status === 'Overdue' ? 'Delayed' : status) : existing.status;
    const updatedSource = officialSource !== undefined ? officialSource.trim() : existing.official_source;
    const updatedDesc = description !== undefined ? description.trim() : existing.description;

    db.prepare(`
      UPDATE maintenance_schedules
      SET title = ?, department_id = ?, department_name = ?, area = ?,
          start_date = ?, end_date = ?, status = ?, official_source = ?, description = ?,
          assigned_staff_id = ?, assigned_staff_name = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updatedTitle, updatedDeptId, updatedDeptName, updatedArea,
      updatedStart, updatedEnd, updatedStatus, updatedSource, updatedDesc,
      finalStaffId, finalStaffName, id
    );

    const updated = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Maintenance schedule updated successfully.',
      schedule: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update maintenance schedule: ' + err.message });
  }
}

router.put('/:id', requireAuth, requireRole('admin'), handleFullUpdate);

/**
 * PATCH or POST /api/maintenance/:id/status
 * Update status of scheduled maintenance task (Admin or Staff within mapped department)
 */
function handleStatusUpdate(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Delayed'];
    const newStatus = status === 'Overdue' ? 'Delayed' : status;
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const existing = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    // Role check: Admin can update any; Staff can only update their assigned or department tasks
    if (req.user.role === 'staff') {
      const isAssigned = existing.assigned_staff_id === req.user.id;
      const isDeptMatch = req.user.department_id && existing.department_id === req.user.department_id;
      if (!isAssigned && !isDeptMatch) {
        return res.status(403).json({
          error: 'Security boundary: You can only update maintenance tasks assigned to you or within your department.'
        });
      }
    }

    db.prepare(`
      UPDATE maintenance_schedules
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, id);

    const updated = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    res.json({
      success: true,
      message: `Status updated to ${newStatus}.`,
      schedule: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status: ' + err.message });
  }
}

router.patch('/:id/status', requireAuth, requireRole(['admin', 'staff']), handleStatusUpdate);
router.post('/:id/status', requireAuth, requireRole(['admin', 'staff']), handleStatusUpdate);

/**
 * DELETE /api/maintenance/:id
 * Remove or cancel a scheduled maintenance work order (Admin only)
 */
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    db.prepare('DELETE FROM maintenance_schedules WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Maintenance activity successfully removed.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete maintenance activity: ' + err.message });
  }
});

module.exports = router;
