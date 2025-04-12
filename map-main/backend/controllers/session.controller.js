const Session = require('../models/Session');
const { emitSessionUpdate } = require('../socket/socketHandlers');

// Create a new session
exports.createSession = async (req, res) => {
  try {
    const { name, description, routeId, routeData, isPublic } = req.body;
    
    if (!name || !routeId || !routeData) {
      return res.status(400).json({
        success: false,
        error: 'Please provide session name, routeId, and routeData'
      });
    }

    const session = new Session({
      name,
      description,
      creator: req.user._id,
      routeId,
      routeData,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await session.save();

    res.status(201).json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating session'
    });
  }
};

// Get all public sessions
exports.getPublicSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ isPublic: true, isActive: true })
      .populate('creator', 'name profileImage')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving sessions'
    });
  }
};

// Get a specific session
exports.getSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('creator', 'name profileImage');

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Check if session is private and user is not the creator
    if (!session.isPublic && session.creator._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this session'
      });
    }

    res.status(200).json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving session'
    });
  }
};

// Add rider to session
exports.addRider = async (req, res) => {
  try {
    const { id, name, color, speed } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide rider name'
      });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const rider = {
      id: id || Date.now().toString(),
      name,
      color,
      userId: req.user._id,
      position: 0,
      speed: speed || 20,
      elevation: 0,
      distanceCovered: 0,
      checkpointsPassed: [],
      startTime: Date.now()
    };

    session.riders.push(rider);
    session.lastActivity = Date.now();
    await session.save();

    // Notify connected clients about the new rider
    emitSessionUpdate(req.params.id, 'rider:added', rider);

    res.status(200).json({
      success: true,
      rider
    });
  } catch (error) {
    console.error('Add rider error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error adding rider'
    });
  }
};

// Update rider position
exports.updateRiderPosition = async (req, res) => {
  try {
    const { riderId } = req.params;
    const { position, elevation, distanceCovered, checkpointsPassed } = req.body;

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const rider = session.riders.find(r => r.id === riderId);

    if (!rider) {
      return res.status(404).json({
        success: false,
        error: 'Rider not found'
      });
    }

    // Check if user has permission to update this rider
    if (rider.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this rider'
      });
    }

    // Update rider properties
    if (position !== undefined) rider.position = position;
    if (elevation !== undefined) rider.elevation = elevation;
    if (distanceCovered !== undefined) rider.distanceCovered = distanceCovered;
    if (checkpointsPassed !== undefined) rider.checkpointsPassed = checkpointsPassed;

    session.markModified('riders');
    session.lastActivity = Date.now();
    await session.save();

    // Notify connected clients about the rider update
    emitSessionUpdate(req.params.id, 'rider:updated', rider);

    res.status(200).json({
      success: true,
      rider
    });
  } catch (error) {
    console.error('Update rider position error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating rider position'
    });
  }
};

// Add waypoint to session
exports.addWaypoint = async (req, res) => {
  try {
    const { id, name, position, lat, lng } = req.body;
    
    if (!name || position === undefined || !lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all waypoint details'
      });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const waypoint = {
      id: id || Date.now().toString(),
      name,
      position,
      lat,
      lng
    };

    session.waypoints.push(waypoint);
    session.lastActivity = Date.now();
    await session.save();

    // Notify connected clients about the new waypoint
    emitSessionUpdate(req.params.id, 'waypoint:added', waypoint);

    res.status(200).json({
      success: true,
      waypoint
    });
  } catch (error) {
    console.error('Add waypoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error adding waypoint'
    });
  }
};

// Record a waypoint pass
exports.recordWaypointPass = async (req, res) => {
  try {
    const { riderId, riderName, waypointId, waypointName, time } = req.body;
    
    if (!riderId || !waypointId || !time) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all waypoint pass details'
      });
    }

    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Format time as MM:SS.ms
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const ms = Math.floor((time % 1000) / 10);
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    const waypointPass = {
      riderId,
      riderName,
      waypointId,
      waypointName,
      time,
      formattedTime
    };

    session.waypointPasses.push(waypointPass);
    session.lastActivity = Date.now();
    await session.save();

    // Notify connected clients about the waypoint pass
    emitSessionUpdate(req.params.id, 'waypoint:passed', waypointPass);

    res.status(200).json({
      success: true,
      waypointPass
    });
  } catch (error) {
    console.error('Record waypoint pass error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error recording waypoint pass'
    });
  }
};
