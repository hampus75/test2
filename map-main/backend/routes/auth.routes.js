const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { stravaAuth, getProfile } = require('../controllers/auth.controller');

// Public routes
router.post('/strava', stravaAuth);

// Protected routes
router.get('/profile', protect, getProfile);

module.exports = router;
