// Civic Resolve AI: Maintenance Calendar API Routes
// Handles scheduling, viewing upcoming/overdue tasks, date tracking, staff assignments, and task management.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dbHelper = require('../db');
const { db } = dbHelper;
const { optionalAuth } = require('../middleware/auth');

router.use(optionalAuth);

/**
 * Format today as YYYY-MM-DD for date comparisons
 */
function getTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * GET /api/maintenance
 * Retrieve confirmed maintenance schedules with optional filters and live KPI stats
 */
router.get('/', (req, res) => {
  try {
    const { department, status, search, month, staffId, assignedToMe } = req.query;
    const today = getTodayStr();

    let query = 'SELECT * FROM maintenance_schedules WHERE 1=1';
    const params = [];

    // Filter by authenticated staff assignment if requested
    if (assignedToMe === 'true' && req.user && req.user.role === 'staff') {
      query += ' AND (assigned_staff_id = ? OR (department_id = ? AND assigned_staff_id IS NULL))';
      params.push(req.user.id, req.user.department_id);
    } else if (staffId) {
      query += ' AND assigned_staff_id = ?';
      params.push(staffId);
    }

    if (department && department !== 'all') {
      query += ' AND (LOWER(department_name) LIKE ? OR department_id = ?)';
      params.push(`%${department.toLowerCase()}%`, department);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(title) LIKE ? OR LOWER(area) LIKE ? OR LOWER(official_source) LIKE ? OR LOWER(description) LIKE ? OR LOWER(assigned_staff_name) LIKE ?)';
      params.push(term, term, term, term, term);
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += ' AND (start_date LIKE ? OR end_date LIKE ?)';
      params.push(`${month}%`, `${month}%`);
    }

    // Sort order: In Progress first, then Overdue, then Upcoming, then Completed
    query += ' ORDER BY start_date ASC';

    const allRows = db.prepare(query).all(...params);

    // Calculate dynamic stats across all confirmed records
    const allRecords = db.prepare('SELECT * FROM maintenance_schedules').all();
    const stats = {
      total: allRecords.length,
      inProgress: allRecords.filter(r => r.status === 'In Progress').length,
      upcoming: allRecords.filter(r => r.status === 'Scheduled' && r.start_date >= today).length,
      overdue: allRecords.filter(r => (r.status === 'Delayed' || r.status === 'Overdue' || (r.end_date < today && r.status !== 'Completed'))).length,
      completed: allRecords.filter(r => r.status === 'Completed').length
    };

    // Filter by logical status if requested
    let filtered = allRows;
    if (status && status !== 'all') {
      if (status === 'in_progress' || status === 'In Progress') {
        filtered = allRows.filter(r => r.status === 'In Progress');
      } else if (status === 'upcoming' || status === 'Scheduled') {
        filtered = allRows.filter(r => r.status === 'Scheduled');
      } else if (status === 'overdue' || status === 'Delayed') {
        filtered = allRows.filter(r => r.status === 'Delayed' || r.status === 'Overdue' || (r.end_date < today && r.status !== 'Completed'));
      } else if (status === 'completed' || status === 'Completed') {
        filtered = allRows.filter(r => r.status === 'Completed');
      }
    }

    // If caller is public citizen (unauthenticated or citizen role), redact administrative internal IDs
    const isInternalUser = req.user && (req.user.role === 'admin' || req.user.role === 'staff');
    const sanitizedSchedules = filtered.map(item => {
      if (isInternalUser) return item;
      return {
        id: item.id,
        title: item.title,
        department_id: item.department_id,
        department_name: item.department_name,
        area: item.area,
        start_date: item.start_date,
        end_date: item.end_date,
        status: item.status,
        official_source: item.official_source,
        description: item.description,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    });

    res.json({
      success: true,
      schedules: sanitizedSchedules,
      stats,
      serverToday: today
    });
  } catch (err) {
    console.error('[Maintenance API Error]', err);
    res.status(500).json({ error: 'Failed to retrieve maintenance schedules: ' + err.message });
  }
});

/**
 * GET /api/maintenance/:id
 * Retrieve details of a specific maintenance activity
 */
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    const isInternalUser = req.user && (req.user.role === 'admin' || req.user.role === 'staff');
    if (!isInternalUser) {
      delete item.created_by;
      delete item.assigned_staff_id;
    }

    res.json({ success: true, schedule: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/maintenance
 * Schedule a new municipal maintenance activity with optional staff assignment
 */
router.post('/', (req, res) => {
  try {
    // If authenticated, citizen users cannot create maintenance schedules
    if (req.user && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Unauthorized: Only municipal administrators can schedule maintenance activities.' });
    }

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
        id, title, department_id, department_name, area, start_date, end_date, status, official_source, description, assigned_staff_id, assigned_staff_name, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    const created = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    res.status(201).json({
      success: true,
      message: 'Maintenance activity successfully scheduled.',
      schedule: created
    });
  } catch (err) {
    console.error('[Maintenance Create Error]', err);
    res.status(500).json({ error: 'Failed to create maintenance schedule: ' + err.message });
  }
});

/**
 * PUT or PATCH /api/maintenance/:id
 * Full update of scheduled maintenance task (Admin permission)
 */
function handleFullUpdate(req, res) {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    if (req.user && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Citizens cannot modify maintenance schedules.' });
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

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedDeptId = departmentId !== undefined ? departmentId : existing.department_id;
    const updatedDeptName = departmentName !== undefined ? departmentName.trim() : existing.department_name;
    const updatedArea = area !== undefined ? area.trim() : existing.area;
    const updatedStart = startDate !== undefined ? startDate : existing.start_date;
    const updatedEnd = endDate !== undefined ? endDate : existing.end_date;
    const updatedDesc = description !== undefined ? description.trim() : existing.description;
    const updatedRef = officialSource !== undefined ? officialSource.trim() : existing.official_source;

    let updatedStatus = status !== undefined ? (status === 'Overdue' ? 'Delayed' : status) : existing.status;
    const validStatuses = ['Scheduled', 'In Progress', 'Completed', 'Delayed'];
    if (!validStatuses.includes(updatedStatus)) {
      updatedStatus = existing.status;
    }

    let finalStaffId = existing.assigned_staff_id;
    let finalStaffName = existing.assigned_staff_name;

    if (assignedStaffId !== undefined) {
      if (assignedStaffId === null || assignedStaffId === '') {
        finalStaffId = null;
        finalStaffName = null;
      } else {
        const staff = db.prepare('SELECT id, display_name FROM profiles WHERE id = ?').get(assignedStaffId);
        if (staff) {
          finalStaffId = staff.id;
          finalStaffName = staff.display_name;
        }
      }
    } else if (assignedStaffName !== undefined) {
      finalStaffName = assignedStaffName ? assignedStaffName.trim() : null;
    }

    if (updatedStart > updatedEnd) {
      return res.status(400).json({ error: 'Start date cannot be after end date.' });
    }

    db.prepare(`
      UPDATE maintenance_schedules
      SET title = ?, department_id = ?, department_name = ?, area = ?, start_date = ?, end_date = ?,
          status = ?, official_source = ?, description = ?, assigned_staff_id = ?, assigned_staff_name = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updatedTitle,
      updatedDeptId,
      updatedDeptName,
      updatedArea,
      updatedStart,
      updatedEnd,
      updatedStatus,
      updatedRef,
      updatedDesc,
      finalStaffId,
      finalStaffName,
      id
    );

    const updated = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    res.json({
      success: true,
      message: 'Maintenance schedule successfully updated.',
      schedule: updated
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update maintenance schedule: ' + err.message });
  }
}

router.put('/:id', handleFullUpdate);

/**
 * PATCH or POST /api/maintenance/:id/status
 * Update status of scheduled maintenance task (e.g. In Progress, Completed, Delayed)
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

    // Role check: Citizen cannot update status
    if (req.user && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Unauthorized: Citizens cannot update maintenance execution status.' });
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

router.patch('/:id/status', handleStatusUpdate);
router.post('/:id/status', handleStatusUpdate);

/**
 * DELETE /api/maintenance/:id
 * Remove or cancel a scheduled maintenance work order
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Maintenance activity not found.' });
    }

    if (req.user && req.user.role === 'citizen') {
      return res.status(403).json({ error: 'Unauthorized: Citizens cannot cancel municipal maintenance activities.' });
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
