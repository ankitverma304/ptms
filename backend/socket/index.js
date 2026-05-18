const jwt = require('jsonwebtoken');

module.exports = (io) => {
  // Authenticate socket connections via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Each user joins their private room for notifications
    socket.join(`user:${socket.userId}`);

    // Join a project room to receive live ticket updates
    socket.on('join:project', (project_id) => {
      socket.join(`project:${project_id}`);
    });

    socket.on('leave:project', (project_id) => {
      socket.leave(`project:${project_id}`);
    });

    // Join a ticket room for live comments
    socket.on('join:ticket', (ticket_id) => {
      socket.join(`ticket:${ticket_id}`);
    });

    socket.on('leave:ticket', (ticket_id) => {
      socket.leave(`ticket:${ticket_id}`);
    });

    socket.on('disconnect', () => {
      // rooms are cleaned up automatically
    });
  });
};
