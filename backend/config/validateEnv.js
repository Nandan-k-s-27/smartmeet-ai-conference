const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

const normalize = (value) => String(value || '').trim();

const validateEnv = () => {
  const requiredInAll = ['MONGODB_URI'];
  const requiredInProduction = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

  const missing = requiredInAll.filter((key) => !normalize(process.env[key]));
  if (isProduction) {
    missing.push(...requiredInProduction.filter((key) => !normalize(process.env[key])));
  }

  const hasJwtSecret = normalize(process.env.JWT_SECRET) || normalize(process.env.JWT_ACCESS_SECRET);
  if (isProduction && !hasJwtSecret) {
    missing.push('JWT_SECRET (or JWT_ACCESS_SECRET)');
  }

  if (isProduction && !normalize(process.env.SESSION_SECRET)) {
    missing.push('SESSION_SECRET');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

const getSessionSecret = () => {
  const configured = normalize(process.env.SESSION_SECRET);
  if (configured) {
    return configured;
  }

  if (isProduction) {
    throw new Error('SESSION_SECRET is required in production');
  }

  // Development-only fallback: non-predictable and regenerated on restart.
  return `dev-session-${crypto.randomBytes(24).toString('hex')}`;
};

module.exports = {
  validateEnv,
  getSessionSecret,
};