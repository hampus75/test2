const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// Map to store active socket connections
const connectedUsers = new Map();
const userSessions = new Map();
const sessionSubscribers = new Map();

// Setup Socket.io handlers
exports.setupSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      // Authentication middleware for sockets
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      // Attach user to socket
      socket.user = {
        id: user._id.toString(),
        name: user.name
      };
      
      next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.id})`);
    
    // Store user connection
    connectedUsers.set(socket.user.id, socket.id);
    
    // Join session room
    socket.on('session:join', async (sessionId) => {
      console.log(`User ${socket.user.name} joined session ${sessionId}`);
      socket.join(`session:${sessionId}`);
      
      // Add to session subscribers
      if (!sessionSubscribers.has(sessionId)) {
        sessionSubscribers.set(sessionId, new Set());
      }
      sessionSubscribers.get(sessionId).add(socket.user.id);
      
      // Track user's sessions
      if (!userSessions.has(socket.user.id)) {
        userSessions.set(socket.user.id, new Set());
      }
      userSessions.get(socket.user.id).add(sessionId);
      
      // Send current session state to the user
      try {
        const session = await Session.findById(sessionId);
        if (session) {
          socket.emit('session:state', { 
            riders: session.riders,
            waypoints: session.waypoints,
            waypointPasses: session.waypointPasses
          });
        }
      } catch (err) {
        console.error('Error fetching session state:', err);
      }
    });
    
    // Leave session room
    socket.on('session:leave', (sessionId) => {
      console.log(`User ${socket.user.name} left session ${sessionId}`);
      socket.leave(`session:${sessionId}`);
      
      // Remove from session subscribers
      if (sessionSubscribers.has(sessionId)) {
        sessionSubscribers.get(sessionId).delete(socket.user.id);
      }
      
      // Remove from user's sessions
      if (userSessions.has(socket.user.id)) {
        userSessions.get(socket.user.id).delete(sessionId);
      }
    });
    
    // Update rider position in real-time
    socket.on('rider:update', async (data) => {
      try {
        const { sessionId, riderId, position, elevation, distanceCovered } = data;
        
        // Validate data
        if (!sessionId || !riderId || position === undefined) {
          return socket.emit('error', { message: 'Invalid rider update data' });
        }
        
        // Find the session
        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }
        
        // Find the rider
        const rider = session.riders.find(r => r.id === riderId);
        if (!rider) {
          return socket.emit('error', { message: 'Rider not found' });
        }
        
        // Verify ownership
        if (rider.userId.toString() !== socket.user.id) {
          return socket.emit('error', { message: 'Not authorized to update this rider' });
        }
        
        // Update rider position
        rider.position = position;
        if (elevation !== undefined) rider.elevation = elevation;
        if (distanceCovered !== undefined) rider.distanceCovered = distanceCovered;
        
        session.markModified('riders');
        session.lastActivity = Date.now();
        await session.save();
        
        // Broadcast rider update to all session subscribers
        socket.to(`session:${sessionId}`).emit('rider:updated', {
          riderId,
          position,
          elevation,
          distanceCovered
        });
      } catch (err) {
        console.error('Error updating rider position:', err);
        socket.emit('error', { message: 'Server error updating rider position' });
      }
    });
    
    // Handle waypoint passes in real-time
    socket.on('waypoint:pass', async (data) => {
      try {
        const { sessionId, riderId, waypointId, time } = data;
        
        // Validate data
        if (!sessionId || !riderId || !waypointId || time === undefined) {
          return socket.emit('error', { message: 'Invalid waypoint pass data' });
        }
        
        // Find the session
        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }
        
        // Find the rider
        const rider = session.riders.find(r => r.id === riderId);
        if (!rider) {
          return socket.emit('error', { message: 'Rider not found' });
        }
        
        // Verify ownership
        if (rider.userId.toString() !== socket.user.id) {
          return socket.emit('error', { message: 'Not authorized to update this rider' });
        }
        
        // Find waypoint
        const waypoint = session.waypoints.find(w => w.id === waypointId);
        if (!waypoint) {
          return socket.emit('error', { message: 'Waypoint not found' });
        }
        
        // Format time
        const minutes = Math.floor(time / 60000);
        const seconds = Math.floor((time % 60000) / 1000);
        const ms = Math.floor((time % 1000) / 10);
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
        
        // Create waypoint pass
        const waypointPass = {
          riderId,
          riderName: rider.name,
          waypointId,
          waypointName: waypoint.name,
          time,
          formattedTime
        };
        
        // Add checkpoint to rider's passed checkpoints
        if (!rider.checkpointsPassed.includes(waypointId)) {
          rider.checkpointsPassed.push(waypointId);
          rider.lastCheckpointTime = Date.now();
        }
        
        // Add to waypoint passes
        session.waypointPasses.push(waypointPass);
        
        session.markModified('riders');
        session.lastActivity = Date.now();
        await session.save();
        
        // Broadcast waypoint pass to all session subscribers
        io.to(`session:${sessionId}`).emit('waypoint:passed', waypointPass);
      } catch (err) {
        console.error('Error recording waypoint pass:', err);
        socket.emit('error', { message: 'Server error recording waypoint pass' });
      }
    });
    
    // Handle waypoint creation
    socket.on('waypoint:create', async (data) => {
      try {
        const { sessionId, waypoint } = data;
        
        // Validate data
        if (!sessionId || !waypoint || !waypoint.name || waypoint.position === undefined || !waypoint.lat || !waypoint.lng) {
          return socket.emit('error', { message: 'Invalid waypoint data' });
        }
        
        // Find the session
        const session = await Session.findById(sessionId);
        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }
        
        // Create waypoint object
        const newWaypoint = {
          id: waypoint.id || Date.now().toString(),
          name: waypoint.name,
          position: waypoint.position,
          lat: waypoint.lat,
          lng: waypoint.lng
        };
        
        // Add to waypoints
        session.waypoints.push(newWaypoint);
        
        session.markModified('waypoints');
        session.lastActivity = Date.now();
        await session.save();
        
        // Broadcast new waypoint to all session subscribers
        io.to(`session:${sessionId}`).emit('waypoint:created', newWaypoint);
      } catch (err) {
        console.error('Error creating waypoint:', err);
        socket.emit('error', { message: 'Server error creating waypoint' });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.name} (${socket.user.id})`);
      
      // Remove from connected users
      connectedUsers.delete(socket.user.id);
      
      // Remove from all sessions
      if (userSessions.has(socket.user.id)) {
        const sessions = userSessions.get(socket.user.id);
        sessions.forEach(sessionId => {
          if (sessionSubscribers.has(sessionId)) {
            sessionSubscribers.get(sessionId).delete(socket.user.id);
          }
        });
        userSessions.delete(socket.user.id);
      }
    });
  });
};

// Helper to emit updates to all session subscribers
exports.emitSessionUpdate = (sessionId, event, data) => {
  const io = require('socket.io').instance;
  if (io) {
    io.to(`session:${sessionId}`).emit(event, data);
  }
};
