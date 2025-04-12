const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const riderSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  color: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  position: Number,
  speed: Number,
  elevation: Number,
  distanceCovered: Number,
  checkpointsPassed: [String],
  startTime: Number,
  lastCheckpointTime: Number
});

const waypointSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  position: Number,
  name: String,
  lat: Number,
  lng: Number
});

const waypointPassSchema = new Schema({
  riderId: String,
  riderName: String,
  waypointId: String,
  waypointName: String,
  time: Number,
  formattedTime: String
});

const sessionSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  routeId: {
    type: String,
    required: true
  },
  routeData: {
    name: String,
    coordinates: Array,
    elevation: Array,
    distance: Number
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  riders: [riderSchema],
  waypoints: [waypointSchema],
  waypointPasses: [waypointPassSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Session', sessionSchema);
