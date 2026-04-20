const mongoose = require("mongoose");

const stallSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    waitTime: {
      type: Number,
      default: 0, 
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Stall", stallSchema);