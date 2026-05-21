const API_URL = '/api/courses';

// DOM Elements
const courseForm = document.getElementById('course-form');
const courseIdInput = document.getElementById('course-id');
const nameInput = document.getElementById('name');
const descriptionInput = document.getElementById('description');
const targetDateInput = document.getElementById('target_date');
const statusInput = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const cancelBtn = document.getElementById('cancel-btn');
const formTitle = document.getElementById('form-title');

const coursesGrid = document.getElementById('courses-grid');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statNotStarted = document.getElementById('stat-not-started');
const statInProgress = document.getElementById('stat-in-progress');
const statCompleted = document.getElementById('stat-completed');

// Toast Notification Element
const toast = document.getElementById('toast');

let allCourses = [];

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Set default target date to today + 30 days
  const today = new Date();
  today.setDate(today.getDate() + 30);
  targetDateInput.value = today.toISOString().split('T')[0];
  
  fetchCourses();
});

courseForm.addEventListener('submit', handleFormSubmit);
cancelBtn.addEventListener('click', resetForm);
searchInput.addEventListener('input', handleSearch);

// Fetch all courses from the REST API
async function fetchCourses() {
  showLoading(true);
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Failed to fetch courses');
    allCourses = await response.json();
    renderCourses(allCourses);
    updateStats(allCourses);
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to load courses from server', 'error');
  } finally {
    showLoading(false);
  }
}

// Render courses in the grid
function renderCourses(courses) {
  coursesGrid.innerHTML = '';
  
  if (courses.length === 0) {
    emptyState.classList.remove('hidden');
    coursesGrid.classList.add('hidden');
    return;
  }
  
  emptyState.classList.add('hidden');
  coursesGrid.classList.remove('hidden');

  courses.forEach(course => {
    const card = document.createElement('div');
    const statusClass = course.status.toLowerCase().replace(' ', '-');
    card.className = `course-card status-${statusClass}`;
    
    // Format date nicely
    const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const formattedDate = new Date(course.target_date).toLocaleDateString(undefined, dateOptions);

    card.innerHTML = `
      <div>
        <div class="course-header">
          <h3 class="course-title">${escapeHTML(course.name)}</h3>
          <span class="status-badge badge-${statusClass}">${course.status}</span>
        </div>
        <p class="course-desc">${escapeHTML(course.description)}</p>
      </div>
      <div class="course-footer">
        <div class="target-date">
          <i class="fa-regular fa-calendar"></i>
          <span>Target: ${formattedDate}</span>
        </div>
        <div class="card-actions">
          <button class="action-btn edit-btn" onclick="editCourse(${course.id})" title="Edit Goal">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="action-btn delete-btn" onclick="deleteCourse(${course.id})" title="Delete Goal">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    coursesGrid.appendChild(card);
  });
}

// Handle Add/Edit Form Submit
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const courseId = courseIdInput.value;
  const courseData = {
    name: nameInput.value.trim(),
    description: descriptionInput.value.trim(),
    target_date: targetDateInput.value,
    status: statusInput.value
  };

  const isEdit = !!courseId;
  const url = isEdit ? `${API_URL}/${courseId}` : API_URL;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(courseData)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to save course');
    }

    showToast(isEdit ? 'Course updated successfully!' : 'Course created successfully!', 'success');
    resetForm();
    fetchCourses();
  } catch (error) {
    console.error('Error:', error);
    showToast(error.message, 'error');
  }
}

// Load Course into Form for Editing
function editCourse(id) {
  const course = allCourses.find(c => c.id === id);
  if (!course) return;

  courseIdInput.value = course.id;
  nameInput.value = course.name;
  descriptionInput.value = course.description;
  // Date must be YYYY-MM-DD
  targetDateInput.value = course.target_date.substring(0, 10);
  statusInput.value = course.status;

  formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Course`;
  submitBtn.innerHTML = `<i class="fa-solid fa-check"></i> Update Course`;
  cancelBtn.classList.remove('hidden');

  // Scroll to form on mobile view
  courseForm.scrollIntoView({ behavior: 'smooth' });
}

// Delete Course
async function deleteCourse(id) {
  if (!confirm('Are you sure you want to delete this course milestone?')) return;

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete course');

    showToast('Course deleted successfully', 'success');
    // If the course currently being edited is deleted, reset the form
    if (courseIdInput.value == id) {
      resetForm();
    }
    fetchCourses();
  } catch (error) {
    console.error('Error:', error);
    showToast('Failed to delete course', 'error');
  }
}

// Reset Form to initial state
function resetForm() {
  courseForm.reset();
  courseIdInput.value = '';
  formTitle.innerHTML = `<i class="fa-solid fa-circle-plus"></i> Add New Course`;
  submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Save Course`;
  cancelBtn.classList.add('hidden');

  const today = new Date();
  today.setDate(today.getDate() + 30);
  targetDateInput.value = today.toISOString().split('T')[0];
}

// Search / Filter logic
function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = allCourses.filter(course => 
    course.name.toLowerCase().includes(query) || 
    course.description.toLowerCase().includes(query) ||
    course.status.toLowerCase().includes(query)
  );
  renderCourses(filtered);
}

// Update Dashboard Statistics
function updateStats(courses) {
  const total = courses.length;
  const notStarted = courses.filter(c => c.status === 'Not Started').length;
  const inProgress = courses.filter(c => c.status === 'In Progress').length;
  const completed = courses.filter(c => c.status === 'Completed').length;

  animateValue(statTotal, total);
  animateValue(statNotStarted, notStarted);
  animateValue(statInProgress, inProgress);
  animateValue(statCompleted, completed);
}

// Simple helper to animate stat numbers
function animateValue(element, targetVal) {
  let startVal = parseInt(element.textContent) || 0;
  if (startVal === targetVal) return;
  
  const duration = 400; // ms
  const startTime = performance.now();

  function updateNumber(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease-out quad
    const ease = progress * (2 - progress);
    const current = Math.floor(startVal + (targetVal - startVal) * ease);
    
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(updateNumber);
    } else {
      element.textContent = targetVal;
    }
  }
  requestAnimationFrame(updateNumber);
}

// Loading Toggle
function showLoading(isLoading) {
  if (isLoading) {
    loadingSpinner.classList.remove('hidden');
    coursesGrid.classList.add('hidden');
    emptyState.classList.add('hidden');
  } else {
    loadingSpinner.classList.add('hidden');
  }
}

// Show Custom Toast Messages
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// HTML escape helper to prevent XSS
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
