const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    googleId: { type: String, unique: true, sparse: true },
    avatar: String,
    // Refresh token hash (only stored hashed, never plain)
    refreshTokenHash: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
