const db      = require('../config/db');
const { ROLE_RANK } = require('../middleware/auth');

const list = async (req, res, next) => {
  try {
    const { status, priority, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const user   = req.user;
    let where = [], params = [];

    if (ROLE_RANK[user.role] < ROLE_RANK['project_manager']) {
      where.push('pm.user_id = ?'); params.push(user.id);
    }
    if (status)   { where.push('p.status = ?');   params.push(status); }
    if (priority) { where.push('p.priority = ?'); params.push(priority); }
    if (search)   { where.push('(p.name LIKE ? OR p.code LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(`
      SELECT DISTINCT p.id, p.name, p.code, p.type, p.priority, p.status,
             p.start_date, p.end_date, p.expected_days, p.client_name, p.updated_at,
             u.name AS pm_name,
             (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id) AS ticket_count,
             (SELECT COUNT(*) FROM tickets t WHERE t.project_id = p.id AND t.status NOT IN ('resolved','closed')) AS open_count
      FROM projects p
      LEFT JOIN users u ON u.id = p.pm_id
      LEFT JOIN project_members pm ON pm.project_id = p.id
      ${wc} ORDER BY p.updated_at DESC LIMIT ? OFFSET ?
    `, [...params, +limit, +offset]);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id ${wc}`, params
    );
    res.json({ success: true, data: rows, meta: { total, page: +page, limit: +limit } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { name, description, client_name, type='fixed_price', priority='medium',
            start_date, end_date, pm_id, members=[], tags=[] } = req.body;

    const [[{ max_id }]] = await conn.query('SELECT COALESCE(MAX(id),0) AS max_id FROM projects');
    const code = `PRJ-${String(max_id+1).padStart(4,'0')}`;
    const expected_days = (start_date && end_date)
      ? Math.ceil((new Date(end_date)-new Date(start_date))/86400000) : null;

    const [result] = await conn.query(
      `INSERT INTO projects (name,code,description,client_name,type,priority,status,pm_id,start_date,end_date,expected_days,created_by)
       VALUES (?,?,?,?,?,?,'not_started',?,?,?,?,?)`,
      [name,code,description,client_name,type,priority,pm_id||req.user.id,start_date,end_date,expected_days,req.user.id]
    );
    const pid = result.insertId;

    const memberSet = [...new Set([...(pm_id?[+pm_id]:[]),req.user.id,...members.map(Number)])];
    for (const uid of memberSet) {
      await conn.query(
        'INSERT IGNORE INTO project_members (project_id,user_id,role_in_project) VALUES (?,?,?)',
        [pid, uid, uid===+pm_id ? 'manager' : 'member']
      );
    }
    for (const tid of tags) {
      await conn.query('INSERT IGNORE INTO project_tags (project_id,tag_id) VALUES (?,?)', [pid,tid]);
    }
    await conn.commit();
    res.status(201).json({ success: true, message: 'Project created', data: { id: pid, code } });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
};

const getOne = async (req, res, next) => {
  try {
    const [[project]] = await db.query(`
      SELECT p.*, u.name AS pm_name, cb.name AS created_by_name
      FROM projects p LEFT JOIN users u ON u.id=p.pm_id LEFT JOIN users cb ON cb.id=p.created_by
      WHERE p.id=?`, [req.params.id]);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const [members] = await db.query(
      `SELECT u.id,u.name,u.email,u.role,u.avatar_url,pm.role_in_project,pm.joined_at
       FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=?`, [req.params.id]);
    const [tags] = await db.query(
      `SELECT t.id,t.name,t.color FROM tags t JOIN project_tags pt ON pt.tag_id=t.id WHERE pt.project_id=?`, [req.params.id]);
    const [[stats]] = await db.query(`
      SELECT COUNT(*) AS total,
        SUM(status='open') AS open_count, SUM(status='in_progress') AS in_progress,
        SUM(status IN ('resolved','closed')) AS done_count, SUM(is_bug=1) AS bug_count,
        SUM(COALESCE(estimated_hrs,0)) AS total_estimated, SUM(actual_hrs) AS total_actual
      FROM tickets WHERE project_id=?`, [req.params.id]);

    res.json({ success: true, data: { ...project, members, tags, stats } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const allowed = ['name','description','client_name','type','priority','status','pm_id','start_date','end_date'];
    const fields  = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ success:false, message:'No valid fields' });
    const sets = fields.map(f=>`${f}=?`).join(',');
    await db.query(`UPDATE projects SET ${sets} WHERE id=?`, [...fields.map(f=>req.body[f]), req.params.id]);
    res.json({ success: true, message: 'Project updated' });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await db.query('DELETE FROM projects WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) { next(err); }
};

const addMember = async (req, res, next) => {
  try {
    const { user_id, role_in_project='member' } = req.body;
    await db.query(
      'INSERT IGNORE INTO project_members (project_id,user_id,role_in_project) VALUES (?,?,?)',
      [req.params.id, user_id, role_in_project]
    );
    res.json({ success: true, message: 'Member added' });
  } catch (err) { next(err); }
};

const removeMember = async (req, res, next) => {
  try {
    await db.query('DELETE FROM project_members WHERE project_id=? AND user_id=?', [req.params.id, req.params.userId]);
    res.json({ success: true, message: 'Member removed' });
  } catch (err) { next(err); }
};

// Dashboard alias — reuse getOne which already includes members/tags/stats
const dashboard = getOne;

module.exports = { list, create, getOne, get: getOne, dashboard, update, remove, addMember, removeMember };
