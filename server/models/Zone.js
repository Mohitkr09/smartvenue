const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    // 🔤 Gate Name
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // 👥 Crowd Level (0–100)
    crowdLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // ⏱ Wait Time (minutes)
    waitTime: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 📍 LOCATION (VERY IMPORTANT)
    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    // 🤖 AI PREDICTION
    prediction: {
      type: String,
      default: "Analyzing...",
    },

    // 🟢 STATUS (optional future use)
    status: {
      type: String,
      enum: ["Smooth", "Moderate", "High"],
      default: "Smooth",
    },
  },
  {
    timestamps: true,
  }
);

// 🔥 AUTO UPDATE STATUS BASED ON CROWD
zoneSchema.pre("save", function (next) {
  if (this.crowdLevel > 70) this.status = "High";
  else if (this.crowdLevel > 40) this.status = "Moderate";
  else this.status = "Smooth";

  next();
});

module.exports = mongoose.model("Zone", zoneSchema);