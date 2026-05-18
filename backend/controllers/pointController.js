const db            = require('../config/db');
const PointsService = require('../services/pointsService');

// GET /api/points/user/:userId
const getUserPoints = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await PointsService.getUserSummary(req.params.userId, start_date, end_date);
    res.json({ success:true, data:result });
  } catch (err) { next(err); }
};

// POST /api/points/adjust — Admin only
const adjust = async (req, res, next) => {
  try {
    const { ticket_id, user_id, delta, notes } = req.body;
    await PointsService.manualAdjust(ticket_id, user_id, delta, notes, req.user.id);
    res.json({ success:true, message:`Adjusted ${delta > 0 ? '+' : ''}${delta} points` });
  } catch (err) { next(err); }
};

// GET /api/points/log — full event log (admin view)
const getLog = async (req, res, next) => {
  try {
    const { user_id, project_id, page=1, limit=50 } = req.query;
    const offset = (page-1)*limit;
    let where=['1=1'], params=[];
    if (user_id)    { where.push('pl.user_id=?');    params.push(user_id); }
    if (project_id) { where.push('t.project_id=?');  params.push(project_id); }
    const wc = where.join(' AND ');

    const [rows] = await db.query(`
      SELECT pl.*, u.name AS user_name, t.ticket_code, t.title AS ticket_title
      FROM ticket_points_log pl
      JOIN users u   ON u.id=pl.user_id
      JOIN tickets t ON t.id=pl.ticket_id
      WHERE ${wc}
      ORDER BY pl.created_at DESC LIMIT ? OFFSET ?
    `, [...params, +limit, +offset]);

    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
};

module.exports = { getUserPoints, adjust, getLog };
