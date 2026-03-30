const express = require('express');
const passport = require('passport');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Initiate Google OAuth flow
// Frontend redirects here to start login process
router.get(
  '/google',
  (req, res, next) => {
    // Support prompt=select_account for account switching
    const prompt = req.query.prompt === 'select_account' ? 'select_account' : undefined;
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt,
      session: false,
    })(req, res, next);
  }
);

// Google OAuth callback (handled by passport automatically)
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/auth/failed',
    session: false 
  }),
  authController.googleCallback
);

// Failed auth redirect
router.get('/failed', (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=auth_failed`);
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
