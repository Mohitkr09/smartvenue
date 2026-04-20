const User = require("../models/User");

// 👤 GET USER PROFILE
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    console.error("Profile Error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { returnDocument: "after" }
    ).select("-password");

    res.status(200).json({
      success: true,
      user: updatedUser,
    });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({
      success: false,
      error: "Server Error",
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
};