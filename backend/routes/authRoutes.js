const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/google', authController.googleLogin);
router.post('/register', authController.registerWithEmail);
router.post('/login', authController.loginWithEmail);
router.post('/refresh', authController.refreshSession);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getCurrentUser);

module.exports = router;
