const express = require('express');
const r = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
r.use(authenticate);

// GET /api/time-logs?user_id=&ticket_id=&project_id=&start=&end=
r.get('/', async (req, res, next) => {
  try {
    const { user_id, ticket_id, project_id, start_date, end_date } = req.query;
    let where=['1=1'], params=[];
    if (user_id)    { where.push('tl.user_id=?');    params.push(user_id); }
    if (ticket_id)  { where.push('tl.ticket_id=?');  params.push(ticket_id); }
    if (project_id) { where.push('t.project_id=?');  params.push(project_id); }
    if (start_date) { where.push('tl.work_date>=?'); params.push(start_date); }
    if (end_date)   { where.push('tl.work_date<=?'); params.push(end_date); }
    const wc = where.join(' AND ');
    const [rows] = await db.query(`
      SELECT tl.*, u.name AS user_name, t.ticket_code, t.title AS ticket_title, p.name AS project_name
      FROM time_logs tl
      JOIN users u    ON u.id=tl.user_id
      JOIN tickets t  ON t.id=tl.ticket_id
      JOIN projects p ON p.id=t.project_id
      WHERE ${wc} ORDER BY tl.work_date DESC, tl.logged_at DESC
    `, params);
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
});

// PATCH /api/time-logs/:id
r.patch('/:id', async (req, res, next) => {
  try {
    const { hours, note, is_billable } = req.body;
    await db.query('UPDATE time_logs SET hours=?, note=?, is_billable=? WHERE id=? AND user_id=?',
      [hours, note, is_billable, req.params.id, req.user.id]);
    res.json({ success:true, message:'Time log updated' });
  } catch (err) { next(err); }
});

// DELETE /api/time-logs/:id
r.delete('/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM time_logs WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success:true, message:'Time log deleted' });
  } catch (err) { next(err); }
});

module.exports = r;
