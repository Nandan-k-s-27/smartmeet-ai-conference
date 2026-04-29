const jwt = require('jsonwebtoken');

const issuer = 'smartmeet-web';
const audience = 'smartmeet-api';

const getJwtSecret = () => {
  const secret = process.env.BACKEND_JWT_SECRET || process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error('BACKEND_JWT_SECRET or AUTH_SECRET must be configured');
  }

  return secret;
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, getJwtSecret(), {
    issuer,
    audience
  });
};

const authenticateRequest = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Missing bearer token'
    });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user'
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired bearer token'
    });
  }
};

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Missing socket auth token'));
  }

  try {
    const payload = verifyAccessToken(token);
    socket.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user'
    };
    next();
  } catch (error) {
    next(new Error('Invalid or expired socket auth token'));
  }
};

module.exports = {
  authenticateRequest,
  authenticateSocket,
  verifyAccessToken
};
