const User = require("../models/User");

// ============================================================
// 📄 GET USER PROFILE
// ============================================================

const getProfile = async (req, res) => {
  try {
    // --------------------------------------------------------
    // Find logged-in user
    // --------------------------------------------------------

    const user = await User.findById(
      req.user.id
    ).select("-password");

    // --------------------------------------------------------
    // User not found
    // --------------------------------------------------------

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // --------------------------------------------------------
    // Response
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    console.error(
      "❌ Profile Error:",
      err.message
    );

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ============================================================
// ✏️ UPDATE USER PROFILE
// ============================================================

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      email,
      avatar,
    } = req.body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const trimmedName = name.trim();

    const normalizedEmail =
      email.trim().toLowerCase();

    // --------------------------------------------------------
    // Name validation
    // --------------------------------------------------------

    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
    }

    if (trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name cannot exceed 50 characters",
      });
    }

    // --------------------------------------------------------
    // Email validation
    // --------------------------------------------------------

    const emailRegex =
      /^\S+@\S+\.\S+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please use a valid email address",
      });
    }

    // ========================================================
    // FIND CURRENT USER
    // ========================================================

    const user =
      await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ========================================================
    // CHECK EMAIL DUPLICATE
    // ========================================================

    if (
      normalizedEmail !== user.email
    ) {
      const existingUser =
        await User.findOne({
          email: normalizedEmail,
          _id: {
            $ne: user._id,
          },
        });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use",
        });
      }
    }

    // ========================================================
    // UPDATE BASIC INFORMATION
    // ========================================================

    user.name = trimmedName;

    user.email =
      normalizedEmail;

    // ========================================================
    // UPDATE AVATAR
    // ========================================================

    if (
      avatar !== undefined &&
      avatar !== null &&
      String(avatar).trim() !== ""
    ) {
      user.avatar =
        String(avatar).trim();
    }

    // ========================================================
    // SAVE USER
    // ========================================================

    await user.save();

    // ========================================================
    // REMOVE PASSWORD FROM RESPONSE
    // ========================================================

    const updatedUser =
      user.toObject();

    delete updatedUser.password;

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      message:
        "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(
      "❌ Update Profile Error:",
      err.message
    );

    // MongoDB duplicate key
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already in use",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  getProfile,
  updateProfile,
};