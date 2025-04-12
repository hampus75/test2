const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const routeSchema = new Schema({
  stravaId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  routeType: {
    type: String,
    enum: ['strava', 'gpx'],
    default: 'gpx'
  },
  gpxId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  distance: Number,
  elevationGain: Number,
  coordinates: [],
  elevationData: [],
  color: String,
  visible: {
    type: Boolean,
    default: true
  },
  polyline: String,
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  checkpoints: [{
    name: String,
    lat: Number,
    lng: Number,
    description: String
  }],
  waypoints: [{
    name: String,
    lat: Number,
    lng: Number,
    position: Number,
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Route', routeSchema);
