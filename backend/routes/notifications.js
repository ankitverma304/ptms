// ── notifications.js ─────────────────────────────────────────
const express = require('express');
const rN = express.Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');
rN.use(authenticate);

rN.get('/', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.id]
    );
    const [[{ unread }]] = await db.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id=? AND is_read=0', [req.user.id]
    );
    res.json({ success:true, data:rows, unread });
  } catch (err) { next(err); }
});

rN.patch('/read-all', async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    res.json({ success:true, message:'All marked as read' });
  } catch (err) { next(err); }
});

rN.patch('/:id/read', async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success:true });
  } catch (err) { next(err); }
});

module.exports = rN;
