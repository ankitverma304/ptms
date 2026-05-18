const db           = require('../config/db');
const PointsService = require('../services/pointsService');

// ── GET /api/reports/user-performance ───────────────────────
const userPerformance = async (req, res, next) => {
  try {
    const { start_date, end_date, project_id, user_id } = req.query;
    let where = ['1=1'], params = [];

    if (start_date)  { where.push('pl.created_at>=?'); params.push(start_date); }
    if (end_date)    { where.push('pl.created_at<=?'); params.push(end_date); }
    if (project_id)  { where.push('t.project_id=?');   params.push(project_id); }
    if (user_id)     { where.push('pl.user_id=?');     params.push(user_id); }

    const wc = where.join(' AND ');
    const [rows] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar_url,
        COALESCE(SUM(pl.delta), 0)                                     AS net_score,
        COUNT(CASE WHEN pl.event_type='on_time'    THEN 1 END)         AS tasks_on_time,
        COUNT(CASE WHEN pl.event_type='overdue'    THEN 1 END)         AS tasks_overdue,
        COUNT(CASE WHEN pl.event_type='bug_minor'  THEN 1 END)         AS bugs_minor,
        COUNT(CASE WHEN pl.event_type='bug_major'  THEN 1 END)         AS bugs_major,
        COUNT(CASE WHEN pl.event_type='bug_critical' THEN 1 END)       AS bugs_critical,
        COALESCE((SELECT SUM(tl.hours) FROM time_logs tl WHERE tl.user_id=u.id),0) AS total_hours
      FROM users u
      LEFT JOIN ticket_points_log pl ON pl.user_id = u.id
      LEFT JOIN tickets t ON t.id = pl.ticket_id
      WHERE ${wc}
      GROUP BY u.id, u.name, u.email, u.role, u.avatar_url
      ORDER BY net_score DESC
    `, params);

    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
};

// ── GET /api/reports/bug-analytics ──────────────────────────
const bugAnalytics = async (req, res, next) => {
  try {
    const { start_date, end_date, project_id } = req.query;
    let where = ['t.is_bug=1'], params = [];

    if (start_date) { where.push('t.created_at>=?'); params.push(start_date); }
    if (end_date)   { where.push('t.created_at<=?'); params.push(end_date); }
    if (project_id) { where.push('t.project_id=?');  params.push(project_id); }
    const wc = where.join(' AND ');

    // Summary counts
    const [[summary]] = await db.query(`
      SELECT
        COUNT(*) AS total_bugs,
        SUM(bug_severity='minor')    AS minor,
        SUM(bug_severity='major')    AS major,
        SUM(bug_severity='critical') AS critical,
        SUM(status='closed')         AS resolved_bugs,
        SUM(status NOT IN ('resolved','closed')) AS open_bugs
      FROM tickets t WHERE ${wc}
    `, params);

    // Bugs per week (last 12 weeks)
    const [trend] = await db.query(`
      SELECT YEAR(created_at) AS yr, WEEK(created_at,1) AS wk,
             COUNT(*) AS count,
             SUM(bug_severity='minor')    AS minor,
             SUM(bug_severity='major')    AS major,
             SUM(bug_severity='critical') AS critical
      FROM tickets WHERE is_bug=1 AND created_at>=DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY yr, wk ORDER BY yr, wk
    `);

    // Top bug reporters
    const [topReporters] = await db.query(`
      SELECT u.id, u.name, u.avatar_url, COUNT(*) AS bug_count,
             SUM(t.bug_severity='critical') AS critical_count
      FROM tickets t JOIN users u ON u.id = t.reporter_id
      WHERE ${wc} GROUP BY u.id, u.name, u.avatar_url ORDER BY bug_count DESC LIMIT 10
    `, params);

    // Top bug assignees (who has the most bugs against them)
    const [topAssignees] = await db.query(`
      SELECT u.id, u.name, u.avatar_url,
             COUNT(*) AS bug_count,
             COALESCE(SUM(pl.delta),0) AS points_lost
      FROM tickets t
      JOIN users u ON u.id = t.assignee_id
      LEFT JOIN ticket_points_log pl ON pl.ticket_id=t.id AND pl.event_type IN ('bug_minor','bug_major','bug_critical')
      WHERE ${wc} GROUP BY u.id, u.name, u.avatar_url ORDER BY bug_count DESC LIMIT 10
    `, params);

    res.json({ success:true, data:{ summary, trend, topReporters, topAssignees } });
  } catch (err) { next(err); }
};

// ── GET /api/reports/time-tracking ──────────────────────────
const timeTracking = async (req, res, next) => {
  try {
    const { start_date, end_date, project_id, user_id } = req.query;
    let where = ['1=1'], params = [];

    if (start_date) { where.push('tl.work_date>=?'); params.push(start_date); }
    if (end_date)   { where.push('tl.work_date<=?'); params.push(end_date); }
    if (project_id) { where.push('t.project_id=?');  params.push(project_id); }
    if (user_id)    { where.push('tl.user_id=?');    params.push(user_id); }
    const wc = where.join(' AND ');

    // Per user summary
    const [byUser] = await db.query(`
      SELECT u.id, u.name, u.avatar_url,
             ROUND(SUM(tl.hours),2)                    AS total_hours,
             ROUND(SUM(CASE WHEN tl.is_billable THEN tl.hours ELSE 0 END),2) AS billable_hours,
             COUNT(DISTINCT tl.ticket_id)               AS tickets_worked
      FROM time_logs tl
      JOIN users u    ON u.id = tl.user_id
      JOIN tickets t  ON t.id = tl.ticket_id
      WHERE ${wc} GROUP BY u.id, u.name, u.avatar_url ORDER BY total_hours DESC
    `, params);

    // Per project summary
    const [byProject] = await db.query(`
      SELECT p.id, p.name, p.code,
             ROUND(SUM(tl.hours),2)            AS logged_hours,
             ROUND(SUM(t.estimated_hrs),2)     AS estimated_hours
      FROM time_logs tl
      JOIN tickets t   ON t.id  = tl.ticket_id
      JOIN projects p  ON p.id  = t.project_id
      WHERE ${wc} GROUP BY p.id, p.name, p.code ORDER BY logged_hours DESC
    `, params);

    // Daily breakdown (last 30 days)
    const [daily] = await db.query(`
      SELECT tl.work_date, ROUND(SUM(tl.hours),2) AS hours,
             COUNT(DISTINCT tl.user_id) AS active_users
      FROM time_logs tl JOIN tickets t ON t.id=tl.ticket_id
      WHERE tl.work_date>=DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY tl.work_date ORDER BY tl.work_date
    `);

    res.json({ success:true, data:{ byUser, byProject, daily } });
  } catch (err) { next(err); }
};

// ── GET /api/reports/leaderboard ────────────────────────────
const leaderboard = async (req, res, next) => {
  try {
    const { period='all', project_id } = req.query;
    let dateFilter = '';
    if (period === 'week')  dateFilter = 'AND pl.created_at>=DATE_SUB(NOW(),INTERVAL 1 WEEK)';
    if (period === 'month') dateFilter = 'AND pl.created_at>=DATE_SUB(NOW(),INTERVAL 1 MONTH)';
    if (period === 'sprint') dateFilter = 'AND pl.created_at>=DATE_SUB(NOW(),INTERVAL 2 WEEK)';

    const projectFilter = project_id ? `AND t.project_id=${+project_id}` : '';

    const [rows] = await db.query(`
      SELECT u.id, u.name, u.avatar_url, u.role,
             COALESCE(SUM(pl.delta),0)                                  AS net_score,
             COUNT(CASE WHEN pl.event_type='on_time'    THEN 1 END)     AS tasks_on_time,
             COUNT(CASE WHEN pl.event_type='overdue'    THEN 1 END)     AS tasks_overdue,
             COUNT(CASE WHEN pl.event_type LIKE 'bug_%' THEN 1 END)     AS total_bugs,
             RANK() OVER (ORDER BY COALESCE(SUM(pl.delta),0) DESC)      AS rank_pos
      FROM users u
      LEFT JOIN ticket_points_log pl ON pl.user_id=u.id ${dateFilter}
      LEFT JOIN tickets t ON t.id=pl.ticket_id ${projectFilter}
      WHERE u.is_active=1
      GROUP BY u.id, u.name, u.avatar_url, u.role ORDER BY net_score DESC
      LIMIT 50
    `);

    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
};

// ── GET /api/reports/project-progress ───────────────────────
const projectProgress = async (req, res, next) => {
  try {
    // accept project_id via params or query
    const project_id = req.params.project_id || req.query.project_id;
    const [statusDist] = await db.query(`
      SELECT status, COUNT(*) AS count FROM tickets WHERE project_id=? GROUP BY status
    `, [project_id]);

    const [[hours]] = await db.query(`
      SELECT ROUND(SUM(estimated_hrs),2) AS estimated, ROUND(SUM(actual_hrs),2) AS actual
      FROM tickets WHERE project_id=?
    `, [project_id]);

    const [overdueList] = await db.query(`
      SELECT t.id, t.ticket_code, t.title, t.due_date, u.name AS assignee_name,
             DATEDIFF(NOW(), t.due_date) AS days_overdue
      FROM tickets t LEFT JOIN users u ON u.id=t.assignee_id
      WHERE t.project_id=? AND t.due_date < NOW() AND t.status NOT IN ('resolved','closed')
      ORDER BY days_overdue DESC
    `, [project_id]);

    res.json({ success:true, data:{ statusDist, hours, overdueList } });
  } catch (err) { next(err); }
};

// ── GET /api/reports/overdue ───────────────────────────────
const overdue = async (req, res, next) => {
  try {
    const { project_id } = req.query;
    const [rows] = await db.query(`
      SELECT t.id, t.ticket_code, t.title, t.due_date, u.name AS assignee_name,
             DATEDIFF(NOW(), t.due_date) AS days_overdue
      FROM tickets t LEFT JOIN users u ON u.id=t.assignee_id
      WHERE t.due_date < NOW() AND t.status NOT IN ('resolved','closed')
      ${project_id ? 'AND t.project_id = ?' : ''}
      ORDER BY days_overdue DESC
    `, project_id ? [project_id] : []);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

// ── GET /api/reports/user/:userId/timeline ──────────────────
const userTimeline = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { start_date, end_date } = req.query;
    const { summary, events } = await PointsService.getUserSummary(userId, start_date, end_date);

    // Daily time log heatmap
    const [dailyHours] = await db.query(`
      SELECT work_date, ROUND(SUM(hours),2) AS hours, COUNT(DISTINCT ticket_id) AS ticket_count
      FROM time_logs WHERE user_id=? AND work_date>=COALESCE(?,DATE_SUB(NOW(),INTERVAL 30 DAY))
      GROUP BY work_date ORDER BY work_date
    `, [userId, start_date||null]);

    // Recent tickets
    const [recentTickets] = await db.query(`
      SELECT t.id, t.ticket_code, t.title, t.status, t.priority, t.is_bug, t.bug_severity,
             t.due_date, t.closed_at, p.name AS project_name
      FROM tickets t JOIN projects p ON p.id=t.project_id
      WHERE t.assignee_id=?
      ORDER BY t.updated_at DESC LIMIT 20
    `, [userId]);

    res.json({ success:true, data:{ summary, events, dailyHours, recentTickets } });
  } catch (err) { next(err); }
};

module.exports = { userPerformance, bugAnalytics, timeTracking, leaderboard, projectProgress, userTimeline, overdue };
