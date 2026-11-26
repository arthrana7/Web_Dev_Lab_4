const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const appEvents = require('../events/appEvents');
const { parseCookies } = require('../middleware/auth');

module.exports = function initializeChat(io) {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth && socket.handshake.auth.token;

      // Fallback: cookie
      if (!token && socket.handshake.headers.cookie) {
        const cookies = parseCookies(socket.handshake.headers.cookie);
        token = cookies.token;
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user info to socket.data.user
      socket.data.user = {
        id: user._id.toString(),
        username: user.username,
        role: user.role
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Helper to broadcast room active users list
  const broadcastRoomUsers = async (roomName) => {
    try {
      const sockets = await io.in(roomName).fetchSockets();
      const users = sockets.map((s) => (s.data.user ? s.data.user.username : 'Unknown'));
      const uniqueUsers = Array.from(new Set(users));
      io.to(roomName).emit('roomUsers', {
        room: roomName,
        users: uniqueUsers
      });
    } catch (err) {
      console.error(`Error broadcasting room users for ${roomName}:`, err.message);
    }
  };

  io.on('connection', (socket) => {
    // Console log format:
    // User connected: <socket.id> (ANSI green)
    console.log(`\x1b[32mUser connected: ${socket.id}\x1b[0m`);

    // Track active rooms for this socket
    const activeRooms = new Set();

    // Event: joinRoom
    socket.on('joinRoom', async (roomName = 'general') => {
      const room = roomName || 'general';
      socket.join(room);
      activeRooms.add(room);

      // Console log format:
      // <socket.id> joined room general
      console.log(`${socket.id} joined room ${room}`);

      // Send the last 20 messages of that room
      try {
        const history = await Message.find({ room })
          .sort({ createdAt: -1 })
          .limit(20);

        const chronologicalHistory = history.reverse().map((msg) => ({
          room: msg.room,
          username: msg.username,
          text: msg.text,
          time: msg.createdAt ? msg.createdAt.toISOString() : new Date().toISOString()
        }));

        // Send history directly to the joining socket
        socket.emit('messageHistory', chronologicalHistory);
      } catch (err) {
        console.error(`Error fetching chat history for room ${room}:`, err.message);
      }

      // Broadcast systemMessage to room
      io.to(room).emit('systemMessage', {
        room,
        text: `${socket.data.user.username} has joined the room`,
        time: new Date().toISOString()
      });

      // Broadcast room users
      await broadcastRoomUsers(room);
    });

    // Event: chatMessage
    socket.on('chatMessage', async (data) => {
      try {
        const room = (data && data.room) ? String(data.room).trim() : 'general';
        const text = (data && data.text) ? String(data.text).trim() : '';

        if (!text) return;

        const username = socket.data.user.username;

        // Save each chat message to MongoDB
        await Message.create({
          room,
          username,
          text
        });

        // Server console logs MUST look EXACTLY like this format:
        // [general] Aditi: Hey team, backend is ready
        console.log(`[${room}] ${username}: ${text}`);

        // Emit to appEvents for message counter
        appEvents.emit('chat:message', { room, username, text });

        // Server -> client message broadcast
        io.to(room).emit('message', {
          room,
          username,
          text,
          time: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error handling chatMessage:', err.message);
      }
    });

    // Event: leaveRoom
    socket.on('leaveRoom', async (roomName) => {
      if (!roomName) return;
      socket.leave(roomName);
      activeRooms.delete(roomName);

      io.to(roomName).emit('systemMessage', {
        room: roomName,
        text: `${socket.data.user.username} has left the room`,
        time: new Date().toISOString()
      });

      await broadcastRoomUsers(roomName);
    });

    // On disconnect
    socket.on('disconnect', async () => {
      // Log "User disconnected: <socket.id>" on disconnect
      console.log(`User disconnected: ${socket.id}`);

      // Update room users for rooms this socket was in
      for (const room of activeRooms) {
        await broadcastRoomUsers(room);
      }
    });
  });
};
