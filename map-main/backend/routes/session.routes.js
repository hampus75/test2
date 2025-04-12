const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { 
  createSession, 
  getPublicSessions, 
  getSession,
  addRider,
  updateRiderPosition,
  addWaypoint,
  recordWaypointPass
} = require('../controllers/session.controller');

// All routes need authentication
router.use(protect);

// Session routes
router.route('/')
  .post(createSession)
  .get(getPublicSessions);

router.route('/:id')
  .get(getSession);

// Rider routes
router.route('/:id/riders')
  .post(addRider);

router.route('/:id/riders/:riderId')
  .patch(updateRiderPosition);

// Waypoint routes
router.route('/:id/waypoints')
  .post(addWaypoint);

// Waypoint pass routes
router.route('/:id/waypoint-passes')
  .post(recordWaypointPass);

module.exports = router;
