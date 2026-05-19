const jwt = require('jsonwebtoken');
const db  = require('../config/db');

// ── Verify JWT ───────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId  = decoded.id || decoded.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const [rows] = await db.query(
      'SELECT id, name, email, role, total_points, is_active FROM users WHERE id = ?',
      [userId]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Role hierarchy ──────────────────────────────────────────
const ROLE_RANK = {
  super_admin:     6,
  admin:           5,
  project_manager: 4,
  team_lead:       3,
  developer:       2,
  qa:              1
};

// Usage: authorize('admin')  — requires admin rank or above
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const userRank  = ROLE_RANK[req.user.role] || 0;
  const minRank   = Math.min(...allowedRoles.map(r => ROLE_RANK[r] || 0));
  if (userRank >= minRank) return next();
  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
};

// Exact role-list check — use when rank order would grant unintended access
// (e.g. qa=1 < developer=2, but developer must NOT be allowed to flag bugs)
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (roles.includes(req.user.role)) return next();
  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
};

// Alias helpers
const isAdmin   = authorize('admin');
const isPM      = authorize('project_manager');
const isLead    = authorize('team_lead');

// Require a minimum role rank (e.g., authorizeMin('team_lead'))
const authorizeMin = (minRole) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const userRank = ROLE_RANK[req.user.role] || 0;
  const minRank  = ROLE_RANK[minRole] || 0;
  if (userRank >= minRank) return next();
  return res.status(403).json({ success: false, message: 'Insufficient permissions' });
};

// Require that the authenticated user is a member of the project (or has high role)
const requireProjectMember = async (req, res, next) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) return res.status(400).json({ success: false, message: 'Project id required' });
    const userRank = ROLE_RANK[req.user?.role] || 0;
    if (userRank >= ROLE_RANK['project_manager']) return next();
    const [rows] = await db.query('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, req.user.id]);
    if (rows.length) return next();
    return res.status(403).json({ success: false, message: 'Must be a project member' });
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate, authorize, authorizeMin, authorizeRoles, requireProjectMember, isAdmin, isPM, isLead, ROLE_RANK };
