// Load dotenv at the very top of server.js
require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');

// Fail fast if required environment variables are missing
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error('FATAL: MONGO_URI is not defined in environment variables.');
  process.exit(1);
}

const connectDB = require('./config/db');
const appEvents = require('./events/appEvents');
const { verifyToken } = require('./middleware/auth');
const User = require('./models/User');

// Routes
const authRoutes = require('./routes/auth');
const notesRoutes = require('./routes/notes');
const adminRoutes = require('./routes/admin');
const initializeChat = require('./sockets/chat');

// Initialize Express App and HTTP Server
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server);
initializeChat(io);

// Parse JSON request bodies
app.use(express.json());

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Register Event Listeners (registered once)
let totalChatMessages = 0;

appEvents.on('user:registered', (username) => {
  console.log(`[event] user:registered -> ${username}`);
});

appEvents.on('user:loggedIn', (username) => {
  console.log(`[event] user:loggedIn -> ${username}`);
});

appEvents.on('note:created', ({ title, owner }) => {
  console.log(`[event] note:created -> ${title} by ${owner}`);
});

appEvents.on('chat:message', () => {
  totalChatMessages++;
  console.log(`[event] chat:message -> total messages: ${totalChatMessages}`);
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/admin', adminRoutes);

// Protected user profile
app.get('/api/profile', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

// Root endpoint: quick check
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// 404 handler returning JSON { "message": "..." }
app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Global error-handling middleware returning JSON { "message": "..." }
app.use((err, req, res, next) => {
  console.error('[error]', err.message || err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[server error] Port ${PORT} is already in use. Run 'kill -9 $(lsof -t -i :${PORT})' or set a different PORT in .env.`);
    process.exit(1);
  }
  console.error('[server error]', error.message || error);
  process.exit(1);
});

// Connect to DB and start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
});
