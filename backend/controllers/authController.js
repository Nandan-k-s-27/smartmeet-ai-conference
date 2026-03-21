const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
} = require('../utils/tokenUtils');

const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(googleClientId || undefined);

const sanitizeUser = (user) => ({
  _id: String(user._id),
  name: user.name,
  email: user.email,
  avatar: user.avatar || '',
  authProvider: user.authProvider,
  createdAt: user.createdAt,
});

const issueTokens = async (user, res) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);

  await User.findByIdAndUpdate(user._id, { refreshTokenHash });
  setAuthCookies(res, accessToken, refreshToken);
};

exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required' });
    }

    if (!googleClientId) {
      return res.status(500).json({ success: false, message: 'Google OAuth is not configured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ success: false, message: 'Invalid Google token payload' });
    }

    const email = String(payload.email).toLowerCase();
    const avatar = payload.picture || '';
    const name = payload.name || email.split('@')[0];

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar,
        authProvider: 'google',
        googleId: payload.sub,
      });
    } else {
      user.name = name;
      user.avatar = avatar;
      user.authProvider = user.authProvider || 'google';
      user.googleId = payload.sub;
      await user.save();
    }

    await issueTokens(user, res);

    return res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Google login failed' });
  }
};

exports.registerWithEmail = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      authProvider: 'email',
      passwordHash,
      avatar: '',
    });

    await issueTokens(user, res);

    return res.status(201).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Email registration failed' });
  }
};

exports.loginWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    await issueTokens(user, res);

    return res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Email login failed' });
  }
};

exports.refreshSession = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token is missing' });
    }

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.sub).select('+refreshTokenHash');

    if (!user || !user.refreshTokenHash) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Invalid refresh session' });
    }

    const incomingHash = hashToken(token);
    if (incomingHash !== user.refreshTokenHash) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Invalid refresh session' });
    }

    await issueTokens(user, res);

    return res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, message: 'Refresh token expired or invalid' });
  }
};

exports.getCurrentUser = async (req, res) => {
  return res.json({ success: true, user: req.user });
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      try {
        const payload = verifyRefreshToken(refreshToken);
        await User.findByIdAndUpdate(payload.sub, { $unset: { refreshTokenHash: 1 } });
      } catch (error) {
        // Ignore token parse errors on logout.
      }
    }

    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out successfully' });
  }
};
