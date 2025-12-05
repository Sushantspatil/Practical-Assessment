const mongoose = require("mongoose");

// blueprints for storing core user credentials and roles
const userSchema = mongoose.Schema(
  {
    // Email should be unique, stored in lowercase
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
    },
    // storing hashed password for security purpose
    password: {
      type: String,
      required: [true, "Please add a password"],
    },
    // user's role/level
    role: {
      type: String,
      required: true,
      default: "standard_user",
      enum: ["admin", "standard_user"],
    },
  },
  {
    // Automatically manages 'createdAt' and 'updatedAt' fields.
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
