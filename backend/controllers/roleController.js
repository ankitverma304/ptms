const db = require('../config/db');

// ── GET /api/roles ───────────────────────────────────────────
const list = async (req, res, next) => {
  try {
    const [roles] = await db.query(`
      SELECT r.id, r.name, r.description, r.base_role, r.created_at,
             COUNT(DISTINCT u.id) AS assigned_count,
             GROUP_CONCAT(rm.module ORDER BY rm.module SEPARATOR ',') AS modules_csv
      FROM custom_roles r
      LEFT JOIN users u       ON u.custom_role_id = r.id
      LEFT JOIN role_modules rm ON rm.role_id = r.id
      GROUP BY r.id ORDER BY r.created_at DESC
    `);
    const data = roles.map(r => ({
      ...r,
      modules: r.modules_csv ? r.modules_csv.split(',') : null,
      modules_csv: undefined,
    }));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ── POST /api/roles ──────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { name, description = '', base_role = 'developer' } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Role name is required' });

    const [result] = await db.query(
      'INSERT INTO custom_roles (name, description, base_role) VALUES (?,?,?)',
      [name.trim(), description.trim(), base_role]
    );
    res.status(201).json({ success: true, message: 'Role created', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A role with this name already exists' });
    next(err);
  }
};

// ── PUT /api/roles/:id ───────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { name, description, base_role } = req.body;
    const allowed = { name, description, base_role };
    const fields  = Object.keys(allowed).filter(k => allowed[k] !== undefined);
    if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

    const sets = fields.map(f => `${f}=?`).join(',');
    await db.query(`UPDATE custom_roles SET ${sets} WHERE id=?`, [...fields.map(f => allowed[f]), req.params.id]);

    // If base_role changed, sync the permission role for all users assigned this custom role
    if (base_role) {
      await db.query('UPDATE users SET role=? WHERE custom_role_id=?', [base_role, req.params.id]);
    }
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A role with this name already exists' });
    next(err);
  }
};

// ── DELETE /api/roles/:id ────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    // FK ON DELETE SET NULL handles clearing custom_role_id on users
    await db.query('DELETE FROM custom_roles WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/roles/assign ───────────────────────────────────
// Body: { user_id, role_id }  — role_id null removes the custom role
const assign = async (req, res, next) => {
  try {
    const { user_id, role_id } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required' });

    if (!role_id) {
      // Remove custom role — reset permission role to 'developer'
      await db.query('UPDATE users SET custom_role_id=NULL WHERE id=?', [user_id]);
      return res.json({ success: true, message: 'Custom role removed' });
    }

    const [[role]] = await db.query('SELECT * FROM custom_roles WHERE id=?', [role_id]);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    // Assign custom role + sync permission role from base_role
    await db.query(
      'UPDATE users SET custom_role_id=?, role=? WHERE id=?',
      [role_id, role.base_role, user_id]
    );
    res.json({ success: true, message: 'Role assigned' });
  } catch (err) { next(err); }
};

// ── PUT /api/roles/:id/modules ───────────────────────────────
// Body: { modules: ['dashboard','tickets',...] } or { modules: null } = unrestricted
const setModules = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { modules } = req.body; // null/undefined = unrestricted; [] = block all; ['x',...] = restricted

    const [[role]] = await db.query('SELECT id FROM custom_roles WHERE id=?', [id]);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    await db.query('DELETE FROM role_modules WHERE role_id=?', [id]);

    if (Array.isArray(modules) && modules.length > 0) {
      const vals = modules.map(m => [+id, m]);
      await db.query('INSERT INTO role_modules (role_id, module) VALUES ?', [vals]);
    }

    res.json({ success: true, message: 'Module permissions updated' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove, assign, setModules };
