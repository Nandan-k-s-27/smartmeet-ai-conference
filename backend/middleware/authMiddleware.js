const { verifyAuthToken } = require('../utils/passportAuth');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    // Get auth token from cookie or Authorization header
    let token = req.cookies?.auth_token;
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token' });
    }

    const decoded = verifyAuthToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }

    // Attach decoded user info to request
    // decoded contains: { id, googleId, email, name, picture }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[authMiddleware] Auth error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { requireAuth };
