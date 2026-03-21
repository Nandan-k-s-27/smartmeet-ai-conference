const User = require('../models/User');
const { verifyAccessToken } = require('../utils/tokenUtils');

const getTokenFromRequest = (req) => {
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

const requireAuth = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).lean();

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid authentication token' });
    }

    req.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar || '',
      authProvider: user.authProvider,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = { requireAuth };
