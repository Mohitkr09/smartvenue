const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ============================================================
// USER SCHEMA
// ============================================================

const userSchema = new mongoose.Schema(
  {
    // ==========================================================
    // NAME
    // ==========================================================

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },

    // ==========================================================
    // EMAIL
    // ==========================================================

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please use a valid email address",
      ],
    },

    // ==========================================================
    // PASSWORD
    // ==========================================================

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],

      // Password will not be returned by normal queries.
      select: false,
    },

    // ==========================================================
    // AVATAR
    // ==========================================================

    avatar: {
      type: String,
      default:
        "https://cdn-icons-png.flaticon.com/512/149/149071.png",
      trim: true,
    },

    // ==========================================================
    // ROLE
    // ==========================================================

    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "Role must be either user or admin",
      },
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// HASH PASSWORD BEFORE SAVE
// ============================================================

userSchema.pre("save", async function (next) {
  try {
    // If password hasn't changed, don't hash again.
    if (!this.isModified("password")) {
      return next();
    }

    const salt = await bcrypt.genSalt(10);

    this.password = await bcrypt.hash(
      this.password,
      salt
    );

    next();
  } catch (err) {
    next(err);
  }
});

// ============================================================
// COMPARE PASSWORD
// ============================================================

userSchema.methods.comparePassword = async function (
  enteredPassword
) {
  if (!this.password) {
    return false;
  }

  return bcrypt.compare(
    enteredPassword,
    this.password
  );
};

// ============================================================
// REMOVE PASSWORD FROM JSON RESPONSE
// ============================================================

userSchema.methods.toJSON = function () {
  const user = this.toObject();

  delete user.password;

  return user;
};

// ============================================================
// EXPORT
// ============================================================

module.exports = mongoose.model(
  "User",
  userSchema
);