const db     = require('../config/db');
const { asyncHandler, appError } = require('../middleware/errorHandler');
const points = require('../services/pointsService');

// Recalculate tickets.actual_hrs from sum of all time_logs for that ticket
async function syncActualHrs(ticket_id) {
  const [[{ total }]] = await db.query(
    'SELECT COALESCE(SUM(hours), 0) AS total FROM time_logs WHERE ticket_id = ?',
    [ticket_id]
  );
  await db.query('UPDATE tickets SET actual_hrs = ? WHERE id = ?', [total, ticket_id]);
}

exports.logTime = asyncHandler(async (req, res) => {
  const { ticket_id, hours, work_date, note, is_billable = true } = req.body;
  if (hours <= 0) throw appError('Hours must be > 0');

  const [result] = await db.query(
    'INSERT INTO time_logs (ticket_id, user_id, hours, work_date, note, is_billable) VALUES (?,?,?,?,?,?)',
    [ticket_id, req.user.id, hours, work_date || new Date().toISOString().slice(0, 10), note, is_billable ? 1 : 0]
  );

  // Keep actual_hrs in sync
  await syncActualHrs(ticket_id);

  // Bug severity recalculation if this is a bug ticket
  const [[ticket]] = await db.query('SELECT is_bug, bug_severity, assignee_id FROM tickets WHERE id = ?', [ticket_id]);
  if (ticket?.is_bug && ticket?.assignee_id) {
    await points.updateBugSeverityFromTime(ticket_id, ticket.assignee_id, ticket.bug_severity, hours);
  }

  res.status(201).json({ success: true, data: { id: result.insertId } });
});

exports.listForTicket = asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    'SELECT tl.*, u.name AS user_name FROM time_logs tl JOIN users u ON u.id = tl.user_id WHERE tl.ticket_id = ? ORDER BY tl.work_date DESC',
    [req.params.ticketId]
  );
  res.json({ success: true, data: rows });
});

exports.userTimeline = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.user.id;
  const { start_date, end_date, project_id } = req.query;
  let where = 'tl.user_id = ?'; const params = [userId];
  if (start_date) { where += ' AND tl.work_date >= ?'; params.push(start_date); }
  if (end_date)   { where += ' AND tl.work_date <= ?'; params.push(end_date); }
  if (project_id) { where += ' AND t.project_id = ?';  params.push(project_id); }

  const [daily] = await db.query(
    `SELECT tl.work_date, SUM(tl.hours) AS total_hours, COUNT(DISTINCT tl.ticket_id) AS ticket_count
     FROM time_logs tl JOIN tickets t ON t.id = tl.ticket_id WHERE ${where}
     GROUP BY tl.work_date ORDER BY tl.work_date DESC`, params
  );
  const [logs] = await db.query(
    `SELECT tl.*, t.ticket_code, t.title, p.name AS project_name, p.code AS project_code
     FROM time_logs tl JOIN tickets t ON t.id = tl.ticket_id JOIN projects p ON p.id = t.project_id
     WHERE ${where} ORDER BY tl.work_date DESC`, params
  );
  const [bugSummary] = await db.query(
    `SELECT t.bug_severity, COUNT(*) AS cnt FROM tickets t
     WHERE t.assignee_id = ? AND t.is_bug = 1 ${project_id ? 'AND t.project_id = ?' : ''}
     GROUP BY t.bug_severity`,
    project_id ? [userId, project_id] : [userId]
  );
  const scoreSummary = await points.getUserScoreSummary(userId, { startDate: start_date, endDate: end_date, projectId: project_id });

  res.json({ success: true, data: { daily, logs, bugSummary, scoreSummary } });
});

exports.update = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM time_logs WHERE id = ?', [req.params.id]);
  if (!rows.length) throw appError('Not found', 404);
  if (req.user.id !== rows[0].user_id && !['super_admin', 'admin', 'team_lead'].includes(req.user.role)) {
    throw appError('Not authorized', 403);
  }
  const { hours, work_date, note, is_billable } = req.body;
  await db.query(
    'UPDATE time_logs SET hours=?, work_date=?, note=?, is_billable=? WHERE id=?',
    [hours, work_date, note, is_billable ? 1 : 0, req.params.id]
  );
  await syncActualHrs(rows[0].ticket_id);
  res.json({ success: true, message: 'Updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM time_logs WHERE id = ?', [req.params.id]);
  if (!rows.length) throw appError('Not found', 404);
  if (req.user.id !== rows[0].user_id && !['super_admin', 'admin'].includes(req.user.role)) {
    throw appError('Not authorized', 403);
  }
  const { ticket_id } = rows[0];
  await db.query('DELETE FROM time_logs WHERE id = ?', [req.params.id]);
  await syncActualHrs(ticket_id);
  res.json({ success: true, message: 'Deleted' });
});
