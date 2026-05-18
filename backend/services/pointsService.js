/**
 * PTMS Points Engine
 * ─────────────────────────────────────────────────────────────
 * Rules:
 *   Complete on time       → +1
 *   Complete after due     → -1
 *   Bug: Minor (≤15 min)  → -1
 *   Bug: Major (<2 hrs)   → -5
 *   Bug: Critical (>5hrs) → -10
 */
const db = require('../config/db');

/**
 * Called when a ticket is moved to "resolved".
 * Checks due_date vs NOW() and writes the appropriate point event.
 */
const evaluateCompletion = async (conn, ticket) => {
  if (!ticket.assignee_id) return;
  const isOnTime = !ticket.due_date || new Date() <= new Date(ticket.due_date);
  const eventType = isOnTime ? 'on_time' : 'overdue';
  const delta     = isOnTime ? 1 : -1;

  await conn.query(
    `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,notes)
     VALUES (?,?,?,?,?)`,
    [ticket.id, ticket.assignee_id, eventType, delta,
     isOnTime ? 'Completed on or before due date' : 'Completed after due date']
  );
};

/**
 * Called when a bug is flagged with known severity.
 * fix_minutes may be null initially (set later when time is logged).
 */
const applyBugPenalty = async (conn, ticket_id, user_id, severity, fix_minutes) => {
  const PENALTY = { minor: -1, major: -5, critical: -10 };
  const delta   = PENALTY[severity];
  if (!delta) return;

  const eventMap = { minor:'bug_minor', major:'bug_major', critical:'bug_critical' };

  // Avoid double-penalising the same ticket
  const [existing] = await conn.query(
    `SELECT id FROM ticket_points_log WHERE ticket_id=? AND event_type IN ('bug_minor','bug_major','bug_critical')`,
    [ticket_id]
  );
  if (existing.length) return;

  await conn.query(
    `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,bug_severity,fix_minutes)
     VALUES (?,?,?,?,?,?)`,
    [ticket_id, user_id, eventMap[severity], delta, severity, fix_minutes||null]
  );
};

/**
 * Classify bug severity from actual fix time in hours, then apply penalty.
 * Minor  : fix ≤ 0.25 hrs  (15 min)
 * Major  : fix < 2 hrs
 * Critical: fix ≥ 2 hrs (edge: >5hrs from spec — use 2-5 as Major, >5 as Critical)
 */
const classifySeverity = (hoursWorked) => {
  if (hoursWorked <= 0.25)   return 'minor';
  if (hoursWorked < 2)       return 'major';
  if (hoursWorked <= 5)      return 'major';   // 2–5 hrs still major
  return 'critical';                            // >5 hrs
};

/**
 * Called after a time log is added to a bug ticket.
 * Recalculates total fix time and updates/inserts the severity + points.
 */
const updateBugSeverityFromTime = async (ticket_id, user_id, currentSeverity, newHours) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Total hours logged on this ticket
    const [[{ total_hrs }]] = await conn.query(
      'SELECT SUM(hours) AS total_hrs FROM time_logs WHERE ticket_id=?', [ticket_id]
    );
    const computed  = classifySeverity(+total_hrs);
    const minutes   = Math.round(+total_hrs * 60);

    // If severity changed, remove old penalty row and add updated one
    const [existing] = await conn.query(
      `SELECT id, bug_severity FROM ticket_points_log
       WHERE ticket_id=? AND event_type IN ('bug_minor','bug_major','bug_critical')`,
      [ticket_id]
    );

    if (existing.length && existing[0].bug_severity !== computed) {
      await conn.query('DELETE FROM ticket_points_log WHERE id=?', [existing[0].id]);
      await applyBugPenalty(conn, ticket_id, user_id, computed, minutes);
    } else if (!existing.length) {
      await applyBugPenalty(conn, ticket_id, user_id, computed, minutes);
    }

    // Update ticket bug_severity field to match
    await conn.query('UPDATE tickets SET bug_severity=? WHERE id=?', [computed, ticket_id]);
    // Update bug table if exists
    await conn.query(
      `UPDATE bugs SET severity=?, fix_minutes=? WHERE ticket_id=?`,
      [computed, minutes, ticket_id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
};

/**
 * Manual point adjustment by Admin/Super Admin.
 */
const manualAdjust = async (ticket_id, user_id, delta, notes, acting_user_id) => {
  await db.query(
    `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,notes) VALUES (?,?,'manual_adjust',?,?)`,
    [ticket_id, user_id, delta, `[Manual by user ${acting_user_id}] ${notes||''}`]
  );
};

/**
 * Get full points summary for a user.
 */
const getUserSummary = async (user_id, startDate, endDate) => {
  let where = 'WHERE pl.user_id=?';
  const params = [user_id];
  if (startDate) { where += ' AND pl.created_at>=?'; params.push(startDate); }
  if (endDate)   { where += ' AND pl.created_at<=?'; params.push(endDate); }

  const [rows] = await db.query(`
    SELECT pl.event_type, pl.delta, pl.bug_severity, pl.fix_minutes, pl.created_at,
           t.ticket_code, t.title AS ticket_title
    FROM ticket_points_log pl
    JOIN tickets t ON t.id = pl.ticket_id
    ${where}
    ORDER BY pl.created_at DESC
  `, params);

  const [[summary]] = await db.query(`
    SELECT
      SUM(delta)                                             AS net_score,
      SUM(CASE WHEN event_type='on_time'     THEN delta END) AS on_time_pts,
      SUM(CASE WHEN event_type='overdue'     THEN delta END) AS overdue_pts,
      SUM(CASE WHEN event_type='bug_minor'   THEN delta END) AS minor_bug_pts,
      SUM(CASE WHEN event_type='bug_major'   THEN delta END) AS major_bug_pts,
      SUM(CASE WHEN event_type='bug_critical' THEN delta END) AS critical_bug_pts,
      SUM(CASE WHEN event_type='manual_adjust' THEN delta END) AS manual_pts,
      COUNT(CASE WHEN event_type='on_time'   THEN 1 END)    AS tasks_on_time,
      COUNT(CASE WHEN event_type='overdue'   THEN 1 END)    AS tasks_overdue,
      COUNT(CASE WHEN event_type='bug_minor' THEN 1 END)    AS bugs_minor,
      COUNT(CASE WHEN event_type='bug_major' THEN 1 END)    AS bugs_major,
      COUNT(CASE WHEN event_type='bug_critical' THEN 1 END) AS bugs_critical
    FROM ticket_points_log pl ${where}
  `, params);

  return { summary, events: rows };
};

module.exports = {
  evaluateCompletion,
  applyBugPenalty,
  classifySeverity,
  updateBugSeverityFromTime,
  manualAdjust,
  getUserSummary
};
