const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { signAccessToken, signRefreshToken, hashToken, verifyHashedToken, setAuthCookies, clearAuthCookies } = require('../utils/tokenUtils');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Google OAuth verification
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || !GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: 'Missing credential or GOOGLE_CLIENT_ID not configured' });
    }

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ googleId });

    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        googleId,
        avatar: picture,
      });
      await user.save();
    } else {
      // Update avatar and name if changed
      user.avatar = picture;
      user.name = name;
      await user.save();
    }

    // Issue tokens
    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    const refreshTokenHash = hashToken(refreshToken);

    // Store refresh token hash in DB
    user.refreshTokenHash = refreshTokenHash;
    await user.save();

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar } });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(401).json({ error: 'Google authentication failed' });
  }
};

// Get current authenticated user
const getCurrentUser = (req, res) => {
  try {
    res.json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
      },
    });
  } catch (err) {
    console.error('Get current user error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
};

// Refresh session
const refreshSession = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' });
    }

    const user = await User.findOne({ refreshTokenHash: { $exists: true } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Verify the refresh token is still stored and valid
    const tokenUtils = require('../utils/tokenUtils');
    const decoded = tokenUtils.verifyRefreshToken(refreshToken);
    if (!decoded || !verifyHashedToken(refreshToken, user.refreshTokenHash)) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token invalid' });
    }

    // Issue new access token
    const newAccessToken = signAccessToken(user._id.toString());

    // Optionally rotate refresh token (optional, for enhanced security)
    const newRefreshToken = signRefreshToken(user._id.toString());
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('Refresh session error:', err);
    clearAuthCookies(res);
    res.status(401).json({ error: 'Session refresh failed' });
  }
};

// Logout
const logout = (req, res) => {
  try {
    // Optionally, invalidate refresh token in DB
    // User.updateOne({ _id: req.user._id }, { refreshTokenHash: null });

    clearAuthCookies(res);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
};

module.exports = {
  googleLogin,
  getCurrentUser,
  refreshSession,
  logout,
};
