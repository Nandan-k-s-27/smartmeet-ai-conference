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
          const email = profile.emails?.[0]?.value;
          const name = profile.displayName;
          const googleId = profile.id;
          const picture = profile.photos?.[0]?.value;

          // Find existing user by googleId first
          let user = await User.findOne({ googleId });

          if (!user) {
            // Try to find by email to link existing account
            user = await User.findOne({ email });
          }

          if (!user) {
            // Create new user
            user = new User({
              name,
              email,
              googleId,
              avatar: picture,
            });
            await user.save();
          } else {
            // Link/refresh OAuth profile on existing account
            user.googleId = googleId;
            user.avatar = picture;
            user.name = name;
            if (!user.email && email) {
              user.email = email;
            }
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
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  return frontend;
}

module.exports = {
  initializePassportGoogle,
  createAuthToken,
  verifyAuthToken,
  verifyJWT,
  getFrontendUrl,
  JWT_SECRET,
};
