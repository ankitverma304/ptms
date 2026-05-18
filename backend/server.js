require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');

const routes            = require('./routes');
const { errorHandler }  = require('./middleware/errorHandler');
const db                = require('./config/db');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }
});

app.set('io', io);

io.on('connection', (socket) => {
  socket.on('join_project', (projectId) => socket.join(`project:${projectId}`));
  socket.on('leave_project', (projectId) => socket.leave(`project:${projectId}`));
  socket.on('join_user', (userId) => socket.join(`user:${userId}`));
});

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/v1', routes);

app.get('/health', async (req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', db: 'connected' }); }
  catch { res.status(500).json({ status: 'error', db: 'disconnected' }); }
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => res.sendFile(path.join(frontendBuild, 'index.html')));
} else {
  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 PTMS API running on http://localhost:${PORT}\n`);
});

module.exports = { app, io };
