const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true, sparse: true },
  color: { type: String, default: '#00a884' },
  bio: { type: String, default: '', maxlength: 150 },
  avatarUrl: { type: String, default: null },
  lastSeen: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
