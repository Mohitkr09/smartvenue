const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const {
  getProfile,
  updateProfile,
} = require("../controllers/userController");

// ================= ROUTES =================

// 🔐 Get user profile
router.get("/profile", auth, getProfile);

// 🔐 Update profile
router.put("/profile", auth, updateProfile);

module.exports = router;