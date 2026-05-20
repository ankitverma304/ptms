/**
 * PTMS Points Engine v2
 *
 * Positive events:
 *   on_time              +10   resolved on/before due date
 *   complex_bonus        +15   ticket marked is_complex
 *   bug_fixed_minor       +2   bug ticket resolved (minor)
 *   bug_fixed_major       +5   bug ticket resolved (major)
 *   bug_fixed_critical   +10   bug ticket resolved (critical)
 *   fast_fix_minor        +1   fixed within SLA (≤1 day)
 *   fast_fix_major        +3   fixed within SLA (≤4 h)
 *   fast_fix_critical     +5   fixed within SLA (≤1 h)
 *   self_fix_reduction   +N   50% of creation penalty back when self-fixed within SLA
 *
 * Negative events:
 *   overdue              -1/-3/-5  tiered by days late (1d / 2–3d / >3d)
 *   bug_created_minor     -1   bug flagged on ticket (minor)
 *   bug_created_major     -3   bug flagged on ticket (major)
 *   bug_created_critical  -7   bug flagged on ticket (critical)
 */
const db = require('../config/db');

// ── Constants ──────────────────────────────────────────────────
const POINTS = {
  on_time:              10,
  complex_bonus:        15,
  overdue_1d:           -1,
  overdue_2_3d:         -3,
  overdue_gt3d:         -5,
  bug_created_minor:    -1,
  bug_created_major:    -3,
  bug_created_critical: -7,
  bug_fixed_minor:       2,
  bug_fixed_major:       5,
  bug_fixed_critical:   10,
  fast_fix_minor:        1,
  fast_fix_major:        3,
  fast_fix_critical:     5,
};

// SLA thresholds in minutes
const SLA = { minor: 1440, major: 240, critical: 60 };

const overdueDelta = (daysLate) => {
  if (daysLate <= 1) return POINTS.overdue_1d;
  if (daysLate <= 3) return POINTS.overdue_2_3d;
  return POINTS.overdue_gt3d;
};

// ── evaluateCompletion ─────────────────────────────────────────
// Called when a ticket moves to "resolved".
// Grants on-time (+10) or tiered overdue penalty, plus complex bonus,
// plus bug-fix reward if the ticket is a bug.
const evaluateCompletion = async (conn, ticket) => {
  if (!ticket.assignee_id) return;

  const now = new Date();
  const isOnTime = !ticket.due_date || now <= new Date(ticket.due_date);

  if (isOnTime) {
    await conn.query(
      `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,notes)
       VALUES (?,?,'on_time',?,?)`,
      [ticket.id, ticket.assignee_id, POINTS.on_time, 'Completed on or before due date']
    );
  } else {
    const msLate   = now - new Date(ticket.due_date);
    const daysLate = Math.ceil(msLate / 86_400_000);
    const delta    = overdueDelta(daysLate);
    await conn.query(
      `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,notes)
       VALUES (?,?,'overdue',?,?)`,
      [ticket.id, ticket.assignee_id, delta, `Completed ${daysLate} day(s) late`]
    );
  }

  // Complex task bonus
  if (ticket.is_complex) {
    await conn.query(
      `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,notes)
       VALUES (?,?,'complex_bonus',?,?)`,
      [ticket.id, ticket.assignee_id, POINTS.complex_bonus, 'Complex task bonus']
    );
  }

  // Bug-fix reward (if this is a bug ticket)
  if (ticket.is_bug && ticket.bug_severity) {
    await applyBugFixReward(conn, ticket, ticket.assignee_id);
  }
};

// ── applyBugCreationPenalty ────────────────────────────────────
// Called when QA/TL flags a ticket as a bug.
// Penalty goes to the ticket's current assignee (the one who introduced the bug).
const applyBugCreationPenalty = async (conn, ticket_id, user_id, severity) => {
  const eventMap = {
    minor:    'bug_created_minor',
    major:    'bug_created_major',
    critical: 'bug_created_critical',
  };
  const event = eventMap[severity];
  if (!event) return;

  // Guard against double-penalising the same ticket
  const [existing] = await conn.query(
    `SELECT id FROM ticket_points_log
     WHERE ticket_id=? AND event_type IN ('bug_created_minor','bug_created_major','bug_created_critical')`,
    [ticket_id]
  );
  if (existing.length) return;

  await conn.query(
    `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,bug_severity,notes)
     VALUES (?,?,?,?,?,?)`,
    [ticket_id, user_id, event, POINTS[event], severity, `Bug flagged as ${severity}`]
  );
};

// ── applyBugFixReward ──────────────────────────────────────────
// Called when a bug ticket is resolved.
// Rewards the fixer, checks SLA for fast-fix bonus, and applies
// self-fix 50% penalty reduction when the same developer created + fixed it.
const applyBugFixReward = async (conn, ticket, resolver_id) => {
  const severity = ticket.bug_severity;
  if (!severity) return;

  // Guard against double reward
  const [existingFix] = await conn.query(
    `SELECT id FROM ticket_points_log
     WHERE ticket_id=? AND event_type IN ('bug_fixed_minor','bug_fixed_major','bug_fixed_critical')`,
    [ticket.id]
  );
  if (existingFix.length) return;

  // Total fix time from logged hours
  const [[{ total_hrs }]] = await conn.query(
    'SELECT COALESCE(SUM(hours),0) AS total_hrs FROM time_logs WHERE ticket_id=?',
    [ticket.id]
  );
  const fix_minutes = Math.round(+total_hrs * 60);

  const fixEvent  = `bug_fixed_${severity}`;
  const fastEvent = `fast_fix_${severity}`;

  // Fix reward
  await conn.query(
    `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,bug_severity,fix_minutes,notes)
     VALUES (?,?,?,?,?,?,?)`,
    [ticket.id, resolver_id, fixEvent, POINTS[fixEvent], severity, fix_minutes,
     `Bug resolved (${severity})`]
  );

  const withinSLA = fix_minutes > 0 && fix_minutes <= SLA[severity];

  // Fast-fix bonus
  if (withinSLA) {
    await conn.query(
      `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,bug_severity,fix_minutes,notes)
       VALUES (?,?,?,?,?,?,?)`,
      [ticket.id, resolver_id, fastEvent, POINTS[fastEvent], severity, fix_minutes,
       `Fast fix bonus — resolved within SLA`]
    );
  }

  // Self-fix: if the person who got the creation penalty is the same resolver
  // and they fixed within SLA → 50% of creation penalty back
  const [creationLog] = await conn.query(
    `SELECT id, user_id, delta FROM ticket_points_log
     WHERE ticket_id=? AND event_type IN ('bug_created_minor','bug_created_major','bug_created_critical')`,
    [ticket.id]
  );
  if (creationLog.length && creationLog[0].user_id === resolver_id && withinSLA) {
    const reduction = Math.round(Math.abs(creationLog[0].delta) / 2);
    if (reduction > 0) {
      await conn.query(
        `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,bug_severity,notes)
         VALUES (?,?,'self_fix_reduction',?,?,?)`,
        [ticket.id, resolver_id, reduction, severity,
         `Self-fix reduction (50% of ${creationLog[0].delta} penalty)`]
      );
    }
  }
};

// ── manualAdjust ───────────────────────────────────────────────
const manualAdjust = async (ticket_id, user_id, delta, notes, acting_user_id) => {
  await db.query(
    `INSERT INTO ticket_points_log (ticket_id,user_id,event_type,delta,notes)
     VALUES (?,?,'manual_adjust',?,?)`,
    [ticket_id, user_id, delta, `[Manual by user ${acting_user_id}] ${notes || ''}`]
  );
};

// ── getUserSummary ─────────────────────────────────────────────
const normalizeFilters = (startDateOrFilters, endDate) => {
  if (startDateOrFilters && typeof startDateOrFilters === 'object') {
    return {
      startDate: startDateOrFilters.startDate || null,
      endDate:   startDateOrFilters.endDate   || null,
      projectId: startDateOrFilters.projectId || null,
    };
  }
  return { startDate: startDateOrFilters || null, endDate: endDate || null, projectId: null };
};

const getUserSummary = async (user_id, startDateOrFilters, endDate) => {
  const { startDate, endDate: normalizedEnd, projectId } = normalizeFilters(startDateOrFilters, endDate);
  let where = 'WHERE pl.user_id=?';
  const params = [user_id];
  if (startDate)    { where += ' AND pl.created_at>=?';        params.push(startDate); }
  if (normalizedEnd){ where += ' AND DATE(pl.created_at)<=?';  params.push(normalizedEnd); }
  if (projectId)    { where += ' AND t.project_id=?';          params.push(projectId); }

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
      SUM(delta)                                                          AS net_score,
      SUM(CASE WHEN event_type='on_time'              THEN delta END)    AS on_time_pts,
      SUM(CASE WHEN event_type='overdue'              THEN delta END)    AS overdue_pts,
      SUM(CASE WHEN event_type='complex_bonus'        THEN delta END)    AS complex_pts,
      SUM(CASE WHEN event_type LIKE 'bug_created_%'   THEN delta END)    AS bugs_created_pts,
      SUM(CASE WHEN event_type LIKE 'bug_fixed_%'     THEN delta END)    AS bugs_fixed_pts,
      SUM(CASE WHEN event_type LIKE 'fast_fix_%'      THEN delta END)    AS fast_fix_pts,
      SUM(CASE WHEN event_type='self_fix_reduction'   THEN delta END)    AS self_fix_pts,
      SUM(CASE WHEN event_type='manual_adjust'        THEN delta END)    AS manual_pts,
      COUNT(CASE WHEN event_type='on_time'            THEN 1 END)        AS tasks_on_time,
      COUNT(CASE WHEN event_type='overdue'            THEN 1 END)        AS tasks_overdue,
      COUNT(CASE WHEN event_type LIKE 'bug_created_%' THEN 1 END)        AS bugs_created,
      COUNT(CASE WHEN event_type LIKE 'bug_fixed_%'   THEN 1 END)        AS bugs_fixed
    FROM ticket_points_log pl
    JOIN tickets t ON t.id = pl.ticket_id
    ${where}
  `, params);

  return { summary, events: rows };
};

const getUserScoreSummary = async (user_id, filters) => {
  const { summary } = await getUserSummary(user_id, filters);
  return summary;
};

module.exports = {
  evaluateCompletion,
  applyBugCreationPenalty,
  applyBugFixReward,
  manualAdjust,
  getUserSummary,
  getUserScoreSummary,
};
