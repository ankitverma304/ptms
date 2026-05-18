const db = require('../config/db');

/**
 * Create a notification record and push real-time event via Socket.IO.
 * @param {Server} io — Socket.IO server instance (from req.app.get('io'))
 * @param {Object} opts
 */
const send = async (io, { user_id, type, title, message, entity_type, entity_id }) => {
  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id,type,title,message,entity_type,entity_id)
       VALUES (?,?,?,?,?,?)`,
      [user_id, type, title, message||null, entity_type||null, entity_id||null]
    );

    // Emit to the user's private room (user joins room `user:{id}` on socket connect)
    if (io) {
      io.to(`user:${user_id}`).emit('notification', {
        id:          result.insertId,
        type, title, message,
        entity_type, entity_id,
        is_read:     false,
        created_at:  new Date()
      });
    }
  } catch (err) {
    // Non-fatal — log but don't crash the main flow
    console.error('[NotifyService] error:', err.message);
  }
};

/**
 * Broadcast a ticket event to all users in a project room.
 */
const broadcastTicketEvent = (io, project_id, event, payload) => {
  if (io) io.to(`project:${project_id}`).emit(event, payload);
};

module.exports = { send, broadcastTicketEvent };
