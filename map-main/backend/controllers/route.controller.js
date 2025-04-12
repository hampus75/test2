const Route = require('../models/Route');
const axios = require('axios');

// Cache a Strava route in our database
exports.cacheStravaRoute = async (req, res) => {
  try {
    const { stravaId, name, description, distance, elevationGain, polyline, waypoints } = req.body;
    
    if (!stravaId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Please provide stravaId and name'
      });
    }

    // Check if route already exists
    let route = await Route.findOne({ stravaId });
    
    if (route) {
      // Update existing route
      route.name = name;
      route.description = description;
      route.distance = distance;
      route.elevationGain = elevationGain;
      route.polyline = polyline;
      if (waypoints) route.waypoints = waypoints;
      route.updatedAt = Date.now();
      route.routeType = 'strava';
    } else {
      // Create new route
      route = new Route({
        stravaId,
        name,
        description,
        distance,
        elevationGain,
        polyline,
        waypoints: waypoints || [],
        creator: req.user._id,
        routeType: 'strava'
      });
    }

    await route.save();

    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Cache route error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error caching route'
    });
  }
};

// Upload a GPX route
exports.uploadGpxRoute = async (req, res) => {
  try {
    const { 
      gpxId, 
      name, 
      coordinates, 
      elevationData, 
      color, 
      visible, 
      checkpoints
    } = req.body;
    
    if (!gpxId || !name || !coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Please provide gpxId, name, and coordinates'
      });
    }

    // Check if route already exists
    let route = await Route.findOne({ gpxId });
    
    if (route) {
      // Update existing route
      route.name = name;
      route.coordinates = coordinates;
      route.elevationData = elevationData || [];
      route.color = color;
      route.visible = visible !== false; // Default to true
      route.checkpoints = checkpoints || [];
      route.updatedAt = Date.now();
    } else {
      // Create new route
      route = new Route({
        gpxId,
        name,
        coordinates,
        elevationData: elevationData || [],
        color,
        visible: visible !== false, // Default to true
        checkpoints: checkpoints || [],
        creator: req.user ? req.user._id : null,
        routeType: 'gpx'
      });
    }

    await route.save();

    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Upload GPX route error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error uploading GPX route'
    });
  }
};

// Get all cached routes
exports.getCachedRoutes = async (req, res) => {
  try {
    const routes = await Route.find({ routeType: 'strava' })
      .sort({ updatedAt: -1 })
      .select('stravaId name description distance elevationGain updatedAt');

    res.status(200).json({
      success: true,
      count: routes.length,
      routes
    });
  } catch (error) {
    console.error('Get cached routes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving cached routes'
    });
  }
};

// Get all GPX routes
exports.getGpxRoutes = async (req, res) => {
  try {
    const routes = await Route.find({ routeType: 'gpx' })
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: routes.length,
      routes
    });
  } catch (error) {
    console.error('Get GPX routes error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving GPX routes'
    });
  }
};

// Get a specific cached route
exports.getCachedRouteById = async (req, res) => {
  try {
    const route = await Route.findOne({ stravaId: req.params.id });

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Get cached route error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving cached route'
    });
  }
};

// Get a specific GPX route
exports.getGpxRouteById = async (req, res) => {
  try {
    const route = await Route.findOne({ gpxId: req.params.id });

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'GPX route not found'
      });
    }

    res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Get GPX route error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving GPX route'
    });
  }
};

// Delete a GPX route
exports.deleteGpxRoute = async (req, res) => {
  try {
    const route = await Route.findOne({ gpxId: req.params.id });

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'GPX route not found'
      });
    }

    // Check if this is user's route or user is admin
    // This is optional - depends on your authentication requirements
    if (req.user && route.creator && route.creator.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to delete this route'
      });
    }

    await route.remove();

    res.status(200).json({
      success: true,
      message: 'GPX route deleted successfully'
    });
  } catch (error) {
    console.error('Delete GPX route error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting GPX route'
    });
  }
};
