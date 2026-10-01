const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    // ==========================================
    // GATE INFORMATION
    // ==========================================

    // Gate Name
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // ==========================================
    // CURRENT CROWD DATA
    // ==========================================

    // Current Crowd Level: 0–100
    crowdLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Estimated waiting time in minutes
    waitTime: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // GATE LOCATION
    // ==========================================

    lat: {
      type: Number,
      required: true,
    },

    lng: {
      type: Number,
      required: true,
    },

    // ==========================================
    // AI PREDICTION
    // ==========================================

    // Human-readable AI prediction
    // Example:
    // "Future crowd: 31% | Recommended gate | Safe to proceed"
    prediction: {
      type: String,
      default: "Analyzing...",
    },

    // AI predicted future crowd: 0–100
    futureCrowd: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // AI decision score: 0–100
    // Lower score = better gate
    aiScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // AI classification
    // This matches your AI service response:
    // LOW / MEDIUM / HIGH
    aiStatus: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "LOW",
    },

    // AI-generated recommendation
    // Example:
    // "Safe to proceed"
    // "Crowd increasing"
    // "Avoid this gate"
    aiSuggestion: {
      type: String,
      default: "",
    },

    // Whether this gate is currently
    // recommended by the AI
    aiIsBest: {
      type: Boolean,
      default: false,
    },

    // ==========================================
    // CROWD STATUS
    // ==========================================

    // Current crowd status
    status: {
      type: String,
      enum: ["Smooth", "Moderate", "High"],
      default: "Smooth",
    },

    // ==========================================
    // RISK INFORMATION
    // ==========================================

    // Risk Score: 0–100
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Risk classification
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },

    // Reason for risk level
    riskReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);


// ==========================================
// AUTOMATIC STATUS CALCULATION
// ==========================================

zoneSchema.pre("save", function (next) {

  // ------------------------------------------
  // Calculate current crowd status
  // ------------------------------------------

  if (this.crowdLevel > 70) {
    this.status = "High";
  } else if (this.crowdLevel > 40) {
    this.status = "Moderate";
  } else {
    this.status = "Smooth";
  }


  // ------------------------------------------
  // Calculate risk level
  // ------------------------------------------

  if (this.riskScore > 70) {
    this.riskLevel = "High";
  } else if (this.riskScore > 40) {
    this.riskLevel = "Medium";
  } else {
    this.riskLevel = "Low";
  }

  next();
});


module.exports = mongoose.model("Zone", zoneSchema);