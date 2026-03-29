const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { signAccessToken, signRefreshToken, hashToken, verifyHashedToken, setAuthCookies, clearAuthCookies } = require('../utils/tokenUtils');

const parseGoogleClientIds = () => {
  const primary = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const extras = String(process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = [primary, ...extras].filter(Boolean);
  return [...new Set(merged)];
};

const GOOGLE_CLIENT_IDS = parseGoogleClientIds();
const client = new OAuth2Client(GOOGLE_CLIENT_IDS[0] || undefined);

const decodeAudienceFromCredential = (credential) => {
  try {
    const [, payload] = String(credential || '').split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(normalized, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed?.aud || null;
  } catch (error) {
    return null;
  }
};

const getAuthFailureHint = (error, credential) => {
  const message = (error?.message || '').toLowerCase();

  if (message.includes('audience')) {
    const tokenAudience = decodeAudienceFromCredential(credential);
    const configured = GOOGLE_CLIENT_IDS.join(', ') || 'none';
    return `Google client ID mismatch. Token aud: ${tokenAudience || 'unknown'}. Configured backend audiences: ${configured}. Ensure frontend REACT_APP_GOOGLE_CLIENT_ID matches one configured backend ID.`;
  }

  if (message.includes('token used too early') || message.includes('expired')) {
    return 'Google token is expired or invalid. Retry sign-in and ensure device time is correct.';
  }

  return 'Google token verification failed. Check OAuth client setup and allowed origins.';
};

// Google OAuth verification
const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential || GOOGLE_CLIENT_IDS.length === 0) {
      return res.status(400).json({
        error: 'Missing credential or GOOGLE_CLIENT_ID not configured',
        hint: 'Set GOOGLE_CLIENT_ID (or comma-separated GOOGLE_CLIENT_IDS) on backend. It must match frontend REACT_APP_GOOGLE_CLIENT_ID.',
      });
    }

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_IDS,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Find existing user by googleId first, then by email for account linking.
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.findOne({ email });
    }

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
      // Link/refresh OAuth profile on existing account.
      user.googleId = googleId;
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
    res.status(401).json({
      error: 'Google authentication failed',
      hint: getAuthFailureHint(err, req.body?.credential),
    });
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

    const tokenUtils = require('../utils/tokenUtils');
    const decoded = tokenUtils.verifyRefreshToken(refreshToken);
    if (!decoded?.userId) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Refresh token invalid' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokenHash) {
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Verify refresh token hash for this exact user session
    if (!verifyHashedToken(refreshToken, user.refreshTokenHash)) {
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
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      const tokenUtils = require('../utils/tokenUtils');
      const decoded = tokenUtils.verifyRefreshToken(refreshToken);
      if (decoded?.userId) {
        await User.findByIdAndUpdate(decoded.userId, { refreshTokenHash: null }).catch(() => null);
      }
    }

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
