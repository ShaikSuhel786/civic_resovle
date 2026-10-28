// Civic Resolve AI: Maintenance Calendar API Routes
// Handles scheduling, viewing upcoming/overdue tasks, date tracking, and task management.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dbHelper = require('../db');
const { db } = dbHelper;

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
    const { department, status, search, month } = req.query;
    const today = getTodayStr();

    let query = 'SELECT * FROM maintenance_schedules WHERE 1=1';
    const params = [];

    if (department && department !== 'all') {
      query += ' AND (LOWER(department_name) LIKE ? OR department_id = ?)';
      params.push(`%${department.toLowerCase()}%`, department);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(title) LIKE ? OR LOWER(area) LIKE ? OR LOWER(official_source) LIKE ? OR LOWER(description) LIKE ?)';
      params.push(term, term, term, term);
    }

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query += ' AND (start_date LIKE ? OR end_date LIKE ?)';
      params.push(`${month}%`, `${month}%`);
    }

    // Sort order: In Progress first, then Overdue, then Upcoming, then Completed
    query += ' ORDER BY start_date ASC';

    const allRows = db.prepare(query).all(...params);

    // Calculate dynamic stats
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

    res.json({
      success: true,
      schedules: filtered,
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
    res.json({ success: true, schedule: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/maintenance
 * Schedule a new municipal maintenance activity
 */
router.post('/', (req, res) => {
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
      description
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

    const id = `maint-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    const generatedRef = officialSource && officialSource.trim()
      ? officialSource.trim()
      : `MW-${new Date().getFullYear()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const stmt = db.prepare(`
      INSERT INTO maintenance_schedules (
        id, title, department_id, department_name, area, start_date, end_date, status, official_source, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      description.trim()
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

    db.prepare(`
      UPDATE maintenance_schedules
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, id);

    const updated = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(id);

    res.json({
      success: true,
      message: `Status updated to ${status}.`,
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
