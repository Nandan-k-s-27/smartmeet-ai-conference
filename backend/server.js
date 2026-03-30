require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const connectDB = require('./config/db');
const meetingController = require('./controllers/meetingController');
const summaryController = require('./controllers/summaryController');
const socketHandler = require('./socket/socketHandler');
const { requireAuth } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const { initializePassportGoogle } = require('./utils/passportAuth');
const { validateEnv, getSessionSecret } = require('./config/validateEnv');

const app = express();
const server = http.createServer(app);

// Environment
const isProduction = process.env.NODE_ENV === 'production';

validateEnv();

// Initialize Passport.js for Google OAuth
initializePassportGoogle();

// Needed behind reverse proxies (Render/NGINX) for secure cookie behavior.
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Production-ready CORS configuration
// Set ALLOWED_ORIGINS in .env or deployment platform as comma-separated URLs
// Example: ALLOWED_ORIGINS=https://your-frontend.com,https://app.yourdomain.com
const normalizeOrigin = (value) => (value || '').trim().replace(/\/+$/, '');

const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',')
      .map((origin) => normalizeOrigin(origin))
      .filter(Boolean);
  }
  // Default: allow all in development
  return null;
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    const normalizedOrigin = normalizeOrigin(origin);

    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!normalizedOrigin) return callback(null, true);

    // If ALLOWED_ORIGINS is not set, allow all origins
    if (!allowedOrigins) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // In development, allow all
    if (!isProduction) {
      return callback(null, true);
    }

    // Deny origin without throwing an internal server error.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Return a clear error in production when the request origin is not allowlisted.
app.use((req, res, next) => {
  if (!isProduction || !allowedOrigins) {
    return next();
  }

  const requestOrigin = normalizeOrigin(req.headers.origin);
  if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
    return next();
  }

  return res.status(403).json({
    error: 'Origin not allowed. Add this URL to ALLOWED_ORIGINS.',
  });
});

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const getRtcConfiguration = () => {
  const defaultIceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ];

  const rtcConfiguration = {
    iceServers: [...defaultIceServers],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all'
  };

  const turnUrlsRaw =
    process.env.METERED_TURN_URLS ||
    process.env.METERED_TURN_URL ||
    process.env.TURN_URLS ||
    process.env.TURN_URL ||
    '';
  const turnUsername = process.env.METERED_TURN_USERNAME || process.env.TURN_USERNAME || '';
  const turnCredential = process.env.METERED_TURN_CREDENTIAL || process.env.TURN_CREDENTIAL || '';

  const defaultMeteredUrls = [
    'turn:global.relay.metered.ca:80',
    'turn:global.relay.metered.ca:443',
    'turns:global.relay.metered.ca:443?transport=tcp'
  ];

  if (turnUsername && turnCredential) {
    const turnUrls = (turnUrlsRaw || defaultMeteredUrls.join(','))
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);

    if (turnUrls.length > 0) {
      rtcConfiguration.iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential
      });
    }
  }

  return rtcConfiguration;
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware for Passport
const sessionOptions = {
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

const usePassportSession = !isProduction;

if (usePassportSession) {
  app.use(session(sessionOptions));
}

// Initialize Passport
app.use(passport.initialize());
if (usePassportSession) {
  app.use(passport.session());
}

// Handle preflight OPTIONS requests
app.options('*', cors(corsOptions));

// Request logger - only in development
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`➡️ ${req.method} ${req.originalUrl} - from: ${req.ip}`);
    next();
  });
}

// Initialize Socket Handler
socketHandler(io);

// Auth Routes (no requireAuth needed here)
app.use('/api/auth', authRoutes);

// API Routes (Protected with requireAuth)
app.post('/api/meetings/create', requireAuth, meetingController.createMeeting);
app.get('/api/meetings/:meetingId', requireAuth, meetingController.getMeeting);
app.post('/api/meetings/:meetingId/join', requireAuth, meetingController.joinMeeting);
app.post('/api/meetings/:meetingId/leave', requireAuth, meetingController.leaveMeeting);
app.post('/api/meetings/:meetingId/end', requireAuth, meetingController.endMeeting);

// WebRTC ICE/TURN config endpoint
app.get('/api/webrtc/ice-config', (req, res) => {
  try {
    const rtcConfiguration = getRtcConfiguration();
    res.json({
      success: true,
      rtcConfiguration,
      hasTurn: rtcConfiguration.iceServers.some((s) => String(s.urls).includes('turn:'))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to build ICE configuration'
    });
  }
});

// Summary Routes (Gemini AI)
app.post('/api/summary/generate', summaryController.generateSummary);
app.post('/api/summary/chat', summaryController.chatWithAI);
app.post('/api/summary/missed-messages', summaryController.summarizeMissedMessages);
app.post('/api/summary/missed-speech', summaryController.summarizeMissedSpeech);
app.get('/api/summary/status', summaryController.checkStatus);
app.get('/api/summary/meeting-data/:meetingId', summaryController.getMeetingData);

// Health Check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SmartMeet API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const health = {
    status: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
    environment: process.env.NODE_ENV || 'development'
  };

  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;
  res.status(statusCode).json(health);
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  if (isProduction) {
    console.log(`SmartMeet server running on port ${PORT}`);
  } else {
    // Get local IP for display in development
    const getLocalIP = () => {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            return net.address;
          }
        }
      }
      return 'localhost';
    };
    const localIP = getLocalIP();
    console.log(`
  🚀 SmartMeet Server (Development)
  ═══════════════════════════════════════════
     Local:    http://localhost:${PORT}
     Network:  http://${localIP}:${PORT}
  ═══════════════════════════════════════════
    `);
  }
});