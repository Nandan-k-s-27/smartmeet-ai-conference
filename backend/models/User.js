const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  avatar: {
    type: String,
    default: '',
  },
  authProvider: {
    type: String,
    enum: ['google', 'email'],
    required: true,
  },
  passwordHash: {
    type: String,
    select: false,
  },
  googleId: {
    type: String,
    index: true,
    sparse: true,
  },
  refreshTokenHash: {
    type: String,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
