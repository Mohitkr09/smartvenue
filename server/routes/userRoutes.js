const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const {
  getProfile,
  updateProfile,
} = require("../controllers/userController");

// 🔐 Protected routes
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);

module.exports = router;