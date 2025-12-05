const mongoose = require("mongoose");

const taskSchema = mongoose.Schema(
  {
    // Assigned the task to the User who created it
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // References the 'User' model
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Please add a task title"],
      trim: true,
    },
    description: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      required: true,
      default: "Pending",
      enum: ["Pending", "In Progress", "Completed", "Canceled"],
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
