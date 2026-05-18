const db            = require('../config/db');
const NotifyService = require('../services/notifyService');

// ── GET /api/tickets/:ticketId/comments ──────────────────────
const list = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.body, c.is_edited, c.created_at, c.updated_at,
             u.id AS user_id, u.name AS user_name, u.avatar_url,
             GROUP_CONCAT(DISTINCT ca.file_name) AS attachment_names,
             GROUP_CONCAT(DISTINCT ca.file_path) AS attachment_paths
      FROM comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN comment_attachments ca ON ca.comment_id = c.id
      WHERE c.ticket_id=? AND c.deleted_at IS NULL
      GROUP BY c.id, c.body, c.is_edited, c.created_at, c.updated_at, u.id, u.name, u.avatar_url
      ORDER BY c.created_at ASC
    `, [req.params.ticketId]);
    res.json({ success:true, data:rows });
  } catch (err) { next(err); }
};

// ── POST /api/tickets/:ticketId/comments ─────────────────────
const create = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { body, mentions=[] } = req.body;
    const ticketId = req.params.ticketId;

    const [result] = await conn.query(
      'INSERT INTO comments (ticket_id,user_id,body) VALUES (?,?,?)',
      [ticketId, req.user.id, body]
    );
    const commentId = result.insertId;

    // Handle @mentions
    for (const uid of mentions) {
      await conn.query(
        'INSERT IGNORE INTO comment_mentions (comment_id,user_id) VALUES (?,?)', [commentId, uid]
      );
    }

    // Check for /assign command
    const assignMatch = body.match(/\/assign\s+@(\S+)/i);
    if (assignMatch) {
      const [targetUser] = await conn.query('SELECT id FROM users WHERE name LIKE ?', [`%${assignMatch[1]}%`]);
      if (targetUser.length) {
        await conn.query('UPDATE tickets SET assignee_id=? WHERE id=?', [targetUser[0].id, ticketId]);
      }
    }

    await conn.commit();

    // Notify watchers
    const [watchers] = await db.query(
      'SELECT user_id FROM ticket_watchers WHERE ticket_id=?', [ticketId]
    );
    const [[ticket]] = await db.query('SELECT ticket_code,title FROM tickets WHERE id=?', [ticketId]);
    for (const w of watchers) {
      if (w.user_id !== req.user.id) {
        await NotifyService.send(req.app.get('io'), {
          user_id: w.user_id, type:'commented',
          title:`New comment on ${ticket.ticket_code}`,
          message: ticket.title, entity_type:'ticket', entity_id:+ticketId
        });
      }
    }
    // Notify @mentioned users specifically
    for (const uid of mentions) {
      if (uid !== req.user.id) {
        await NotifyService.send(req.app.get('io'), {
          user_id: uid, type:'mentioned',
          title:`You were mentioned in ${ticket.ticket_code}`,
          message: ticket.title, entity_type:'ticket', entity_id:+ticketId
        });
      }
    }

    req.app.get('io').to(`ticket:${ticketId}`).emit('comment:new', {
      id: commentId, body, user_id: req.user.id, user_name: req.user.name,
      created_at: new Date()
    });

    res.status(201).json({ success:true, message:'Comment added', data:{ id:commentId } });
  } catch (err) { await conn.rollback(); next(err); }
  finally { conn.release(); }
};

// ── PATCH /api/comments/:id ──────────────────────────────────
const update = async (req, res, next) => {
  try {
    const [[comment]] = await db.query('SELECT * FROM comments WHERE id=?', [req.params.id]);
    if (!comment) return res.status(404).json({ success:false, message:'Comment not found' });
    if (comment.user_id !== req.user.id) return res.status(403).json({ success:false, message:'Forbidden' });

    const editWindow = 15 * 60 * 1000; // 15 minutes
    if (Date.now() - new Date(comment.created_at).getTime() > editWindow) {
      return res.status(403).json({ success:false, message:'Edit window (15 min) expired' });
    }
    await db.query('UPDATE comments SET body=?, is_edited=1 WHERE id=?', [req.body.body, req.params.id]);
    res.json({ success:true, message:'Comment updated' });
  } catch (err) { next(err); }
};

// ── DELETE /api/comments/:id ─────────────────────────────────
const remove = async (req, res, next) => {
  try {
    await db.query('UPDATE comments SET deleted_at=NOW() WHERE id=?', [req.params.id]);
    res.json({ success:true, message:'Comment deleted' });
  } catch (err) { next(err); }
};

module.exports = { list, create, update, remove };
