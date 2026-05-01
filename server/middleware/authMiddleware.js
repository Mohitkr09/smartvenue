const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 🔒 CHECK HEADER EXISTS
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    // 🔒 CHECK FORMAT: Bearer TOKEN
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    const token = authHeader.split(" ")[1];

    // 🔒 CHECK TOKEN EXISTS
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token missing",
      });
    }

    // 🔐 VERIFY TOKEN
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret123"
    );

    // EXPECTING: { id: userId }
    if (!decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // ✅ ATTACH USER
    req.user = { id: decoded.id };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);

    // 🔥 HANDLE TOKEN EXPIRED
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired, please login again",
      });
    }

    // 🔥 HANDLE INVALID TOKEN
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};