const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');
const { getFrontendUrl } = require('../utils/passportAuth');

// Initiate Google OAuth flow
// Frontend redirects here to start login process
router.get(
  '/google',
  (req, res, next) => {
    // Support prompt=select_account for account switching
    const prompt = req.query.prompt === 'select_account' ? 'select_account' : undefined;

    const frontendUrl = String(req.query.frontend_url || '').trim();
    const statePayload = frontendUrl ? { frontend_url: frontendUrl } : null;
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
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/api/auth/failed',
    session: false 
  }),
  authController.googleCallback
);

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
