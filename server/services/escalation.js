// Civic Resolve AI: Smart Escalation Engine (PRD F5)
// Evaluates deadline-aware reminders, pre-deadline warnings, and SLA breach escalations.

const crypto = require('crypto');
const db = require('../db');

/**
 * Computes official SLA deadline ISO string based on priority, category, and safety flags.
 */
function calculateSlaDeadline(createdAt, priorityLevel, categoryId, safetyFlag) {
  const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now();
  let hours = 168; // Default: 7 days

  if (safetyFlag || priorityLevel === 'Urgent') {
    hours = 24; // Critical hazards: 24 hours
  } else if (priorityLevel === 'High') {
    hours = 72; // High priority: 72 hours (3 days)
  } else if (categoryId === 'cat-sanitation' || categoryId === 'cat-garbage' || categoryId === 'cat-electrical' || categoryId === 'cat-streetlights') {
    hours = 48; // Sanitation / electrical outages: 48 hours
  } else if (priorityLevel === 'Low') {
    hours = 336; // Low priority / cosmetic: 14 days
  } else {
    hours = 168; // Standard medium: 7 days
  }

  return new Date(createdTime + hours * 3600 * 1000).toISOString();
}

/**
 * Returns SLA metrics and status details for a given report.
 */
function getSlaStatus(report) {
  if (!report) return null;

  const now = Date.now();
  const createdAt = report.created_at ? new Date(report.created_at).getTime() : now;
  let deadline = report.sla_deadline;

  if (!deadline) {
    deadline = calculateSlaDeadline(report.created_at, report.priority_level, report.category_id, report.safety_flag);
  }

  const deadlineTime = new Date(deadline).getTime();
  const totalDurationMs = Math.max(1, deadlineTime - createdAt);
  const elapsedMs = Math.max(0, now - createdAt);
  const remainingMs = deadlineTime - now;
  const ratioElapsed = elapsedMs / totalDurationMs;

  const isTerminal = ['Resolved', 'Rejected', 'Withdrawn'].includes(report.status);
  const isBreached = !isTerminal && remainingMs <= 0;
  const isWarning = !isTerminal && !isBreached && (ratioElapsed >= 0.80 || remainingMs <= 24 * 3600 * 1000);

  const hoursRemaining = Math.round(remainingMs / (3600 * 1000));
  const daysRemaining = Math.round(remainingMs / (24 * 3600 * 1000));

  let displayText = '';
  if (isTerminal) {
    displayText = report.status === 'Resolved' ? 'Resolved' : report.status;
  } else if (isBreached) {
    const overdueHours = Math.abs(hoursRemaining);
    if (overdueHours >= 48) {
      displayText = `Overdue by ${Math.abs(daysRemaining)}d`;
    } else {
      displayText = `Overdue by ${overdueHours}h`;
    }
  } else if (hoursRemaining < 24) {
    displayText = `${Math.max(1, hoursRemaining)}h remaining`;
  } else {
    displayText = `${Math.max(1, daysRemaining)}d remaining`;
  }

  return {
    deadline,
    totalDurationMs,
    remainingMs,
    hoursRemaining,
    daysRemaining,
    ratioElapsed: Math.min(1, Math.max(0, ratioElapsed)),
    isBreached,
    isWarning,
    isTerminal,
    escalationLevel: report.escalation_level || (isBreached ? 2 : (isWarning ? 1 : 0)),
    displayText
  };
}

/**
 * In-process escalation job checker.
 * Scans open reports, identifies reports nearing or past SLA, escalates level, and logs events.
 * Supports both async PostgreSQL execution and synchronous SQLite execution.
 */
function checkEscalations() {
  const activeReportsQuery = `
    SELECT r.id, r.reference_number, r.title, r.citizen_id, r.assigned_staff_id, r.department_id,
           r.status, r.created_at, r.sla_deadline, r.escalation_level, r.priority_level, r.category_id, r.safety_flag
    FROM reports r
    WHERE r.status IN ('Submitted', 'Under Review', 'Assigned', 'In Progress', 'Blocked')
  `;

  if (db.isPostgres) {
    return (async () => {
      const activeReports = await db.all(activeReportsQuery);
      let warningsTriggered = 0;
      let breachesTriggered = 0;

      for (const rep of activeReports) {
        const sla = getSlaStatus(rep);
        if (!sla) continue;

        if (sla.isBreached && (rep.escalation_level || 0) < 2) {
          await db.transaction(async () => {
            await db.run(`
              UPDATE reports
              SET escalation_level = 2,
                  last_escalated_at = datetime('now'),
                  review_required = TRUE,
                  review_reason = 'SLA Target Exceeded (Overdue). Escalated to Department Head.',
                  updated_at = datetime('now')
              WHERE id = ?
            `, [rep.id]);

            const eventId = 'evt-' + crypto.randomUUID().slice(0, 8);
            await db.run(`
              INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
              VALUES (?, ?, null, 'sla_breached', TRUE, ?, ?, datetime('now'))
            `, [
              eventId,
              rep.id,
              `SLA Deadline Exceeded: Issue is past targeted resolution window (${sla.displayText}). High-priority escalation triggered to Municipal Oversight.`,
              JSON.stringify({ deadline: sla.deadline, hoursOverdue: Math.abs(sla.hoursRemaining), escalationLevel: 2 })
            ]);

            if (rep.assigned_staff_id) {
              await db.run(`
                INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
                VALUES (?, ?, ?, 'URGENT: SLA Deadline Breached', ?, FALSE, ?, datetime('now'))
              `, [
                'ntf-' + crypto.randomUUID().slice(0, 8),
                rep.assigned_staff_id,
                rep.id,
                `Report #${rep.reference_number} has exceeded its resolution deadline (${sla.displayText}). Priority resolution required.`,
                `notif-breach-${rep.id}-2`
              ]);
            }

            const admins = await db.all("SELECT id FROM profiles WHERE role = 'admin' AND active = TRUE");
            for (const adm of admins) {
              await db.run(`
                INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
                VALUES (?, ?, ?, 'Escalation Alert: SLA Breached', ?, FALSE, ?, datetime('now'))
              `, [
                'ntf-' + crypto.randomUUID().slice(0, 8),
                adm.id,
                rep.id,
                `Report #${rep.reference_number} (${rep.title}) is overdue by ${Math.abs(sla.hoursRemaining)}h. Automated Level 2 Escalation applied.`,
                `notif-breach-adm-${rep.id}-${adm.id}`
              ]);
            }
          });
          breachesTriggered++;
        } else if (sla.isWarning && (rep.escalation_level || 0) < 1) {
          await db.transaction(async () => {
            await db.run(`
              UPDATE reports
              SET escalation_level = 1,
                  last_escalated_at = datetime('now'),
                  updated_at = datetime('now')
              WHERE id = ?
            `, [rep.id]);

            const eventId = 'evt-' + crypto.randomUUID().slice(0, 8);
            await db.run(`
              INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
              VALUES (?, ?, null, 'escalation_warning', TRUE, ?, ?, datetime('now'))
            `, [
              eventId,
              rep.id,
              `SLA Warning: 80% of target resolution window has elapsed (${sla.displayText}). Automated alert dispatched to field team.`,
              JSON.stringify({ deadline: sla.deadline, hoursRemaining: sla.hoursRemaining, escalationLevel: 1 })
            ]);

            if (rep.assigned_staff_id) {
              await db.run(`
                INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
                VALUES (?, ?, ?, 'SLA Warning: Deadline Approaching', ?, FALSE, ?, datetime('now'))
              `, [
                'ntf-' + crypto.randomUUID().slice(0, 8),
                rep.assigned_staff_id,
                rep.id,
                `Report #${rep.reference_number} has reached 80% of its resolution window (${sla.displayText}).`,
                `notif-warn-${rep.id}-1`
              ]);
            }
          });
          warningsTriggered++;
        }
      }

      return {
        checkedCount: activeReports.length,
        warningsTriggered,
        breachesTriggered
      };
    })();
  }

  // SQLite synchronous mode
  const activeReports = db.all(activeReportsQuery);
  let warningsTriggered = 0;
  let breachesTriggered = 0;

  for (const rep of activeReports) {
    const sla = getSlaStatus(rep);
    if (!sla) continue;

    if (sla.isBreached && (rep.escalation_level || 0) < 2) {
      db.transaction(() => {
        db.run(`
          UPDATE reports
          SET escalation_level = 2,
              last_escalated_at = datetime('now'),
              review_required = TRUE,
              review_reason = 'SLA Target Exceeded (Overdue). Escalated to Department Head.',
              updated_at = datetime('now')
          WHERE id = ?
        `, [rep.id]);

        const eventId = 'evt-' + crypto.randomUUID().slice(0, 8);
        db.run(`
          INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
          VALUES (?, ?, null, 'sla_breached', TRUE, ?, ?, datetime('now'))
        `, [
          eventId,
          rep.id,
          `SLA Deadline Exceeded: Issue is past targeted resolution window (${sla.displayText}). High-priority escalation triggered to Municipal Oversight.`,
          JSON.stringify({ deadline: sla.deadline, hoursOverdue: Math.abs(sla.hoursRemaining), escalationLevel: 2 })
        ]);

        if (rep.assigned_staff_id) {
          db.run(`
            INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
            VALUES (?, ?, ?, 'URGENT: SLA Deadline Breached', ?, FALSE, ?, datetime('now'))
          `, [
            'ntf-' + crypto.randomUUID().slice(0, 8),
            rep.assigned_staff_id,
            rep.id,
            `Report #${rep.reference_number} has exceeded its resolution deadline (${sla.displayText}). Priority resolution required.`,
            `notif-breach-${rep.id}-2`
          ]);
        }

        const admins = db.all("SELECT id FROM profiles WHERE role = 'admin' AND active = TRUE");
        for (const adm of admins) {
          db.run(`
            INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
            VALUES (?, ?, ?, 'Escalation Alert: SLA Breached', ?, FALSE, ?, datetime('now'))
          `, [
            'ntf-' + crypto.randomUUID().slice(0, 8),
            adm.id,
            rep.id,
            `Report #${rep.reference_number} (${rep.title}) is overdue by ${Math.abs(sla.hoursRemaining)}h. Automated Level 2 Escalation applied.`,
            `notif-breach-adm-${rep.id}-${adm.id}`
          ]);
        }
      });
      breachesTriggered++;
    } else if (sla.isWarning && (rep.escalation_level || 0) < 1) {
      db.transaction(() => {
        db.run(`
          UPDATE reports
          SET escalation_level = 1,
              last_escalated_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `, [rep.id]);

        const eventId = 'evt-' + crypto.randomUUID().slice(0, 8);
        db.run(`
          INSERT INTO report_events (id, report_id, actor_id, event_type, citizen_visible, message, metadata_json, created_at)
          VALUES (?, ?, null, 'escalation_warning', TRUE, ?, ?, datetime('now'))
        `, [
          eventId,
          rep.id,
          `SLA Warning: 80% of target resolution window has elapsed (${sla.displayText}). Automated alert dispatched to field team.`,
          JSON.stringify({ deadline: sla.deadline, hoursRemaining: sla.hoursRemaining, escalationLevel: 1 })
        ]);

        if (rep.assigned_staff_id) {
          db.run(`
            INSERT INTO notifications (id, recipient_id, report_id, title, message, read, idempotency_key, created_at)
            VALUES (?, ?, ?, 'SLA Warning: Deadline Approaching', ?, FALSE, ?, datetime('now'))
          `, [
            'ntf-' + crypto.randomUUID().slice(0, 8),
            rep.assigned_staff_id,
            rep.id,
            `Report #${rep.reference_number} has reached 80% of its resolution window (${sla.displayText}).`,
            `notif-warn-${rep.id}-1`
          ]);
        }
      });
      warningsTriggered++;
    }
  }

  return {
    checkedCount: activeReports.length,
    warningsTriggered,
    breachesTriggered
  };
}

module.exports = {
  calculateSlaDeadline,
  getSlaStatus,
  checkEscalations
};
