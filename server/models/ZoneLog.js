// server/models/ZoneLog.js

const mongoose = require("mongoose");

const zoneLogSchema = new mongoose.Schema({
  gate_id: {
    type: String,
    required: true,
  },

  crowdLevel: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },

  waitTime: {
    type: Number,
    min: 0,
    default: 0,
  },

  hour: {
    type: Number,
    min: 0,
    max: 23,
  },

  day: {
    type: Number,
    min: 0,
    max: 6,
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ZoneLog", zoneLogSchema);