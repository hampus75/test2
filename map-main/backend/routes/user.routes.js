const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getUserSessions,
  updateUserProfile
} = require('../controllers/user.controller');

// All routes need authentication
router.use(protect);

// User routes
router.get('/sessions', getUserSessions);
router.patch('/profile', updateUserProfile);

module.exports = router;
