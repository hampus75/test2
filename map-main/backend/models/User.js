const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  stravaId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: false
  },
  profileImage: {
    type: String
  },
  stravaToken: {
    accessToken: String,
    refreshToken: String,
    expiresAt: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
