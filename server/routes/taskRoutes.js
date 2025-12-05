const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const { protect } = require("../middleware/authMiddleware");

// apply the JWT authentication middleware to ALL routes in this file
router.use(protect);

// get all tasks (filters, search, and pagination)
router.get("/", async (req, res) => {
  //grab query params,setting default for pagination
  const { status, keyword, page = 1, limit = 10 } = req.query;

  // must always restrict results to the authenticated user's ID
  const queryFilter = { assignedUser: req.user._id };

  // build filter criteria
  if (status && status !== "All") {
    queryFilter.status = status;
  }

  // handle text search on title or description
  if (keyword) {
    const regex = new RegExp(keyword, "i"); // case-insensitive search
    queryFilter.$or = [
      { title: { $regex: regex } },
      { description: { $regex: regex } },
    ];
  }

  // Setup Pagination parameters
  const pageSize = parseInt(limit);
  const currentPage = parseInt(page);
  const skip = (currentPage - 1) * pageSize;

  try {
    // need the total count for pagination metadata
    const totalTasks = await Task.countDocuments(queryFilter);

    // Fetch the specific page of tasks, sorted by newest first
    const tasks = await Task.find(queryFilter)
      .limit(pageSize)
      .skip(skip)
      .sort({ createdAt: -1 });

    res.json({
      tasks,
      page: currentPage,
      pages: Math.ceil(totalTasks / pageSize), //calculate total number of pages
      total: totalTasks,
      limit: pageSize,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// create task
router.post("/", async (req, res) => {
  const { title, description, status } = req.body;
  if (!title) {
    return res.status(400).json({ message: "Task requires a title" });
  }
  try {
    const task = await Task.create({
      title,
      description,
      status,
      // automatically assign the task to the logged in user
      assignedUser: req.user._id,
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
// get single task
router.get("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    // crucial security check- it ensures task belong to this user
    if (task.assignedUser.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to view this task" });
    }
    res.json(task);
  } catch (error) {
    // catches invalid mongodb format
    res.status(500).json({ message: "Server error or invalid ID format" });
  }
});

// update the task
router.put("/:id", async (req, res) => {
  const { title, description, status } = req.body;
  try {
    let task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    // security check
    if (task.assignedUser.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this task" });
    }
    // Only update fields provided in the body
    task.title = title || task.title;
    task.description = description || task.description;
    task.status = status || task.status;
    const updatedTask = await task.save();
    res.json(updatedTask);
  } catch (error) {
    // catches issues like mongoose validation errors
    res.status(400).json({ message: error.message });
  }
});

// delete task
router.delete("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    // security check- Must own the task to delete it
    if (task.assignedUser.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this task" });
    }
    // using dedicated mongoose method
    await task.deleteOne();
    res.json({ message: "Task removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
