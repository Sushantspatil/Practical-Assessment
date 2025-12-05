import React, { useState, useEffect, useReducer } from "react";

// --- INITIAL STATE & REDUCER FOR GLOBAL STATE MANAGEMENT ---

const initialState = {
  user: JSON.parse(localStorage.getItem("user")) || null,
  tasks: [],
  loading: false,
  error: null,
  view: JSON.parse(localStorage.getItem("user")) ? "dashboard" : "login",
  // NEW STATE for Pagination and Filtering
  filterStatus: "All", // Default filter status
  searchKeyword: "",
  currentPage: 1,
  totalPages: 1,
  totalTasks: 0,
  tasksPerPage: 10,
};

const appReducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_SUCCESS":
      localStorage.setItem("user", JSON.stringify(action.payload));
      return { ...state, user: action.payload, error: null, view: "dashboard" };
    case "LOGOUT":
      localStorage.removeItem("user");
      return { ...initialState, user: null, view: "login" }; // Reset to initial state on logout

    // UPDATED SET_TASKS to handle pagination metadata - FIX: Wrapped content in {}
    case "SET_TASKS": {
      const { tasks, page, pages, total, limit } = action.payload;
      return {
        ...state,
        tasks: tasks || [],
        loading: false,
        currentPage: page,
        totalPages: pages,
        totalTasks: total,
        tasksPerPage: limit,
      };
    } // <-- Closing brace fixes the scope issue

    case "ADD_TASK":
      return { ...state, view: "dashboard" }; // Forces useEffect to refetch tasks
    case "UPDATE_TASK":
      return { ...state, view: "dashboard" }; // Forces useEffect to refetch tasks

    case "DELETE_TASK":
      return { ...state, view: "dashboard" }; // Forces useEffect to refetch tasks

    // NEW ACTIONS for Filtering and Pagination
    case "SET_FILTER_STATUS":
      return { ...state, filterStatus: action.payload, currentPage: 1 };
    case "SET_SEARCH_KEYWORD":
      return { ...state, searchKeyword: action.payload, currentPage: 1 };
    case "SET_PAGE":
      return { ...state, currentPage: action.payload };

    case "SET_VIEW":
      return { ...state, view: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
};

// api utility function
const API_URL = "http://localhost:5000/api";

const authHeader = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const displayError = (dispatch, message) => {
  dispatch({ type: "SET_ERROR", payload: message });
  setTimeout(() => dispatch({ type: "SET_ERROR", payload: null }), 5000);
};

// defines API call functions inside a utility object
const TaskAPI = {
  fetchTasks: async (dispatch, token, filters) => {
    dispatch({ type: "SET_LOADING", payload: true });

    // Construct query string from filters
    const params = new URLSearchParams({
      page: filters.page,
      limit: filters.limit,
      keyword: filters.searchKeyword,
    });

    if (filters.filterStatus && filters.filterStatus !== "All") {
      params.append("status", filters.filterStatus);
    }

    const url = `${API_URL}/tasks?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: authHeader(token),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to fetch tasks");

      // data includes tasks and pagination metadata
      dispatch({ type: "SET_TASKS", payload: data });
    } catch (err) {
      console.error(err);
      displayError(dispatch, `Task Error: ${err.message}`);
      dispatch({
        type: "SET_TASKS",
        payload: { tasks: [], page: 1, pages: 1, total: 0, limit: 10 },
      });
    } finally {
      // Note: SET_TASKS sets loading to false
    }
  },

  createTask: async (dispatch, token, taskData) => {
    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify(taskData),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to create task");
      // instead of ADD_TASK, we trigger a refetch
      dispatch({ type: "ADD_TASK" });
      return true;
    } catch (err) {
      displayError(dispatch, `Creation Error: ${err.message}`);
      return false;
    }
  },

  updateTask: async (dispatch, token, taskId, updateData) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "PUT",
        headers: authHeader(token),
        body: JSON.stringify(updateData),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to update task");
      // here trigger refetch
      dispatch({ type: "UPDATE_TASK" });
      return true;
    } catch (err) {
      displayError(dispatch, `Update Error: ${err.message}`);
      return false;
    }
  },

  deleteTask: async (dispatch, token, taskId) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: "DELETE",
        headers: authHeader(token),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete task");
      }
      // trigger refetch
      dispatch({ type: "DELETE_TASK" });
    } catch (err) {
      displayError(dispatch, `Delete Error: ${err.message}`);
    }
  },
};

//reusable components

const Input = ({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
}) => (
  <div className="flex flex-col space-y-1">
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
    />
  </div>
);

// statusStyles defined globally
const statusStyles = {
  Pending: "bg-red-100 text-red-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800",
  Canceled: "bg-gray-100 text-gray-800",
};

// StatusBadge defined globally
const StatusBadge = ({ status }) => (
  <span
    className={`px-3 py-1 text-xs font-semibold rounded-full ${statusStyles[status]}`}
  >
    {status}
  </span>
);

// auth forms
const AuthForm = ({ type, dispatch }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isLogin = type === "login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    dispatch({ type: "SET_ERROR", payload: null });

    const endpoint = isLogin ? "login" : "register";

    try {
      const response = await fetch(`${API_URL}/users/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        dispatch({ type: "LOGIN_SUCCESS", payload: data });
      } else {
        throw new Error(data.message || "Authentication failed");
      }
    } catch (err) {
      displayError(dispatch, err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white shadow-2xl rounded-xl border border-gray-200">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">
        {isLogin ? "Welcome Back" : "Create Account"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        <button
          type="submit"
          className="w-full py-3 px-4 border border-transparent rounded-lg shadow-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Processing..." : isLogin ? "Sign In" : "Register"}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          onClick={() =>
            dispatch({
              type: "SET_VIEW",
              payload: isLogin ? "register" : "login",
            })
          }
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition duration-150"
        >
          {isLogin
            ? "Need an account? Register"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
};

// create Task Form Component

const CreateTaskForm = ({ dispatch, token }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await TaskAPI.createTask(dispatch, token, {
      title,
      description,
    });
    setLoading(false);
    if (success) {
      setTitle("");
      setDescription("");
      setIsExpanded(false);
    }
  };

  return (
    <div className="mb-8 p-6 bg-white border border-blue-200 rounded-xl shadow-xl">
      <h2
        className="text-xl font-bold text-gray-800 mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? "Collapse Task Form" : "Create New Task..."}
      </h2>
      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Task Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Finish backend API documentation"
            required
          />
          <Input
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed steps for completing the task"
          />
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-lg shadow-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Adding..." : "Add Task"}
          </button>
        </form>
      )}
    </div>
  );
};

// Minor changes to handle updated task list

const TaskItem = ({ task, dispatch, token }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(task.title);
  const [newStatus, setNewStatus] = useState(task.status);
  const [newDescription, setNewDescription] = useState(task.description);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    // use TaskAPI.updateTask
    const success = await TaskAPI.updateTask(dispatch, token, task._id, {
      title: newTitle,
      status: newStatus,
      description: newDescription,
    });
    if (success) {
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    // use TaskAPI.deleteTask
    await TaskAPI.deleteTask(dispatch, token, task._id);
    setIsDeleting(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 bg-white border border-indigo-200 rounded-xl shadow-lg mb-4">
        <form onSubmit={handleUpdate} className="space-y-3">
          <Input
            label="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 shadow-sm"
            >
              {Object.keys(statusStyles).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Description (Optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition duration-150"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="p-5 bg-white border border-gray-100 rounded-xl shadow-md flex justify-between items-start mb-4 hover:shadow-lg transition duration-200">
      <div className="flex-grow">
        <div className="flex items-center space-x-3 mb-1">
          <h3 className="text-lg font-semibold text-gray-800">{task.title}</h3>
          <StatusBadge status={task.status} />
        </div>
        {task.description && (
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Created: {new Date(task.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex space-x-2 ml-4">
        <button
          onClick={() => setIsEditing(true)}
          className="p-2 text-indigo-600 hover:text-indigo-800 transition duration-150 rounded-lg hover:bg-indigo-50"
          title="Edit Task"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="p-2 text-red-600 hover:text-red-800 transition duration-150 rounded-lg hover:bg-red-50 disabled:opacity-50"
          title="Delete Task"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

// filter and pagination components (NEW) ---

const FilterControls = ({ state, dispatch }) => {
  const { filterStatus, searchKeyword } = state;
  const allStatuses = [
    "All",
    "Pending",
    "In Progress",
    "Completed",
    "Canceled",
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-200">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Task Filters</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) =>
              dispatch({ type: "SET_FILTER_STATUS", payload: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          >
            {allStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Keyword search */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search Keyword (Title/Description)
          </label>
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) =>
              dispatch({ type: "SET_SEARCH_KEYWORD", payload: e.target.value })
            }
            placeholder="Search tasks..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>
    </div>
  );
};

const PaginationControls = ({ state, dispatch }) => {
  const { currentPage, totalPages, totalTasks } = state;

  if (totalTasks === 0) return null;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      dispatch({ type: "SET_PAGE", payload: newPage });
    }
  };

  return (
    <div className="flex justify-between items-center mt-8 p-4 bg-white rounded-xl shadow-lg border border-gray-200">
      <span className="text-sm text-gray-600">
        Showing page {currentPage} of {totalPages}. Total tasks: {totalTasks}.
      </span>
      <div className="flex space-x-2">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition"
        >
          Previous
        </button>
        <span className="px-3 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-lg">
          {currentPage}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition"
        >
          Next
        </button>
      </div>
    </div>
  );
};

// (UPDATED) DASHBOARD COMPONENT

const Dashboard = ({ state, dispatch }) => {
  const {
    user,
    tasks,
    loading,
    filterStatus,
    searchKeyword,
    currentPage,
    tasksPerPage,
  } = state;

  // Trigger task fetch whenever filters or page changes
  useEffect(() => {
    if (user && user.token) {
      // Use TaskAPI.fetchTasks
      TaskAPI.fetchTasks(dispatch, user.token, {
        filterStatus,
        searchKeyword,
        page: currentPage,
        limit: tasksPerPage,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dispatch, filterStatus, searchKeyword, currentPage]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto w-full">
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-gray-200">
          <h1 className="text-4xl font-extrabold text-indigo-700">
            Task Platform
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 text-sm hidden sm:inline">
              {user.email} ({user.role})
            </span>
            <button
              onClick={() => dispatch({ type: "LOGOUT" })}
              className="py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition duration-150"
            >
              Sign Out
            </button>
          </div>
        </header>
        <CreateTaskForm dispatch={dispatch} token={user.token} />
        <FilterControls state={state} dispatch={dispatch} />{" "}
        {/* new filter control */}
        {loading && (
          <div className="text-center p-8">
            <div
              className="spinner-border animate-spin inline-block w-8 h-8 border-4 rounded-full border-indigo-500 border-t-transparent"
              role="status"
            ></div>
            <p className="text-indigo-600 mt-2">Loading tasks...</p>
          </div>
        )}
        {/*  Display tasks in a single column layout since filtering handles grouping */}
        <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-indigo-400 pb-1">
          {filterStatus === "All" ? "All Tasks" : `${filterStatus} Tasks`} (
          {state.totalTasks})
        </h2>
        <div className="grid grid-cols-1 gap-6">
          {tasks.length === 0 && !loading ? (
            <p className="text-gray-500 p-4 bg-white rounded-lg shadow-md">
              No tasks found matching the current filters.
            </p>
          ) : (
            tasks.map((task) => (
              <TaskItem
                key={task._id}
                task={task}
                dispatch={dispatch}
                token={user.token}
              />
            ))
          )}
        </div>
        <PaginationControls state={state} dispatch={dispatch} />{" "}
      </div>
    </div>
  );
};

// --- main app component ---

const App = () => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { view, user, error } = state;

  let content;
  switch (view) {
    case "login":
      content = <AuthForm type="login" dispatch={dispatch} />;
      break;
    case "register":
      content = <AuthForm type="register" dispatch={dispatch} />;
      break;
    case "dashboard":
      content = user ? (
        <Dashboard state={state} dispatch={dispatch} />
      ) : (
        <AuthForm type="login" dispatch={dispatch} />
      );
      break;
    default:
      content = <AuthForm type="login" dispatch={dispatch} />;
  }

  // centered layout for auth forms
  const authLayout = (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-inter">
      {content}
    </div>
  );

  const mainLayout = (
    <div className="min-h-screen bg-gray-50 font-inter">{content}</div>
  );

  return (
    <div className="font-sans">
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-red-600 text-white text-center font-bold shadow-lg">
          {error}
        </div>
      )}

      {view === "dashboard" ? mainLayout : authLayout}

      {/*  tailwind utility classes for spinner */}
      <style>{`
                .spinner-border {
                    display: inline-block;
                    width: 2rem;
                    height: 2rem;
                    vertical-align: -0.125em;
                    border: 0.25em solid currentColor;
                    border-right-color: transparent;
                    border-radius: 50%;
                    -webkit-animation: .75s linear infinite spinner-border;
                    animation: .75s linear infinite spinner-border;
                }
                @keyframes spinner-border {
                    to { transform: rotate(360deg); }
                }
            `}</style>
    </div>
  );
};

export default App;
