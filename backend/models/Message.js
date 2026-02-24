const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  senderId: { type: String, default: null },
  senderName: { type: String, default: 'System' },
  senderColor: { type: String, default: '#8696a0' },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'system'], default: 'text' },
  replyTo: { type: String, default: null },
  reactions: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  readBy: [{ type: String }],
  deliveredTo: [{ type: String }],
  edited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
