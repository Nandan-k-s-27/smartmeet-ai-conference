const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const signAccessToken = (userId) => {
  return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const signRefreshToken = (userId) => {
  return jwt.sign({ userId }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (err) {
    return null;
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (err) {
    return null;
  }
};

// Hash token for storage (one-way)
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Verify hashed token
const verifyHashedToken = (plainToken, hashedToken) => {
  const hash = crypto.createHash('sha256').update(plainToken).digest('hex');
  return hash === hashedToken;
};

const getCookieOptions = (maxAge) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // Cross-origin deployments (e.g. Vercel frontend + Render backend)
  // require SameSite=None; Secure for cookies to be sent by the browser.
  const sameSite = isProduction ? 'none' : 'lax';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    path: '/',
    maxAge,
  };
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, getCookieOptions(15 * 60 * 1000));
  res.cookie('refreshToken', refreshToken, getCookieOptions(7 * 24 * 60 * 60 * 1000));
};

const clearAuthCookies = (res) => {
  const clearOptions = getCookieOptions(0);
  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  verifyHashedToken,
  setAuthCookies,
  clearAuthCookies,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
};
