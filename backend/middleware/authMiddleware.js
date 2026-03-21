const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    // Get access token from cookie or Authorization header
    let token = req.cookies.accessToken;
    
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: No token' });
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Fetch user from DB to populate user object
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = { requireAuth };
