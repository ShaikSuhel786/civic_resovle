// Civic Resolve AI: Notifications API Routes
// Enforces PRD FR-10, DESIGN Section 9: Durable notification delivery, idempotency, privacy.

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/notifications - List user's notifications and unread count
router.get('/', requireAuth, (req, res) => {
  const notifications = db.all(`
    SELECT n.*, r.reference_number
    FROM notifications n
    LEFT JOIN reports r ON n.report_id = r.id
    WHERE n.recipient_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [req.user.id]);

  const unreadCount = db.get(`
    SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND read = 0
  `, [req.user.id]).count;

  res.json({
    unreadCount,
    notifications
  });
});

// POST /api/notifications/:id/read - Mark single notification as read
router.post('/:id/read', requireAuth, (req, res) => {
  const notif = db.get('SELECT * FROM notifications WHERE id = ? AND recipient_id = ?', [req.params.id, req.user.id]);
  if (!notif) return res.status(404).json({ error: 'Notification not found.' });

  db.run(`
    UPDATE notifications
    SET read = 1, read_at = datetime('now')
    WHERE id = ?
  `, [req.params.id]);

  res.json({ success: true, message: 'Notification marked as read.' });
});

// POST /api/notifications/mark-all-read - Mark all user notifications as read
router.post('/mark-all-read', requireAuth, (req, res) => {
  db.run(`
    UPDATE notifications
    SET read = 1, read_at = datetime('now')
    WHERE recipient_id = ? AND read = 0
  `, [req.user.id]);

  res.json({ success: true, message: 'All notifications marked as read.' });
});

// POST /api/notifications/jobs/retry - Admin-controlled batch retry of failed durable notification jobs
router.post('/jobs/retry', requireAuth, requireRole('admin'), (req, res) => {
  // Batch max 50 jobs
  const failedJobs = db.all(`
    SELECT * FROM notification_jobs
    WHERE status = 'Failed'
    ORDER BY next_eligible_retry_at ASC, created_at ASC
    LIMIT 50
  `);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  db.transaction(() => {
    for (const job of failedJobs) {
      try {
        // Re-check recipient active status
        const recipient = db.get('SELECT active FROM profiles WHERE id = ?', [job.recipient_id]);
        if (!recipient || !recipient.active) {
          db.run(`UPDATE notification_jobs SET status = 'Skipped', failure_reason = 'OPTED_OUT' WHERE id = ?`, [job.id]);
          skipped++;
          continue;
        }

        // Parse payload and insert notification safely
        const payload = JSON.parse(job.payload_json);
        const notifId = 'ntf-' + Math.random().toString(36).slice(2, 10);
        db.run(`
          INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))
          ON CONFLICT(idempotency_key) DO NOTHING
        `, [notifId, job.recipient_id, job.report_id, payload.title, payload.message, 'retry-' + job.id]);

        db.run(`UPDATE notification_jobs SET status = 'Delivered', updated_at = datetime('now') WHERE id = ?`, [job.id]);
        succeeded++;
      } catch (err) {
        db.run(`UPDATE notification_jobs SET attempts = attempts + 1, failure_reason = ? WHERE id = ?`, [err.message, job.id]);
        failed++;
      }
    }
  });

  res.json({
    batchTotal: failedJobs.length,
    succeeded,
    skipped,
    failed,
    message: `Processed ${failedJobs.length} jobs: ${succeeded} delivered, ${skipped} skipped, ${failed} failed.`
  });
});

module.exports = router;
