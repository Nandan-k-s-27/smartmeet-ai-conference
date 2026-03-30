const User = require('../models/User');
const { createAuthToken, verifyAuthToken, getFrontendUrl } = require('../utils/passportAuth');

const normalizeOrigin = (value) => String(value || '').trim().replace(/\/+$/, '');

const getAllowedOrigins = () => {
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  const defaultFrontend = normalizeOrigin(getFrontendUrl());
  if (defaultFrontend) {
    configured.push(defaultFrontend);
  }

  return Array.from(new Set(configured));
};

const isAllowlistedFrontend = (candidate) => {
  const normalized = normalizeOrigin(candidate);
  if (!normalized) return false;

  const allowed = getAllowedOrigins();
  if (allowed.length === 0) {
    return process.env.NODE_ENV !== 'production';
  }

  return allowed.includes(normalized);
};

const parseFrontendUrlFromState = (stateValue) => {
  try {
    const raw = String(stateValue || '').trim();
    if (!raw) return null;

    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    const candidate = String(parsed?.frontend_url || '').trim();
    if (!candidate) return null;

    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const origin = `${url.protocol}//${url.host}`;
    return isAllowlistedFrontend(origin) ? origin : null;
  } catch (error) {
    return null;
  }
};

const getFrontendRedirectBase = (req) => {
  const stateFrontendUrl = parseFrontendUrlFromState(req?.query?.state);
  return stateFrontendUrl || getFrontendUrl();
};

/**
 * Google OAuth callback handler
 * Called after successful Passport authentication
 */
const googleCallback = async (req, res) => {
  try {
    const frontendBase = getFrontendRedirectBase(req);
    if (!frontendBase) {
      return res.status(500).json({
        error: 'FRONTEND_URL is not configured on backend',
        hint: 'Set FRONTEND_URL (or ALLOWED_ORIGINS) in Render environment variables.',
      });
    }

    if (!req.user) {
      return res.redirect(`${frontendBase}/login?error=auth_failed`);
    }

    if (!req.user._id || !req.user.email) {
      return res.redirect(`${frontendBase}/login?error=auth_profile_incomplete`);
    }

    // Create JWT token for authenticated user
    const token = createAuthToken(req.user);

    // Set auth token in secure HTTP-only cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Redirect to frontend with token in URL (frontend will read and verify)
    const redirectUrl = `${frontendBase}/?auth_token=${token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('[auth] Callback error:', error);
    const fallbackFrontend = getFrontendRedirectBase(req);
    if (!fallbackFrontend) {
      return res.status(500).json({ error: 'OAuth callback failed and frontend redirect URL is unavailable' });
    }
    res.redirect(`${fallbackFrontend}/login?error=callback_failed`);
  }
};

/**
 * Get current authenticated user from JWT token
 */
const getCurrentUser = async (req, res) => {
  try {
    // req.user is set by authMiddleware (JWT verification)
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        googleId: user.googleId,
      }
    });
  } catch (error) {
    console.error('[auth] Get current user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * Refresh session / validate current token
 */
const refreshSession = async (req, res) => {
  try {
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify existing token
    const decoded = verifyAuthToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    // If token is still valid, issue a fresh one to extend session
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newToken = createAuthToken(user);

    // Update cookie with new token
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('auth_token', newToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      }
    });
  } catch (error) {
    console.error('[auth] Refresh session error:', error);
    res.status(500).json({ error: 'Failed to refresh session' });
  }
};

/**
 * Check authentication status
 */
const getAuthStatus = async (req, res) => {
  try {
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.json({ authenticated: false });
    }

    const decoded = verifyAuthToken(token);
    if (!decoded) {
      return res.json({ authenticated: false });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({
      authenticated: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      }
    });
  } catch (error) {
    console.error('[auth] Check status error:', error);
    res.json({ authenticated: false });
  }
};

/**
 * Logout - clear auth token
 */
const logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Clear the auth token cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    // Destroy session if exists
    req.session?.destroy?.((err) => {
      if (err) console.error('[auth] Session destroy error:', err);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[auth] Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
};

module.exports = {
  googleCallback,
  getCurrentUser,
  refreshSession,
  getAuthStatus,
  logout,
};
