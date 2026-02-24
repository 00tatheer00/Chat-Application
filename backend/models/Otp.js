const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  username: { type: String, default: null },
  color: { type: String, default: '#00a884' },
}, { timestamps: true });

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL: delete when expiresAt has passed

module.exports = mongoose.model('Otp', otpSchema);
