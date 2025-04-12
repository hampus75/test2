const User = require('../models/User');
const Session = require('../models/Session');
const mongoose = require('mongoose');

// Get all sessions for the current user
exports.getUserSessions = async (req, res) => {
  try {
    // Find sessions created by the user
    const createdSessions = await Session.find({ creator: req.user._id })
      .select('name description routeId isPublic createdAt lastActivity')
      .sort({ lastActivity: -1 });
      
    // Find sessions where the user has riders
    const participatedSessions = await Session.find({
      'riders.userId': req.user._id,
      creator: { $ne: req.user._id }  // Exclude sessions created by the user
    })
      .select('name description routeId isPublic creator createdAt lastActivity')
      .populate('creator', 'name profileImage')
      .sort({ lastActivity: -1 });

    res.status(200).json({
      success: true,
      createdSessions,
      participatedSessions
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving user sessions'
    });
  }
};

// Update user profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (name) user.name = name;
    if (email) user.email = email;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating user profile'
    });
  }
};
