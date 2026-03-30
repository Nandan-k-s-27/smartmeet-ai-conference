const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '7d';

/**
 * Create a JWT token for authenticated users.
 * Stores user ID and basic profile info.
 */
function createAuthToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      googleId: user.googleId,
      email: user.email,
      name: user.name,
      picture: user.avatar,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify a JWT token from request cookies or Authorization header.
 * Returns decoded user object on success, null on failure.
 */
function verifyAuthToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Configure Passport Google OAuth Strategy
 */
function initializePassportGoogle() {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = String(profile?.id || '').trim();
          const email = String(profile?.emails?.[0]?.value || profile?._json?.email || '').trim().toLowerCase();
          const name = String(
            profile?.displayName ||
            profile?._json?.name ||
            (email ? email.split('@')[0] : 'User')
          ).trim();
          const picture = profile.photos?.[0]?.value;

          if (!googleId) {
            return done(null, false, { message: 'Missing Google account ID' });
          }

          if (!email) {
            return done(null, false, { message: 'Google account email is unavailable' });
          }

          // Find existing user by googleId first
          let user = await User.findOne({ googleId });

          if (!user) {
            // Try to find by email to link existing account
            user = await User.findOne({ email });
          }

          if (!user) {
            // Create new user
            try {
              user = new User({
                name,
                email,
                googleId,
                avatar: picture,
              });
              await user.save();
            } catch (saveError) {
              // Handle race conditions where same email/googleId was inserted concurrently.
              if (saveError?.code === 11000) {
                user = await User.findOne({ $or: [{ googleId }, { email }] });
                if (!user) {
                  throw saveError;
                }
              } else {
                throw saveError;
              }
            }
          } else {
            // Link/refresh OAuth profile on existing account
            user.googleId = googleId;
            user.avatar = picture;
            user.name = name || user.name;
            user.email = user.email || email;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize user for session
  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
}

/**
 * Middleware to verify JWT token
 * Attaches user to req.user if token is valid
 */
function verifyJWT(req, res, next) {
  const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const decoded = verifyAuthToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

/**
 * Get frontend redirect URL for OAuth callback
 */
function getFrontendUrl() {
  const normalize = (value) => String(value || '').trim().replace(/\/+$/, '');

  const fromFrontendUrl = normalize(process.env.FRONTEND_URL);
  if (fromFrontendUrl) {
    return fromFrontendUrl;
  }

  const fromAllowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => normalize(value))
    .filter(Boolean)[0];

  if (fromAllowedOrigins) {
    return fromAllowedOrigins;
  }

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return 'http://localhost:3000';
}

module.exports = {
  initializePassportGoogle,
  createAuthToken,
  verifyAuthToken,
  verifyJWT,
  getFrontendUrl,
  JWT_SECRET,
};
