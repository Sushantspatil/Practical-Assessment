const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./db"); //our database connection utility
const cors = require("cors");

// initial setup & load environment variables
dotenv.config();

// connect to the database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(express.json());
// middleware
// Configure CORS to accept requests from our client.
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true, // Allow cookies and auth headers
  })
);

// Simple API health check
app.get("/", (req, res) => {
  res.send("Task Manager API is running successfully! 🚀");
});

// import and use our primary route controllers
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");

app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);

// Simple root route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
