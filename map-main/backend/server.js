const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Routes
const authRoutes = require('./routes/auth.routes');
const routeRoutes = require('./routes/route.routes');
const sessionRoutes = require('./routes/session.routes');
const userRoutes = require('./routes/user.routes');

// Socket handlers
const { setupSocketHandlers } = require('./socket/socketHandlers');

// Load environment variables
dotenv.config();

// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
  const defaultOrigins = ['http://localhost:4200', 'http://127.0.0.1:4200'];
  
  // Add the frontend URL from env if provided
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL !== '*') {
    defaultOrigins.push(process.env.FRONTEND_URL);
  }
  
  return defaultOrigins;
}

const allowedOrigins = getAllowedOrigins();
console.log('Allowed CORS origins:', allowedOrigins);

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: function(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all origins in development if FRONTEND_URL is set to '*'
      if (process.env.FRONTEND_URL === '*') return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
        return callback(new Error(msg), false);
      }
      
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

// Configure CORS middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development if FRONTEND_URL is set to '*'
    if (process.env.FRONTEND_URL === '*') return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  credentials: true
}));

// Add a preflight handler specifically for OPTIONS requests
app.options('*', cors({
  origin: true,  // Respond with the request's origin
  credentials: true,
  methods: 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  allowedHeaders: 'Content-Type,Authorization,X-Requested-With,Accept'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add headers to all responses to prevent CORS issues
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Always set these headers to ensure CORS works properly
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization,Origin,Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // For debugging CORS issues
  console.log(`CORS Request: ${req.method} ${req.path} from origin: ${origin || 'unknown'}`);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/users', userRoutes);

// Add a proxy endpoint for Strava callback
app.get('/strava-proxy-callback', (req, res) => {
  const code = req.query.code;
  const error = req.query.error;
  
  console.log('Received Strava callback via proxy:', { code, error });
  
  if (error) {
    return res.redirect(`/#/callback-error?error=${error}`);
  }
  
  if (!code) {
    return res.redirect('/#/callback-error?error=no_code');
  }
  
  // Redirect to the Angular app's callback route with the code
  res.redirect(`/#/callback?code=${code}`);
});

// Add CORS diagnostic endpoint
app.get('/api/debug/cors', (req, res) => {
  res.json({
    message: 'CORS check successful',
    headers: {
      origin: req.headers.origin || 'No origin header',
      referer: req.headers.referer || 'No referer',
      host: req.headers.host || 'No host'
    },
    corsHeaders: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin') || 'Not set',
      'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods') || 'Not set',
      'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers') || 'Not set',
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials') || 'Not set'
    },
    clientIP: req.ip || req.connection.remoteAddress,
    serverTime: new Date().toISOString()
  });
});

// Basic status endpoint that doesn't require MongoDB
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running without MongoDB',
    allowedOrigins: allowedOrigins,
    requestOrigin: req.headers.origin || 'No origin header'
  });
});

// Serve static Angular files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../angularSetup/dist/map-explorer')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../angularSetup/dist/map-explorer/index.html'));
  });
}

// Set up Socket.io handlers
try {
  setupSocketHandlers(io);
} catch (error) {
  console.warn('Could not set up socket handlers:', error.message);
}

// Start server immediately without MongoDB dependency
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT} without MongoDB connection`);
  console.log(`Access the API from another computer using http://YOUR_IP_ADDRESS:${PORT}`);
  console.log(`CORS configured to accept requests from: ${process.env.FRONTEND_URL === '*' ? 'Any origin' : allowedOrigins.join(', ')}`);
});

// Try to connect to MongoDB in the background if needed
if (process.env.MONGODB_URI) {
  console.log('Attempting to connect to MongoDB...');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB successfully');
    })
    .catch(err => {
      console.warn('MongoDB connection not available:', err.message);
      console.log('Server will run with limited functionality (no database-related features)');
    });
} else {
  console.log('No MongoDB URI provided, running without database functionality');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
