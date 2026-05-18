const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const db      = require('../config/db');
const { asyncHandler, appError } = require('../middleware/errorHandler');

function generateAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) throw appError('Email already registered', 409);
  const hash = await bcrypt.hash(password, 12);
  const [result] = await db.query('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', [name, email, hash, ['developer','qa'].includes(role) ? role : 'developer']);
  res.status(201).json({ success: true, userId: result.insertId });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user || !user.is_active) throw appError('Invalid credentials', 401);
  if (!await bcrypt.compare(password, user.password_hash)) throw appError('Invalid credentials', 401);
  const accessToken  = generateAccessToken(user);
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash    = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)', [user.id, tokenHash, new Date(Date.now() + 7*24*60*60*1000)]);
  await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  res.json({ success: true, accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

exports.refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw appError('Refresh token required', 400);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const [rows] = await db.query('SELECT rt.*, u.id AS uid, u.role FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? AND rt.expires_at > NOW()', [tokenHash]);
  if (!rows.length) throw appError('Invalid or expired refresh token', 401);
  res.json({ success: true, accessToken: generateAccessToken({ id: rows[0].uid, role: rows[0].role }) });
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await db.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
  }
  res.json({ success: true, message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email, role, total_points, avatar_url, last_login, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ success: true, user: rows[0] });
});
