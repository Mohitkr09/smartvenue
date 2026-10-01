const User = require("../models/User");
const jwt = require("jsonwebtoken");

// ============================================================
// 🔐 REGISTER USER
// ============================================================

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
    } = req.body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Name, email and password are required",
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        msg: "Name must be at least 2 characters",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        msg: "Password must be at least 6 characters",
      });
    }

    // ========================================================
    // NORMALIZE EMAIL
    // ========================================================

    const normalizedEmail =
      email.trim().toLowerCase();

    // ========================================================
    // CHECK EXISTING USER
    // ========================================================

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        msg: "User already exists",
      });
    }

    // ========================================================
    // CREATE USER
    // ========================================================

    /*
      IMPORTANT:

      Do NOT hash the password here.

      User.js already contains:

      userSchema.pre("save", ...)

      which automatically hashes the password.
    */

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,
      message: "User registered successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error(
      "❌ Register error:",
      err
    );

    // Duplicate email protection
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        msg: "Email already registered",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
};

// ============================================================
// 🔑 LOGIN USER
// ============================================================

exports.login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        msg: "Email and password are required",
      });
    }

    // ========================================================
    // NORMALIZE EMAIL
    // ========================================================

    const normalizedEmail =
      email.trim().toLowerCase();

    // ========================================================
    // FIND USER
    // ========================================================

    /*
      password has select:false in User.js.

      Therefore we explicitly request it using:

      .select("+password")
    */

    const user =
      await User.findOne({
        email: normalizedEmail,
      }).select("+password");

    if (!user) {
      return res.status(400).json({
        success: false,
        msg: "Invalid email or password",
      });
    }

    // ========================================================
    // COMPARE PASSWORD
    // ========================================================

    const isMatch =
      await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        msg: "Invalid email or password",
      });
    }

    // ========================================================
    // JWT SECRET
    // ========================================================

    if (!process.env.JWT_SECRET) {
      console.error(
        "❌ JWT_SECRET is missing"
      );

      return res.status(500).json({
        success: false,
        error: "Server authentication configuration error",
      });
    }

    // ========================================================
    // CREATE JWT
    // ========================================================

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error(
      "❌ Login error:",
      err
    );

    return res.status(500).json({
      success: false,
      error: "Server error",
      message: err.message,
    });
  }
};