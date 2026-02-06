require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const meetingController = require('./controllers/meetingController');
const summaryController = require('./controllers/summaryController');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Environment
const isProduction = process.env.NODE_ENV === 'production';

// Connect to MongoDB
connectDB();

// Production-ready CORS configuration
// Set ALLOWED_ORIGINS in .env or deployment platform as comma-separated URLs
// Example: ALLOWED_ORIGINS=https://your-frontend.com,https://app.yourdomain.com
const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  // Default: allow all in development
  return null;
};

const allowedOrigins = getAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // If ALLOWED_ORIGINS is not set, allow all origins
    if (!allowedOrigins) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // In development, allow all
    if (!isProduction) {
      return callback(null, true);
    }

    // Block origin in production if not in allowed list
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
};

const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API Routes
app.post('/api/meetings/create', meetingController.createMeeting);
app.get('/api/meetings/:meetingId', meetingController.getMeeting);
app.post('/api/meetings/:meetingId/join', meetingController.joinMeeting);
app.post('/api/meetings/:meetingId/leave', meetingController.leaveMeeting);
app.post('/api/meetings/:meetingId/end', meetingController.endMeeting);

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