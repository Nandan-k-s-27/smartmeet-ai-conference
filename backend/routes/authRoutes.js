const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// POST /api/auth/google - Google OAuth login
router.post('/google', authController.googleLogin);

// GET /api/auth/me - Get current authenticated user
router.get('/me', requireAuth, authController.getCurrentUser);

// POST /api/auth/refresh - Refresh session with new token
router.post('/refresh', authController.refreshSession);

// POST /api/auth/logout - Logout
router.post('/logout', requireAuth, authController.logout);

module.exports = router;
