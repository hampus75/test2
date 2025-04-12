const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Authenticate user from Strava
exports.stravaAuth = async (req, res) => {
  try {
    const { stravaId, name, profileImage, email, accessToken, refreshToken, expiresAt } = req.body;

    if (!stravaId || !name || !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Find existing user or create new one
    let user = await User.findOne({ stravaId });

    if (user) {
      // Update existing user
      user.name = name;
      user.profileImage = profileImage;
      user.email = email;
      user.stravaToken = {
        accessToken,
        refreshToken,
        expiresAt
      };
      user.lastLogin = Date.now();
    } else {
      // Create new user
      user = new User({
        stravaId,
        name,
        email,
        profileImage,
        stravaToken: {
          accessToken,
          refreshToken,
          expiresAt
        }
      });
    }

    await user.save();

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during authentication'
    });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-stravaToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving user profile'
    });
  }
};
