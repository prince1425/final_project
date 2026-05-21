// app.js
//
// CodeCraftHub - Simple REST API to manage courses stored in a JSON file.
//
// Requirements satisfied:
// - Node.js + Express REST API with full CRUD for courses
// - Data persisted in a JSON file named "courses.json"
// - Endpoints:
//     POST   /api/courses           -> add a new course
//     GET    /api/courses           -> get all courses
//     GET    /api/courses/:id       -> get a specific course by id
//     PUT    /api/courses/:id       -> update a course (fields optional)
//     DELETE /api/courses/:id       -> delete a course by id
// - Each course: id (auto, starting at 1), name, description, target_date (YYYY-MM-DD),
//   status ("Not Started" | "In Progress" | "Completed"), created_at (timestamp)
// - Auto-create courses.json if it doesn't exist
// - Basic error handling for missing fields, not found, invalid status, and file I/O
// - Server runs on port 5000
//
// Notes for beginners:
// - All data is stored in a single JSON file (no database).
// - Remember to run: npm install express
// - Start with: node app.js

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// Create the Express app
const app = express();

// Port to run the server on
const PORT = 5000;

// Path to the JSON file that stores courses
// Placed in the project root as "courses.json"
const DATA_FILE = path.join(__dirname, 'courses.json');

// Validation constants
const VALID_STATUSES = ['Not Started', 'In Progress', 'Completed'];

// Middleware: parse JSON bodies
app.use(express.json());

/**
 * Ensure the data file exists.
 * If it doesn't exist, create it with an empty array [].
 * This implements requirement: "the app creates courses.json automatically if it doesn't exist"
 */
async function ensureDataFile() {
  try {
    // Try accessing the file; if it exists, nothing to do
    await fs.access(DATA_FILE);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist -> create directory (if needed) and file
      await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
      await fs.writeFile(DATA_FILE, '[]', 'utf8');
    } else {
      // Propagate other errors
      throw err;
    }
  }
}

/**
 * Read all courses from the JSON file.
 * Returns an array (empty if none).
 * Implements basic error handling for read failures.
 */
async function readCourses() {
  try {
    await ensureDataFile();
    const data = await fs.readFile(DATA_FILE, 'utf8');
    try {
      return JSON.parse(data);
    } catch (parseErr) {
      // If file contents are invalid, reset to empty array (safe-guard)
      console.error('Invalid JSON in courses.json. Resetting to empty array.');
      return [];
    }
  } catch (err) {
    throw err; // Let caller handle (404/500)
  }
}

/**
 * Write the provided courses array back to the JSON file.
 * Used after create/update/delete operations.
 */
async function writeCourses(courses) {
  await fs.writeFile(DATA_FILE, JSON.stringify(courses, null, 2), 'utf8');
}

/**
 * Validate that a status value is one of the allowed options.
 */
function isValidStatus(status) {
  return typeof status === 'string' && VALID_STATUSES.includes(status);
}

/**
 * Basic date validation for YYYY-MM-DD.
 * - Checks format with a regex
 * - Checks that the date is a valid calendar date
 */
function isValidDateYYYYMMDD(dateStr) {
  if (typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  // Additional sanity: ensure components match (optional but robust)
  const [year, month, day] = dateStr.split('-').map(Number);
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
}

/**
 * ROUTES
 * The endpoints implemented below satisfy:
 * - POST /api/courses
 * - GET /api/courses
 * - GET /api/courses/:id (get specific course)
 * - PUT /api/courses/:id (update course by id in route, fields optional)
 * - DELETE /api/courses/:id (delete course by id in route)
 */

// 1) POST /api/courses
//    Add a new course with required fields.
//    Expects JSON body: { name, description, target_date, status }
app.post('/api/courses', async (req, res) => {
  const { name, description, target_date, status } = req.body;

  // Required fields check
  if (!name || !description || !target_date || !status) {
    return res.status(400).json({
      error: 'Missing required fields: name, description, target_date, status',
    });
  }

  // Validate target_date format
  if (!isValidDateYYYYMMDD(target_date)) {
    return res.status(400).json({
      error: 'Invalid target_date. Required format: YYYY-MM-DD',
    });
  }

  // Validate status value
  if (!isValidStatus(status)) {
    return res.status(400).json({
      error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
    });
  }

  try {
    const courses = await readCourses();
    // Auto-increment id
    const nextId = courses.length > 0 ? Math.max(...courses.map((c) => c.id)) + 1 : 1;
    const created_at = new Date().toISOString();

    const newCourse = {
      id: nextId,
      name,
      description,
      target_date,
      status,
      created_at,
    };

    courses.push(newCourse);
    await writeCourses(courses);

    return res.status(201).json(newCourse);
  } catch (err) {
    console.error('Error creating course:', err);
    return res.status(500).json({ error: 'Failed to create course due to server error' });
  }
});

// 2) GET /api/courses
//    Get all courses OR get a specific course by id via query param (?id=NN)
app.get('/api/courses', async (req, res) => {
  const idParam = req.query.id;

  try {
    const courses = await readCourses();

    if (idParam !== undefined) {
      const id = Number(idParam);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'Invalid course id' });
      }
      const course = courses.find((c) => c.id === id);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }
      return res.json(course);
    }

    return res.json(courses);
  } catch (err) {
    console.error('Error reading courses:', err);
    return res.status(500).json({ error: 'Failed to read courses' });
  }
});

// 3) GET /api/courses/:id
//     Direct route to fetch a specific course by id
app.get('/api/courses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const courses = await readCourses();
    const course = courses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    return res.json(course);
  } catch (err) {
    console.error('Error reading course by id:', err);
    return res.status(500).json({ error: 'Failed to read course' });
  }
});

// 4) PUT /api/courses/:id
//    Update a course dynamically (fields optional)
app.put('/api/courses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  const { name, description, target_date, status } = req.body;

  // Validate status if provided
  if (status !== undefined && !isValidStatus(status)) {
    return res.status(400).json({
      error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`,
    });
  }

  // Validate date format if provided
  if (target_date !== undefined && !isValidDateYYYYMMDD(target_date)) {
    return res.status(400).json({
      error: 'Invalid target_date. Required format: YYYY-MM-DD',
    });
  }

  try {
    const courses = await readCourses();
    const idx = courses.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const course = courses[idx];
    if (name !== undefined) course.name = name;
    if (description !== undefined) course.description = description;
    if (target_date !== undefined) course.target_date = target_date;
    if (status !== undefined) course.status = status;

    await writeCourses(courses);
    return res.json(course);
  } catch (err) {
    console.error('Error updating course:', err);
    return res.status(500).json({ error: 'Failed to update course' });
  }
});

// 5) DELETE /api/courses/:id
//    Delete a course by id in route parameters
app.delete('/api/courses/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid course id' });
  }

  try {
    const courses = await readCourses();
    const idx = courses.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const [deleted] = courses.splice(idx, 1);
    await writeCourses(courses);
    return res.json(deleted);
  } catch (err) {
    console.error('Error deleting course:', err);
    return res.status(500).json({ error: 'Failed to delete course' });
  }
});

// 6) Basic 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 7) Start the server
app.listen(PORT, () => {
  console.log(`- CodeCraftHub API is starting...`);
  console.log(`- Data will be stored in: \`${DATA_FILE}\``);
  console.log(`- API is available at: \`http://localhost:${PORT}\``);
});