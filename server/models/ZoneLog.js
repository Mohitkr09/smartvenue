// server/models/ZoneLog.js

const mongoose = require("mongoose");

const zoneLogSchema = new mongoose.Schema({
  gate_id: String,
  crowdLevel: Number,
  waitTime: Number,

  // 🔥 IMPORTANT (REAL AI FEATURES)
  hour: Number,
  day: Number,
  timestamp: Date,
});

module.exports = mongoose.model("ZoneLog", zoneLogSchema);