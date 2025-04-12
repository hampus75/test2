const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  cacheStravaRoute,
  getCachedRoutes,
  getCachedRouteById,
  uploadGpxRoute,
  getGpxRoutes,
  getGpxRouteById,
  deleteGpxRoute
} = require('../controllers/route.controller');

// Routes that need authentication
router.use('/strava', protect);
router.post('/strava/cache', cacheStravaRoute);
router.get('/strava/cached', getCachedRoutes);
router.get('/strava/cached/:id', getCachedRouteById);

// GPX routes - no authentication required for public routes sharing
router.post('/gpx/upload', uploadGpxRoute);
router.get('/gpx', getGpxRoutes);
router.get('/gpx/:id', getGpxRouteById);
router.delete('/gpx/:id', protect, deleteGpxRoute); // Only delete requires auth

module.exports = router;
