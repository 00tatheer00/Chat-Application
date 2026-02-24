const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['general', 'direct', 'group'], required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '👥' },
  members: [{ type: String }],
  memberNames: { type: Map, of: String, default: {} },
  memberColors: { type: Map, of: String, default: {} },
  createdBy: { type: String, default: null },
  lastActivity: { type: Date, default: Date.now },
  lastMessage: { type: String, default: null },
  directKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

roomSchema.index({ members: 1 });
roomSchema.index({ directKey: 1 });

module.exports = mongoose.model('Room', roomSchema);
