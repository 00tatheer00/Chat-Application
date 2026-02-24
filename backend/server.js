const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const emailjs = require('@emailjs/nodejs');

const { connectDB } = require('./db/connect');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const Otp = require('./models/Otp');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Serve uploaded avatars
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Runtime: socket ↔ user mapping ───────────────────────────────────────────
const socketIdToUserId = new Map();
const userIdToSocketId = new Map();
const otpStore = new Map(); // in-memory fallback for OTP (MongoDB Otp also used)

const GENERAL_ID = 'general';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function toPublicUser(user) {
  if (!user) return null;
  const id = user._id?.toString?.() || user.id;
  return {
    id,
    username: user.username,
    color: user.color || '#00a884',
    status: user.status || 'offline',
    lastSeen: user.lastSeen,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || null,
  };
}

async function getOnlineUsers() {
  const userIds = Array.from(userIdToSocketId.keys());
  const users = await User.find({ _id: { $in: userIds } }).lean();
  return users.map(toPublicUser);
}

async function getRoomsForUser(userId) {
  const rooms = await Room.find({ members: userId }).sort({ lastActivity: -1 }).lean();
  const result = [];
  for (const room of rooms) {
    const messages = await Message.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(60).lean();
    const roomObj = {
      ...room,
      id: room._id,
      lastMessage: room.lastMessage ? await Message.findById(room.lastMessage).lean() : null,
      messages: messages.reverse(),
    };
    if (roomObj.lastMessage) roomObj.lastMessage.id = roomObj.lastMessage._id?.toString();
    roomObj.messages = roomObj.messages.map((m) => ({ ...m, id: m._id?.toString() }));
    result.push(roomObj);
  }
  return result;
}

function broadcastRoomUpdate(roomId, lastMessage, lastActivity) {
  io.to(roomId).emit('room:updated', { roomId, lastMessage, lastActivity });
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
    console.warn('EmailJS not configured.');
    return false;
  }
  try {
    await emailjs.send(serviceId, templateId, {
      to_email: email,
      reply_to: email,
      user_name: userName || 'User',
      otp,
      otp_code: otp,
      code: otp,
      verification_code: otp,
    }, { publicKey, privateKey });
    return true;
  } catch (err) {
    console.error('EmailJS send failed:', err?.message || err);
    if (err?.status === 403 || String(err?.message || '').toLowerCase().includes('forbidden')) {
      console.error('→ Enable "Allow API requests" in EmailJS: https://dashboard.emailjs.com/admin/account/security');
    }
    return false;
  }
}

async function ensureGeneralRoom() {
  let room = await Room.findById(GENERAL_ID);
  if (!room) {
    room = await Room.create({
      _id: GENERAL_ID,
      name: 'General',
      description: 'Welcome to TatheerApp!',
      type: 'group',
      members: [],
      createdBy: 'system',
      icon: '💬',
    });
    console.log('Created General room');
  }
  return room;
}

// ─── Auth API ──────────────────────────────────────────────────────────────────
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
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered. Use Login instead.' });
    }
    const usernameTaken = await User.findOne({ username: trimmedUsername });
    if (usernameTaken) {
      return res.status(400).json({ error: 'Username is taken. Choose another.' });
    }
  } else {
    const existing = await User.findOne({ email: trimmedEmail });
    if (!existing) {
      return res.status(400).json({ error: 'Email not registered. Create an account first.' });
    }
  }
  const otp = generateOTP();
  await Otp.deleteMany({ email: trimmedEmail });
  await Otp.create({
    email: trimmedEmail,
    otp,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    username: trimmedUsername || (await User.findOne({ email: trimmedEmail }))?.username,
    color: color || '#00a884',
  });
  const userName = trimmedUsername || (await User.findOne({ email: trimmedEmail }))?.username || 'User';
  const sent = await sendOTPEmail(trimmedEmail, otp, userName);
  if (!sent) {
    if (process.env.DEV_OTP === 'true') {
      console.log(`[DEV] OTP for ${trimmedEmail}: ${otp}`);
      res.json({ success: true, message: 'OTP sent (dev mode - check server logs)' });
    } else {
      await Otp.deleteOne({ email: trimmedEmail });
      return res.status(500).json({
        error: 'Failed to send OTP. Add DEV_OTP=true to backend env vars to get OTP in server logs, or enable "Allow API requests" in EmailJS Account → Security.',
      });
    }
  } else {
    res.json({ success: true, message: 'OTP sent to your email.' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const trimmedEmail = email?.trim()?.toLowerCase();
  if (!trimmedEmail || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }
  const stored = await Otp.findOne({ email: trimmedEmail });
  if (!stored) {
    return res.status(400).json({ error: 'OTP expired or invalid. Request a new one.' });
  }
  if (Date.now() > new Date(stored.expiresAt).getTime()) {
    await Otp.deleteOne({ email: trimmedEmail });
    return res.status(400).json({ error: 'OTP expired. Request a new one.' });
  }
  const normalizedInput = String(otp || '').replace(/\D/g, '');
  const normalizedStored = String(stored.otp || '').replace(/\D/g, '');
  if (normalizedInput !== normalizedStored) {
    return res.status(400).json({ error: 'Invalid OTP.' });
  }
  await Otp.deleteOne({ email: trimmedEmail });
  let user = await User.findOne({ email: trimmedEmail });
  if (!user) {
    user = await User.create({
      username: stored.username,
      email: trimmedEmail,
      color: stored.color || '#00a884',
    });
  }
  res.json({ success: true, user: { email: user.email, username: user.username, color: user.color } });
});

// ─── Socket handlers ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  socket.on('user:join', async ({ username, color, bio }) => {
    const trimmed = username?.trim();
    if (!trimmed || trimmed.length < 2) {
      socket.emit('error', { message: 'Username must be at least 2 characters.' });
      return;
    }

    const existingUser = await User.findOne({ username: trimmed });
    if (existingUser && userIdToSocketId.has(existingUser._id.toString())) {
      socket.emit('error', { message: 'Username is already taken. Choose another.' });
      return;
    }

    let user = await User.findOne({ username: trimmed });
    if (!user) {
      user = await User.create({
        username: trimmed,
        color: color || '#00a884',
        bio: bio || '',
      });
    } else {
      if (bio !== undefined) user.bio = String(bio || '').slice(0, 150);
      if (color) user.color = color;
      await user.save();
    }

    const userId = user._id.toString();
    socketIdToUserId.set(socket.id, userId);
    userIdToSocketId.set(userId, socket.id);

    const generalRoom = await Room.findById(GENERAL_ID);
    if (!generalRoom.members.includes(userId)) {
      generalRoom.members.push(userId);
      const mNames = generalRoom.memberNames || new Map();
      const mColors = generalRoom.memberColors || new Map();
      mNames.set(userId, user.username);
      mColors.set(userId, user.color);
      generalRoom.memberNames = mNames;
      generalRoom.memberColors = mColors;
      generalRoom.markModified('memberNames');
      generalRoom.markModified('memberColors');
      await generalRoom.save();
    }

    const userRooms = await Room.find({ members: userId });
    for (const r of userRooms) {
      socket.join(r._id);
    }

    const sysMsg = await Message.create({
      roomId: GENERAL_ID,
      senderId: 'system',
      senderName: 'System',
      senderColor: '#8696a0',
      content: `${trimmed} joined the chat 👋`,
      type: 'system',
    });
    const sysMsgObj = { ...sysMsg.toObject(), id: sysMsg._id.toString() };
    generalRoom.lastMessage = sysMsg._id.toString();
    generalRoom.lastActivity = new Date();
    await generalRoom.save();

    io.to(GENERAL_ID).emit('message:new', sysMsgObj);

    const roomsForUser = await getRoomsForUser(userId);
    const onlineUsers = await getOnlineUsers();

    socket.emit('user:joined', {
      user: toPublicUser({ ...user.toObject(), id: userId, status: 'online', rooms: userRooms.map((r) => r._id) }),
      rooms: roomsForUser,
      onlineUsers,
    });

    socket.broadcast.emit('user:online', {
      user: toPublicUser(user),
      onlineUsers,
    });

    console.log(`✅ ${trimmed} joined`);
  });

  socket.on('user:update', async ({ username, color, bio }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) return;

    const updates = {};
    if (username !== undefined) {
      const trimmed = String(username || '').trim();
      if (trimmed.length < 2) {
        socket.emit('error', { message: 'Username must be at least 2 characters.' });
        return;
      }
      if (trimmed !== user.username) {
        const taken = await User.findOne({ username: trimmed });
        if (taken && taken._id.toString() !== userId) {
          socket.emit('error', { message: 'Username is already taken.' });
          return;
        }
        user.username = trimmed;
        updates.username = trimmed;
        await Room.updateMany(
          { members: userId },
          { $set: { [`memberNames.${userId}`]: trimmed, [`memberColors.${userId}`]: user.color } }
        );
      }
    }
    if (color !== undefined && /^#[0-9a-fA-F]{6}$/.test(color)) {
      user.color = color;
      updates.color = color;
      await Room.updateMany({ members: userId }, { $set: { [`memberColors.${userId}`]: color } });
    }
    if (bio !== undefined) {
      user.bio = String(bio || '').slice(0, 150);
      updates.bio = user.bio;
    }
    await user.save();

    socket.emit('user:updated', { user: toPublicUser(user), updates });
    socket.broadcast.emit('user:profileUpdated', { userId, user: toPublicUser(user) });
  });

  socket.on('avatar:upload', async ({ image }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user || !image || typeof image !== 'string') return;

    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      socket.emit('error', { message: 'Invalid image format.' });
      return;
    }
    if (!['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(matches[1].toLowerCase())) {
      socket.emit('error', { message: 'Only JPEG, PNG, GIF, and WebP are allowed.' });
      return;
    }
    const sizeBytes = (matches[2].length * 3) / 4;
    if (sizeBytes > 2 * 1024 * 1024) {
      socket.emit('error', { message: 'Image too large (max 2MB).' });
      return;
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const safeName = user.username.replace(/[^a-z0-9]/gi, '_').slice(0, 30);
    const filename = `avatar-${safeName}-${Date.now()}.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    try {
      fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));
    } catch (err) {
      socket.emit('error', { message: 'Failed to save image.' });
      return;
    }
    const avatarUrl = `/uploads/avatars/${filename}`;
    user.avatarUrl = avatarUrl;
    await user.save();

    socket.emit('user:updated', { user: toPublicUser(user), updates: { avatarUrl } });
    socket.broadcast.emit('user:profileUpdated', { userId, user: toPublicUser(user) });
  });

  socket.on('message:send', async ({ roomId, content, replyTo, type = 'text' }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const user = await User.findById(userId);
    const room = await Room.findById(roomId);
    if (!user || !room || !room.members.includes(userId)) return;
    if (!content?.trim()) return;

    const msg = await Message.create({
      roomId,
      senderId: userId,
      senderName: user.username,
      senderColor: user.color,
      content: content.trim(),
      type,
      replyTo: replyTo || null,
      readBy: [userId],
      deliveredTo: [userId],
    });
    const msgObj = { ...msg.toObject(), id: msg._id.toString() };
    room.lastMessage = msg._id.toString();
    room.lastActivity = new Date();
    await room.save();

    io.to(roomId).emit('message:new', msgObj);
    broadcastRoomUpdate(roomId, msgObj, room.lastActivity);
  });

  socket.on('message:edit', async ({ roomId, messageId, newContent }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const msg = await Message.findOne({ _id: messageId, roomId });
    if (!msg || msg.senderId !== userId) return;
    msg.content = newContent.trim();
    msg.edited = true;
    msg.editedAt = new Date();
    await msg.save();
    io.to(roomId).emit('message:edited', { messageId, content: msg.content, editedAt: msg.editedAt });
  });

  socket.on('message:delete', async ({ roomId, messageId }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const msg = await Message.findOne({ _id: messageId, roomId });
    if (!msg || msg.senderId !== userId) return;
    msg.content = 'This message was deleted';
    msg.deleted = true;
    await msg.save();
    io.to(roomId).emit('message:deleted', { messageId });
  });

  socket.on('message:react', async ({ messageId, roomId, emoji }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const msg = await Message.findById(messageId);
    if (!msg || msg.roomId !== roomId) return;

    const reactions = msg.reactions instanceof Map ? msg.reactions : new Map(Object.entries(msg.reactions || {}));
    const arr = reactions.get(emoji) || [];
    const idx = arr.indexOf(userId);
    if (idx > -1) {
      arr.splice(idx, 1);
      if (arr.length === 0) reactions.delete(emoji);
    } else {
      arr.push(userId);
      reactions.set(emoji, arr);
    }
    msg.reactions = reactions;
    await msg.save();

    const reactionsObj = {};
    reactions.forEach((v, k) => { reactionsObj[k] = v; });
    io.to(roomId).emit('message:reacted', { messageId, reactions: reactionsObj });
  });

  socket.on('typing:start', async ({ roomId }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) return;
    socket.to(roomId).emit('typing:start', { userId, username: user.username, roomId });
  });

  socket.on('typing:stop', ({ roomId }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (userId) socket.to(roomId).emit('typing:stop', { userId, roomId });
  });

  socket.on('dm:create', async ({ targetUserId }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);
    if (!user || !targetUser) return;

    const dmKey = [userId, targetUserId].sort().join('_');
    let room = await Room.findOne({ directKey: dmKey });
    if (!room) {
      room = await Room.create({
        _id: uuidv4(),
        name: `${user.username} & ${targetUser.username}`,
        type: 'direct',
        members: [userId, targetUserId],
        memberNames: { [userId]: user.username, [targetUserId]: targetUser.username },
        memberColors: { [userId]: user.color, [targetUserId]: targetUser.color },
        directKey: dmKey,
      });
      const targetSocketId = userIdToSocketId.get(targetUserId);
      if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.join(room._id);
      socket.join(room._id);

      const roomObj = room.toObject();
    const roomData = {
      ...roomObj,
      id: room._id,
      memberNames: room.memberNames instanceof Map ? Object.fromEntries(room.memberNames) : (room.memberNames || {}),
      memberColors: room.memberColors instanceof Map ? Object.fromEntries(room.memberColors) : (room.memberColors || {}),
      messages: [],
    };
      socket.emit('dm:created', { room: roomData, messages: [] });
      if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.emit('dm:invited', { room: roomData, messages: [] });
    } else {
      socket.join(room._id);
      const messages = await Message.find({ roomId: room._id }).sort({ createdAt: -1 }).limit(60).lean();
      const roomObj = room.toObject();
      const roomData = {
        ...roomObj,
        id: room._id,
        memberNames: room.memberNames instanceof Map ? Object.fromEntries(room.memberNames) : (room.memberNames || {}),
        memberColors: room.memberColors instanceof Map ? Object.fromEntries(room.memberColors) : (room.memberColors || {}),
      };
      const msgs = messages.reverse().map((m) => ({ ...m, id: m._id?.toString() }));
      socket.emit('dm:created', { room: roomData, messages: msgs });
    }
  });

  socket.on('room:create', async ({ name, memberIds, icon }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user || !name?.trim()) return;

    const validMembers = await User.find({ _id: { $in: memberIds } });
    const allMemberIds = [userId, ...validMembers.map((m) => m._id.toString())];
    const roomId = uuidv4();

    const room = await Room.create({
      _id: roomId,
      name: name.trim(),
      type: 'group',
      icon: icon || '👥',
      members: allMemberIds,
      createdBy: userId,
    });

    for (const mid of allMemberIds) {
      const sockId = userIdToSocketId.get(mid);
      if (sockId) {
        io.sockets.sockets.get(sockId)?.join(roomId);
        io.sockets.sockets.get(sockId)?.emit('room:created', { room: { ...room.toObject(), id: roomId } });
      }
    }
  });

  socket.on('message:delivered', async ({ roomId, messageId }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    const msg = await Message.findById(messageId);
    if (!msg || msg.roomId !== roomId) return;
    if (!msg.deliveredTo.includes(userId)) {
      msg.deliveredTo.push(userId);
      await msg.save();
    }
    const senderSocketId = userIdToSocketId.get(msg.senderId);
    if (senderSocketId) {
      io.sockets.sockets.get(senderSocketId)?.emit('message:delivered', { roomId, messageId, userId });
    }
  });

  socket.on('messages:read', async ({ roomId }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    await Message.updateMany({ roomId }, { $addToSet: { readBy: userId } });
    io.to(roomId).emit('messages:read', { roomId, userId });
  });

  socket.on('call:start', ({ targetUserId, type }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;
    User.findById(userId).then((caller) => {
      const targetSocketId = userIdToSocketId.get(targetUserId);
      if (caller && targetSocketId) {
        io.sockets.sockets.get(targetSocketId)?.emit('call:incoming', {
          fromUserId: userId,
          fromUser: toPublicUser(caller),
          type: type || 'video',
        });
      }
    });
  });

  socket.on('call:offer', ({ targetUserId, offer }) => {
    const targetSocketId = userIdToSocketId.get(targetUserId);
    if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.emit('call:offer', { fromUserId: socketIdToUserId.get(socket.id), offer });
  });

  socket.on('call:answer', ({ targetUserId, answer }) => {
    const targetSocketId = userIdToSocketId.get(targetUserId);
    if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.emit('call:answer', { fromUserId: socketIdToUserId.get(socket.id), answer });
  });

  socket.on('call:ice-candidate', ({ targetUserId, candidate }) => {
    const targetSocketId = userIdToSocketId.get(targetUserId);
    if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.emit('call:ice-candidate', { fromUserId: socketIdToUserId.get(socket.id), candidate });
  });

  socket.on('call:reject', ({ fromUserId }) => {
    const targetSocketId = userIdToSocketId.get(fromUserId);
    if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.emit('call:rejected', { byUserId: socketIdToUserId.get(socket.id) });
  });

  socket.on('call:end', ({ targetUserId }) => {
    const targetSocketId = userIdToSocketId.get(targetUserId);
    if (targetSocketId) io.sockets.sockets.get(targetSocketId)?.emit('call:ended', { byUserId: socketIdToUserId.get(socket.id) });
  });

  socket.on('user:status', ({ status }) => {
    const userId = socketIdToUserId.get(socket.id);
    if (userId) io.emit('user:statusChanged', { userId, status });
  });

  socket.on('disconnect', async () => {
    const userId = socketIdToUserId.get(socket.id);
    if (!userId) return;

    const user = await User.findById(userId);
    if (user) {
      user.lastSeen = new Date();
      await user.save();
    }

    socketIdToUserId.delete(socket.id);
    userIdToSocketId.delete(userId);

    const onlineUsers = await getOnlineUsers();
    io.emit('user:offline', {
      userId,
      username: user?.username,
      lastSeen: user?.lastSeen,
      onlineUsers,
    });
    console.log(`👋 ${user?.username} disconnected`);
  });
});

app.get('/api/health', async (_req, res) => {
  res.json({ status: 'ok', onlineUsers: userIdToSocketId.size });
});

const PORT = process.env.PORT || 3001;

async function start() {
  await connectDB();
  await ensureGeneralRoom();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TatheerApp server running on http://localhost:${PORT}`);
    console.log(`   Access from phone: http://<your-ip>:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
