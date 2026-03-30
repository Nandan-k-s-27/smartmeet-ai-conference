const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { getFrontendUrl } = require('../utils/passportAuth');

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

const resolveFrontendBase = (req) => {
  try {
    const stateRaw = String(req.query?.state || '').trim();
    if (!stateRaw) return getFrontendUrl();

    const decoded = Buffer.from(stateRaw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    const candidate = String(parsed?.frontend_url || '').trim();
    if (!candidate) return getFrontendUrl();

    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return getFrontendUrl();
    const origin = `${url.protocol}//${url.host}`;
    return isAllowlistedFrontend(origin) ? origin : getFrontendUrl();
  } catch (error) {
    return getFrontendUrl();
  }
};

// Initiate Google OAuth flow
// Frontend redirects here to start login process
router.get(
  '/google',
  (req, res, next) => {
    const missingConfig = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
      .filter((key) => !String(process.env[key] || '').trim());

    if (missingConfig.length > 0) {
      console.error('[auth] Google OAuth configuration missing:', missingConfig.join(', '));
      return res.status(500).json({
        error: 'Google OAuth is not configured on backend',
        missing: missingConfig,
        hint: 'Set required Google OAuth environment variables on backend and redeploy.',
      });
    }

    // Support prompt=select_account for account switching
    const prompt = req.query.prompt === 'select_account' ? 'select_account' : undefined;

    const frontendUrl = String(req.query.frontend_url || '').trim();
    let statePayload = null;

    if (frontendUrl) {
      try {
        const url = new URL(frontendUrl);
        const origin = `${url.protocol}//${url.host}`;
        if (isAllowlistedFrontend(origin)) {
          statePayload = { frontend_url: origin };
        } else {
          console.warn('[auth] Rejected frontend_url (not allowlisted):', origin);
        }
      } catch (error) {
        statePayload = null;
        console.warn('[auth] Invalid frontend_url query param:', frontendUrl);
      }
    }

    const state = statePayload
      ? Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url')
      : undefined;

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt,
      state,
      session: false,
    })(req, res, next);
  }
);

// Google OAuth callback (handled by passport automatically)
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    const frontendBase = resolveFrontendBase(req);

    if (!frontendBase) {
      return res.status(500).json({
        error: 'FRONTEND_URL is not configured on backend',
        hint: 'Set FRONTEND_URL (or ALLOWED_ORIGINS) in Render environment variables.',
      });
    }

    if (err) {
      console.error('[auth] Google callback passport error:', err?.message || err);
      const reason = encodeURIComponent(err?.message || 'oauth_callback_error');
      return res.redirect(`${frontendBase}/login?error=oauth_callback_error&reason=${reason}`);
    }

    if (!user) {
      const reason = encodeURIComponent(info?.message || 'auth_failed');
      return res.redirect(`${frontendBase}/login?error=auth_failed&reason=${reason}`);
    }

    req.user = user;
    return authController.googleCallback(req, res, next);
  })(req, res, next);
});

// Backward compatibility: if an old frontend still POSTs credentials here,
// return a clear message instead of generic 404.
router.post('/google', (req, res) => {
  res.status(405).json({
    error: 'Google OAuth now uses redirect flow.',
    hint: 'Use GET /api/auth/google to initiate login.',
  });
});

// Failed auth redirect
router.get('/failed', (req, res) => {
  const frontendBase = getFrontendUrl();
  if (!frontendBase) {
    return res.status(500).json({
      error: 'FRONTEND_URL is not configured on backend',
      hint: 'Set FRONTEND_URL (or ALLOWED_ORIGINS) in Render environment variables.',
    });
  }

  return res.redirect(`${frontendBase}/login?error=auth_failed`);
});

// GET /api/auth/me - Get current authenticated user
router.get('/me', requireAuth, authController.getCurrentUser);

// POST /api/auth/refresh - Refresh session with new token (for JWT expiry)
router.post('/refresh', authController.refreshSession);

// GET /api/auth/status - Check authentication status
router.get('/status', authController.getAuthStatus);

// POST /api/auth/logout - Logout
router.post('/logout', authController.logout);

module.exports = router;
