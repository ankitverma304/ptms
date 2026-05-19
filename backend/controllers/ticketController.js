const db             = require('../config/db');
const PointsService  = require('../services/pointsService');
const NotifyService  = require('../services/notifyService');

// ── GET /api/tickets ─────────────────────────────────────────
const list = async (req, res, next) => {
  try {
    const { project_id, status, priority, assignee_id, is_bug,
            search, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    let where=[], params=[];

    if (project_id)  { where.push('t.project_id=?');  params.push(project_id); }
    if (status)      { where.push('t.status=?');       params.push(status); }
    if (priority)    { where.push('t.priority=?');     params.push(priority); }
    if (assignee_id) { where.push('t.assignee_id=?');  params.push(assignee_id); }
    if (is_bug)      { where.push('t.is_bug=?');       params.push(is_bug==='true'?1:0); }
    if (search)      { where.push('(t.title LIKE ? OR t.ticket_code LIKE ?)'); params.push(`%${search}%`,`%${search}%`); }

    const wc = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await db.query(`
      SELECT t.id, t.ticket_code, t.title, t.priority, t.status, t.is_bug, t.bug_severity,
             t.due_date, t.estimated_hrs, t.actual_hrs, t.created_at, t.updated_at,
             a.name AS assignee_name, a.avatar_url AS assignee_avatar,
             p.name AS project_name, p.code AS project_code
      FROM tickets t
      LEFT JOIN users a    ON a.id = t.assignee_id
      LEFT JOIN projects p ON p.id = t.project_id
      ${wc} ORDER BY FIELD(t.priority,'critical','high','medium','low'), t.due_date ASC
      LIMIT ? OFFSET ?
    `, [...params, +limit, +offset]);

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM tickets t ${wc}`, params);
    res.json({ success:true, data:rows, meta:{total, page:+page, limit:+limit} });
  } catch (err) { next(err); }
};

// ── POST /api/tickets ────────────────────────────────────────
const create = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      project_id, title, description, priority='medium', assignee_id,
      start_date, due_date, estimated_hrs, tags=[], checklist=[]
    } = req.body;

    // Auto-generate ticket code: TKT-YYYY-NNNN
    const year = new Date().getFullYear();
    const [[{ cnt }]] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM tickets WHERE YEAR(created_at)=?', [year]
    );
    const code = `TKT-${year}-${String(cnt+1).padStart(4,'0')}`;

    const [result] = await conn.query(
      `INSERT INTO tickets (project_id,ticket_code,title,description,priority,status,assignee_id,reporter_id,start_date,due_date,estimated_hrs)
       VALUES (?,?,?,?,?,'open',?,?,?,?,?)`,
      [project_id,code,title,description,priority,assignee_id||null,req.user.id,start_date,due_date,estimated_hrs||null]
    );
    const tid = result.insertId;

    for (const tagId of tags) {
      await conn.query('INSERT IGNORE INTO ticket_tags (ticket_id,tag_id) VALUES (?,?)', [tid,tagId]);
    }
    for (let i=0; i<checklist.length; i++) {
      await conn.query(
        'INSERT INTO ticket_checklist (ticket_id,item_text,sort_order,created_by) VALUES (?,?,?,?)',
        [tid, checklist[i], i, req.user.id]
      );
    }

    // Add reporter + assignee as watchers
    await conn.query('INSERT IGNORE INTO ticket_watchers (ticket_id,user_id) VALUES (?,?)', [tid, req.user.id]);
    if (assignee_id) {
      await conn.query('INSERT IGNORE INTO ticket_watchers (ticket_id,user_id) VALUES (?,?)', [tid, assignee_id]);
    }

    await logHistory(conn, tid, req.user.id, 'created', null, null, 'open');
    await conn.commit();

    if (assignee_id) {
      await NotifyService.send(req.app.get('io'), {
        user_id: assignee_id, type: 'assigned',
        title: 'New ticket assigned to you',
        message: `${title} (${code})`, entity_type: 'ticket', entity_id: tid
      });
    }
    res.status(201).json({ success:true, message:'Ticket created', data:{id:tid, code} });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
};

// ── GET /api/tickets/:id ─────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const [[ticket]] = await db.query(`
      SELECT t.*, a.name AS assignee_name, a.email AS assignee_email, a.avatar_url AS assignee_avatar,
             r.name AS reporter_name, p.name AS project_name, p.code AS project_code
      FROM tickets t
      LEFT JOIN users a    ON a.id=t.assignee_id
      LEFT JOIN users r    ON r.id=t.reporter_id
      LEFT JOIN projects p ON p.id=t.project_id
      WHERE t.id=?`, [req.params.id]);
    if (!ticket) return res.status(404).json({ success:false, message:'Ticket not found' });

    const [tags]      = await db.query(`SELECT t.id,t.name,t.color FROM tags t JOIN ticket_tags tt ON tt.tag_id=t.id WHERE tt.ticket_id=?`, [req.params.id]);
    const [checklist] = await db.query('SELECT * FROM ticket_checklist WHERE ticket_id=? ORDER BY sort_order', [req.params.id]);
    const [timeLogs]  = await db.query(`SELECT tl.*,u.name AS user_name FROM time_logs tl JOIN users u ON u.id=tl.user_id WHERE tl.ticket_id=? ORDER BY tl.work_date DESC`, [req.params.id]);
    const [history]   = await db.query(`SELECT th.*,u.name AS user_name FROM ticket_history th LEFT JOIN users u ON u.id=th.user_id WHERE th.ticket_id=? ORDER BY th.created_at DESC`, [req.params.id]);
    const [watchers]  = await db.query(`SELECT u.id,u.name,u.avatar_url FROM ticket_watchers tw JOIN users u ON u.id=tw.user_id WHERE tw.ticket_id=?`, [req.params.id]);

    res.json({ success:true, data:{...ticket, tags, checklist, timeLogs, history, watchers} });
  } catch (err) { next(err); }
};

// ── PATCH /api/tickets/:id/status ────────────────────────────
const changeStatus = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { status } = req.body;
    const [[ticket]]  = await conn.query('SELECT * FROM tickets WHERE id=?', [req.params.id]);
    if (!ticket) return res.status(404).json({ success:false, message:'Ticket not found' });

    const validTransitions = {
      open:          ['in_progress'],
      in_progress:   ['under_review','open'],
      under_review:  ['testing','in_progress'],
      testing:       ['resolved','in_progress'],
      resolved:      ['closed'],
      closed:        []
    };
    if (!validTransitions[ticket.status]?.includes(status)) {
      return res.status(400).json({ success:false, message:`Invalid transition: ${ticket.status} → ${status}` });
    }

    const updateFields = { status };
    if (status === 'resolved' || status === 'closed') updateFields.closed_at = new Date();

    await conn.query('UPDATE tickets SET status=?, closed_at=? WHERE id=?',
      [status, updateFields.closed_at||ticket.closed_at, ticket.id]);
    await logHistory(conn, ticket.id, req.user.id, 'status_changed', 'status', ticket.status, status);

    // POINTS: on resolve, check if on-time or overdue
    if (status === 'resolved' && ticket.assignee_id) {
      await PointsService.evaluateCompletion(conn, ticket);
    }
    await conn.commit();

    // Notify all watchers
    const [watchers] = await db.query('SELECT user_id FROM ticket_watchers WHERE ticket_id=?', [ticket.id]);
    for (const w of watchers) {
      if (w.user_id !== req.user.id) {
        await NotifyService.send(req.app.get('io'), {
          user_id: w.user_id, type:'status_changed',
          title:`Ticket ${ticket.ticket_code} moved to ${status}`,
          message:ticket.title, entity_type:'ticket', entity_id:ticket.id
        });
      }
    }
    res.json({ success:true, message:'Status updated' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
};

// ── PATCH /api/tickets/:id ───────────────────────────────────
const update = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const [[ticket]] = await conn.query('SELECT * FROM tickets WHERE id=?', [id]);
    if (!ticket) return res.status(404).json({ success:false, message:'Ticket not found' });

    // Only SA/Admin/PM/TL/QA may flag a ticket as a bug
    if (req.body.is_bug) {
      const BUG_ROLES = ['super_admin','admin','project_manager','team_lead','qa'];
      if (!BUG_ROLES.includes(req.user.role)) {
        return res.status(403).json({ success:false, message:'Only QA, Team Lead, PM, or Admin can flag a ticket as a bug' });
      }
    }

    const allowed = ['title','description','priority','assignee_id','start_date','due_date','estimated_hrs','is_bug','bug_severity'];
    const fields  = Object.keys(req.body).filter(k => allowed.includes(k));

    if (fields.length) {
      const sets = fields.map(f=>`${f}=?`).join(',');
      await conn.query(`UPDATE tickets SET ${sets} WHERE id=?`, [...fields.map(f=>req.body[f]), id]);
      for (const f of fields) {
        if (ticket[f] != req.body[f]) {
          await logHistory(conn, id, req.user.id, 'updated', f, String(ticket[f] ?? ''), String(req.body[f] ?? ''));
        }
      }
    }

    // Handle bug flagging and points
    if (req.body.is_bug && req.body.bug_severity && !ticket.is_bug && ticket.assignee_id) {
      await PointsService.applyBugPenalty(conn, ticket.id, ticket.assignee_id, req.body.bug_severity, null);
    }

    await conn.commit();

    // If assignee changed, notify new assignee and ensure they are a watcher
    const newAssigneeId = req.body.assignee_id !== undefined ? req.body.assignee_id : ticket.assignee_id;
    if ('assignee_id' in req.body && req.body.assignee_id != ticket.assignee_id) {
      if (newAssigneeId) {
        // Add as watcher
        await db.query(
          'INSERT IGNORE INTO ticket_watchers (ticket_id, user_id) VALUES (?, ?)',
          [id, newAssigneeId]
        );
        // Notify new assignee
        await NotifyService.send(req.app.get('io'), {
          user_id: newAssigneeId,
          type: 'assigned',
          title: 'Ticket assigned to you',
          message: `${ticket.title} (${ticket.ticket_code})`,
          entity_type: 'ticket',
          entity_id: +id,
        });
      }
    }

    res.json({ success:true, message:'Ticket updated' });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
};

// ── DELETE /api/tickets/:id ──────────────────────────────────
const remove = async (req, res, next) => {
  try {
    await db.query('DELETE FROM tickets WHERE id=?', [req.params.id]);
    res.json({ success:true, message:'Ticket deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/tickets/:id/time-log ──────────────────────────
const logTime = async (req, res, next) => {
  try {
    const { hours, work_date, note, is_billable=true } = req.body;
    await db.query(
      'INSERT INTO time_logs (ticket_id,user_id,hours,work_date,note,is_billable) VALUES (?,?,?,?,?,?)',
      [req.params.id, req.user.id, hours, work_date, note, is_billable]
    );
    // Log bug fix completion if this is a bug
    const [[ticket]] = await db.query('SELECT * FROM tickets WHERE id=?', [req.params.id]);
    if (ticket?.is_bug && ticket?.assignee_id) {
      await PointsService.updateBugSeverityFromTime(req.params.id, ticket.assignee_id, ticket.bug_severity, hours);
    }
    res.status(201).json({ success:true, message:'Time logged' });
  } catch (err) { next(err); }
};

// Manual point adjustment (admin route) — minimal implementation
const adjustPoints = async (req, res, next) => {
  try {
    const { user_id, delta } = req.body;
    // For now just acknowledge the adjustment; full implementation can update logs/points
    res.json({ success: true, message: 'Points adjusted (stub)', data: { user_id, delta: +delta } });
  } catch (err) { next(err); }
};

// internal helper
async function logHistory(conn, ticket_id, user_id, action, field, old_val, new_val) {
  await conn.query(
    'INSERT INTO ticket_history (ticket_id,user_id,action,field_changed,old_value,new_value) VALUES (?,?,?,?,?,?)',
    [ticket_id, user_id, action, field||null, old_val||null, new_val||null]
  );
}

// Alias and small stub for bug logging used by routes
const logBug = async (req, res, next) => {
  try {
    const { fix_minutes } = req.body;
    // Minimal stub: acknowledge the bug log. More logic can be added later.
    res.json({ success: true, message: 'Bug log recorded', data: { fix_minutes: +fix_minutes || 0 } });
  } catch (err) { next(err); }
};

module.exports = { list, create, getOne, get: getOne, changeStatus, update, remove, logTime, logBug, adjustPoints };
