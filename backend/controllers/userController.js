const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const { asyncHandler, appError } = require('../middleware/errorHandler');
const pts    = require('../services/pointsService');

const VALID_ROLES = ['super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'qa'];

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'developer', is_active = true } = req.body;
  const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) throw appError('Email already registered', 409);
  const hash     = await bcrypt.hash(password, 12);
  const safeRole = VALID_ROLES.includes(role) ? role : 'developer';
  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?,?,?,?,?)',
    [name, email, hash, safeRole, is_active ? 1 : 0]
  );
  const [user] = await db.query('SELECT id, name, email, role, total_points, is_active, created_at FROM users WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, message: 'User created', data: user[0] });
});

exports.list = asyncHandler(async (req, res) => {
  const { role, search, is_active } = req.query;
  let where = '1=1'; const p = [];
  if (role)      { where += ' AND role = ?'; p.push(role); }
  if (search)    { where += ' AND (name LIKE ? OR email LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  if (is_active !== undefined) { where += ' AND is_active = ?'; p.push(is_active === '1' || is_active === 'true' ? 1 : 0); }
  const [rows] = await db.query(`SELECT id, name, email, role, total_points, is_active, last_login, created_at FROM users WHERE ${where} ORDER BY name`, p);
  res.json({ success: true, data: rows });
});

exports.get = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email, role, total_points, avatar_url, is_active, last_login, created_at FROM users WHERE id = ?', [req.params.id]);
  if (!rows.length) throw appError('User not found', 404);
  const summary = await pts.getUserScoreSummary(req.params.id);
  const [projects] = await db.query('SELECT p.id, p.name, p.code, p.status, pm.role_in_project FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE pm.user_id = ?', [req.params.id]);
  res.json({ success: true, data: { ...rows[0], scoreSummary: summary, projects } });
});

exports.update = asyncHandler(async (req, res) => {
  const { name, email, role, is_active } = req.body;
  const isAdmin = ['super_admin','admin'].includes(req.user.role);
  if (!isAdmin && req.user.id !== parseInt(req.params.id)) throw appError('Not authorized', 403);
  await db.query('UPDATE users SET name=?, email=?, role=COALESCE(?,role), is_active=COALESCE(?,is_active) WHERE id=?', [name, email, isAdmin ? role : null, isAdmin && is_active !== undefined ? is_active : null, req.params.id]);
  const [user] = await db.query('SELECT id, name, email, role, total_points, is_active FROM users WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: user[0] });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!await bcrypt.compare(current_password, rows[0].password_hash)) throw appError('Current password incorrect', 400);
  await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(new_password, 12), req.user.id]);
  res.json({ success: true, message: 'Password changed' });
});

exports.notifications = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
  res.json({ success: true, data: rows });
});

exports.markRead = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (ids?.length) {
    await db.query('UPDATE notifications SET is_read = 1 WHERE id IN (?) AND user_id = ?', [ids, req.user.id]);
  } else {
    await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  }
  res.json({ success: true });
});
