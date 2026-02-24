const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const emailjs = require('@emailjs/nodejs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5175', 'http://127.0.0.1:5175'],
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// ─── In-memory store ───────────────────────────────────────────────────────────
const users = new Map();          // socketId → user object
const usersByUsername = new Map(); // username  → socketId
const rooms = new Map();          // roomId    → room object
const directRoomKeys = new Map(); // "id1_id2" → roomId
const registeredUsers = new Map(); // email → { email, username, color }
const otpStore = new Map();       // email → { otp, expiresAt, username? }

// ─── Seed: General room ────────────────────────────────────────────────────────
const GENERAL_ID = 'general';
rooms.set(GENERAL_ID, {
  id: GENERAL_ID,
  name: 'General',
  description: 'Welcome to TatheerApp!',
  type: 'group',
  members: [],
  messages: [],
  createdAt: new Date(),
  lastActivity: new Date(),
  lastMessage: null,
  createdBy: 'system',
  icon: '💬',
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    color: user.color,
    status: user.status,
    lastSeen: user.lastSeen,
    bio: user.bio || '',
  };
}

function getOnlineUsers() {
  return Array.from(users.values()).map(getPublicUser);
}

function getRoomsForUser(socketId) {
  const user = users.get(socketId);
  if (!user) return [];
  return user.rooms
    .map((roomId) => {
      const room = rooms.get(roomId);
      if (!room) return null;
      return { ...room, messages: room.messages.slice(-60) };
    })
    .filter(Boolean);
}

function broadcastRoomUpdate(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room:updated', {
    roomId,
    lastMessage: room.lastMessage,
    lastActivity: room.lastActivity,
  });
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp, userName) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn('EmailJS not configured. Missing:', {
      serviceId: !!serviceId,
      templateId: !!templateId,
      publicKey: !!publicKey,
      privateKey: !!privateKey,
    });
    return false;
  }
  try {
    // Template vars: {{to_email}}, {{user_name}}, {{otp_code}}
    await emailjs.send(serviceId, templateId, {
      to_email: email,
      reply_to: email,
      user_name: userName || 'User',
      otp,
      otp_code: otp,
      code: otp,
      verification_code: otp,
    }, {
      publicKey,
      privateKey,
    });
    return true;
  } catch (err) {
    console.error('EmailJS send failed:', err?.message || err);
    if (err?.text) console.error('EmailJS response:', err.text);
    // Common fix: enable "Allow API requests" at https://dashboard.emailjs.com/admin/account/security
    if (String(err?.message || '').toLowerCase().includes('forbidden') || err?.status === 403) {
      console.error('Tip: Enable "Allow API requests" in EmailJS Account > Security for Node.js apps.');
    }
    return false;
  }
}

// ─── Auth API (email + OTP) ────────────────────────────────────────────────────
app.post('/api/auth/request-otp', async (req, res) => {
  const { email, username, color } = req.body;
  const trimmedEmail = email?.trim()?.toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Valid email is required.' });
  }
  const isRegister = !!username?.trim();
  const trimmedUsername = username?.trim();
  if (isRegister) {
    if (!trimmedUsername || trimmedUsername.length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters.' });
    }
    if (registeredUsers.has(trimmedEmail)) {
      return res.status(400).json({ error: 'Email already registered. Use Login instead.' });
    }
    const usernameTaken = usersByUsername.has(trimmedUsername) ||
      Array.from(registeredUsers.values()).some((u) => u.username === trimmedUsername);
    if (usernameTaken) {
      return res.status(400).json({ error: 'Username is taken. Choose another.' });
    }
  } else {
    if (!registeredUsers.has(trimmedEmail)) {
      return res.status(400).json({ error: 'Email not registered. Create an account first.' });
    }
  }
  const otp = generateOTP();
  otpStore.set(trimmedEmail, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    username: trimmedUsername || registeredUsers.get(trimmedEmail)?.username,
    color: color || '#00a884',
  });
  const userName = trimmedUsername || registeredUsers.get(trimmedEmail)?.username || 'User';
  const sent = await sendOTPEmail(trimmedEmail, otp, userName);
  if (!sent) {
    if (process.env.NODE_ENV === 'development' && process.env.DEV_OTP === 'true') {
      console.log(`[DEV] OTP for ${trimmedEmail}: ${otp}`);
      res.json({ success: true, message: 'OTP sent (dev mode - check server console)' });
    } else {
      otpStore.delete(trimmedEmail);
      return res.status(500).json({ error: 'Failed to send OTP. Configure EmailJS or set DEV_OTP=true for dev.' });
    }
  } else {
    res.json({ success: true, message: 'OTP sent to your email.' });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  const trimmedEmail = email?.trim()?.toLowerCase();
  if (!trimmedEmail || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }
  const stored = otpStore.get(trimmedEmail);
  if (!stored) {
    return res.status(400).json({ error: 'OTP expired or invalid. Request a new one.' });
  }
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(trimmedEmail);
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }
  if (stored.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }
  otpStore.delete(trimmedEmail);
  let user = registeredUsers.get(trimmedEmail);
  if (!user) {
    user = {
      email: trimmedEmail,
      username: stored.username,
      color: stored.color || '#00a884',
    };
    registeredUsers.set(trimmedEmail, user);
  }
  res.json({ success: true, user: { email: user.email, username: user.username, color: user.color } });
});

// ─── Socket handlers ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  // ── JOIN ──────────────────────────────────────────────────────────────────
  socket.on('user:join', ({ username, color, bio }) => {
    const trimmed = username?.trim();
    if (!trimmed || trimmed.length < 2) {
      socket.emit('error', { message: 'Username must be at least 2 characters.' });
      return;
    }

    if (usersByUsername.has(trimmed)) {
      socket.emit('error', { message: 'Username is already taken. Choose another.' });
      return;
    }

    const user = {
      id: socket.id,
      username: trimmed,
      color: color || '#00a884',
      bio: bio || '',
      socketId: socket.id,
      rooms: [GENERAL_ID],
      status: 'online',
      lastSeen: null,
      joinedAt: new Date(),
    };

    users.set(socket.id, user);
    usersByUsername.set(trimmed, socket.id);

    socket.join(GENERAL_ID);
    const genRoom = rooms.get(GENERAL_ID);
    if (!genRoom.members.includes(socket.id)) genRoom.members.push(socket.id);

    // ── system message ──
    const sysMsg = {
      id: uuidv4(),
      roomId: GENERAL_ID,
      senderId: 'system',
      senderName: 'System',
      senderColor: '#8696a0',
      content: `${trimmed} joined the chat 👋`,
      type: 'system',
      replyTo: null,
      reactions: {},
      readBy: [],
      createdAt: new Date(),
    };
    genRoom.messages.push(sysMsg);
    genRoom.lastMessage = sysMsg;
    genRoom.lastActivity = new Date();
    io.to(GENERAL_ID).emit('message:new', sysMsg);

    socket.emit('user:joined', {
      user,
      rooms: getRoomsForUser(socket.id),
      onlineUsers: getOnlineUsers(),
    });

    socket.broadcast.emit('user:online', {
      user: getPublicUser(user),
      onlineUsers: getOnlineUsers(),
    });

    console.log(`✅ ${trimmed} joined`);
  });

  // ── SEND MESSAGE ──────────────────────────────────────────────────────────
  socket.on('message:send', ({ roomId, content, replyTo, type = 'text' }) => {
    const user = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!user || !room) return;
    if (!content?.trim()) return;

    const message = {
      id: uuidv4(),
      roomId,
      senderId: socket.id,
      senderName: user.username,
      senderColor: user.color,
      content: content.trim(),
      type,
      replyTo: replyTo || null,
      reactions: {},
      readBy: [socket.id],
      deliveredTo: [socket.id],
      createdAt: new Date(),
      edited: false,
    };

    room.messages.push(message);
    room.lastMessage = message;
    room.lastActivity = new Date();

    io.to(roomId).emit('message:new', message);
    broadcastRoomUpdate(roomId);
  });

  // ── EDIT MESSAGE ──────────────────────────────────────────────────────────
  socket.on('message:edit', ({ roomId, messageId, newContent }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId !== socket.id) return;
    msg.content = newContent.trim();
    msg.edited = true;
    msg.editedAt = new Date();
    io.to(roomId).emit('message:edited', { messageId, content: msg.content, editedAt: msg.editedAt });
  });

  // ── DELETE MESSAGE ────────────────────────────────────────────────────────
  socket.on('message:delete', ({ roomId, messageId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const idx = room.messages.findIndex((m) => m.id === messageId && m.senderId === socket.id);
    if (idx === -1) return;
    room.messages[idx] = { ...room.messages[idx], content: 'This message was deleted', deleted: true };
    io.to(roomId).emit('message:deleted', { messageId });
  });

  // ── REACT TO MESSAGE ──────────────────────────────────────────────────────
  socket.on('message:react', ({ messageId, roomId, emoji }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg) return;

    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const idx = msg.reactions[emoji].indexOf(socket.id);
    if (idx > -1) {
      msg.reactions[emoji].splice(idx, 1);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(socket.id);
    }

    io.to(roomId).emit('message:reacted', { messageId, reactions: msg.reactions });
  });

  // ── TYPING ────────────────────────────────────────────────────────────────
  socket.on('typing:start', ({ roomId }) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.to(roomId).emit('typing:start', { userId: socket.id, username: user.username, roomId });
  });

  socket.on('typing:stop', ({ roomId }) => {
    socket.to(roomId).emit('typing:stop', { userId: socket.id, roomId });
  });

  // ── DIRECT MESSAGE ────────────────────────────────────────────────────────
  socket.on('dm:create', ({ targetUserId }) => {
    const user = users.get(socket.id);
    const targetUser = users.get(targetUserId);
    if (!user || !targetUser) return;

    const dmKey = [socket.id, targetUserId].sort().join('_');

    let roomId = directRoomKeys.get(dmKey);
    if (!roomId) {
      roomId = uuidv4();
      directRoomKeys.set(dmKey, roomId);

      const room = {
        id: roomId,
        name: `${user.username} & ${targetUser.username}`,
        type: 'direct',
        members: [socket.id, targetUserId],
        memberNames: { [socket.id]: user.username, [targetUserId]: targetUser.username },
        memberColors: { [socket.id]: user.color, [targetUserId]: targetUser.color },
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        lastMessage: null,
      };
      rooms.set(roomId, room);

      user.rooms.push(roomId);
      targetUser.rooms.push(roomId);

      socket.join(roomId);
      const targetSocket = io.sockets.sockets.get(targetUserId);
      if (targetSocket) targetSocket.join(roomId);

      const roomData = { ...room, messages: [] };
      socket.emit('dm:created', { room: roomData, messages: [] });
      if (targetSocket) targetSocket.emit('dm:invited', { room: roomData, messages: [] });
    } else {
      const room = rooms.get(roomId);
      socket.emit('dm:created', { room, messages: room.messages.slice(-60) });
    }
  });

  // ── CREATE GROUP ──────────────────────────────────────────────────────────
  socket.on('room:create', ({ name, memberIds, icon }) => {
    const user = users.get(socket.id);
    if (!user || !name?.trim()) return;

    const roomId = uuidv4();
    const allMembers = [socket.id, ...memberIds.filter((id) => users.has(id))];

    const room = {
      id: roomId,
      name: name.trim(),
      description: '',
      type: 'group',
      icon: icon || '👥',
      members: allMembers,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      lastMessage: null,
      createdBy: socket.id,
    };

    rooms.set(roomId, room);

    allMembers.forEach((memberId) => {
      const member = users.get(memberId);
      if (!member) return;
      if (!member.rooms.includes(roomId)) member.rooms.push(roomId);
      const memberSocket = io.sockets.sockets.get(memberId);
      if (memberSocket) {
        memberSocket.join(roomId);
        memberSocket.emit('room:created', { room });
      }
    });
  });

  // ── DELIVERY RECEIPTS (recipient online, received message) ─────────────────
  socket.on('message:delivered', ({ roomId, messageId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const msg = room.messages.find((m) => m.id === messageId);
    if (!msg) return;
    if (!msg.deliveredTo) msg.deliveredTo = [];
    if (!msg.deliveredTo.includes(socket.id)) msg.deliveredTo.push(socket.id);
    // Notify the sender
    const senderSocket = io.sockets.sockets.get(msg.senderId);
    if (senderSocket) {
      senderSocket.emit('message:delivered', { roomId, messageId, userId: socket.id });
    }
  });

  // ── READ RECEIPTS ─────────────────────────────────────────────────────────
  socket.on('messages:read', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.messages.forEach((msg) => {
      if (!msg.readBy) msg.readBy = [];
      if (!msg.readBy.includes(socket.id)) msg.readBy.push(socket.id);
    });
    // Broadcast to entire room so message senders get the read receipt update
    io.to(roomId).emit('messages:read', { roomId, userId: socket.id });
  });

  // ── VOICE / VIDEO CALLS ────────────────────────────────────────────────────
  socket.on('call:start', ({ targetUserId, type }) => {
    const caller = users.get(socket.id);
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (!caller || !targetSocket) return;
    targetSocket.emit('call:incoming', {
      fromUserId: socket.id,
      fromUser: getPublicUser(caller),
      type: type || 'video',
    });
  });

  socket.on('call:offer', ({ targetUserId, offer }) => {
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) targetSocket.emit('call:offer', { fromUserId: socket.id, offer });
  });

  socket.on('call:answer', ({ targetUserId, answer }) => {
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) targetSocket.emit('call:answer', { fromUserId: socket.id, answer });
  });

  socket.on('call:ice-candidate', ({ targetUserId, candidate }) => {
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) targetSocket.emit('call:ice-candidate', { fromUserId: socket.id, candidate });
  });

  socket.on('call:reject', ({ fromUserId }) => {
    const targetSocket = io.sockets.sockets.get(fromUserId);
    if (targetSocket) targetSocket.emit('call:rejected', { byUserId: socket.id });
  });

  socket.on('call:end', ({ targetUserId }) => {
    const targetSocket = io.sockets.sockets.get(targetUserId);
    if (targetSocket) targetSocket.emit('call:ended', { byUserId: socket.id });
  });

  // ── USER STATUS ───────────────────────────────────────────────────────────
  socket.on('user:status', ({ status }) => {
    const user = users.get(socket.id);
    if (!user) return;
    user.status = status;
    io.emit('user:statusChanged', { userId: socket.id, status });
  });

  // ── DISCONNECT ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    user.status = 'offline';
    user.lastSeen = new Date();
    usersByUsername.delete(user.username);
    users.delete(socket.id);

    user.rooms.forEach((roomId) => {
      const room = rooms.get(roomId);
      if (room) room.members = room.members.filter((id) => id !== socket.id);
    });

    io.emit('user:offline', {
      userId: socket.id,
      username: user.username,
      lastSeen: user.lastSeen,
      onlineUsers: getOnlineUsers(),
    });

    console.log(`👋 ${user.username} disconnected`);
  });
});

// ─── REST health check ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', onlineUsers: users.size, rooms: rooms.size });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 TatheerApp server running on http://localhost:${PORT}`);
});
