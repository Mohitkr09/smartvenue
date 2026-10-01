const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
  getProfile,
  updateProfile,
} = require("../controllers/userController");

// ================= PROTECTED ROUTES =================

// 🔐 Get logged-in user's profile
router.get("/profile", auth, getProfile);

// 🔐 Update logged-in user's profile
router.put("/profile", auth, updateProfile);

module.exports = router;