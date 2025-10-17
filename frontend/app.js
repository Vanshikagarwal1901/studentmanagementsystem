const API_BASE = 'http://localhost:5000/api';
let currentUser = null;
let token = null;

// Utility helpers
function showElement(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function hideElement(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function safeAddActive(el) { if (el) el.classList.add('active'); }

function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  if (event && event.target) safeAddActive(event.target);
}

function showFacultyTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');
  if (event && event.target) safeAddActive(event.target);
  // If opening performance tab, ensure performance data is loaded
  // (performance tab removed)
}

// Auth
async function login() {
  const role = document.getElementById('roleSelect').value;
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const resp = await fetch(`${API_BASE}/${role}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await resp.json();
    if (resp.ok) {
      token = data.token; currentUser = data.user;
      localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(currentUser));
      hideElement('loginSection');
      if (currentUser.role === 'admin') { showElement('adminDashboard'); loadAdminData(); } else { showElement('facultyDashboard'); loadFacultyData(); }
    } else document.getElementById('loginMessage').textContent = data.error;
  } catch (e) { document.getElementById('loginMessage').textContent = 'Login failed: ' + e.message; }
}

function logout() { token = null; currentUser = null; localStorage.removeItem('token'); localStorage.removeItem('user'); hideElement('adminDashboard'); hideElement('facultyDashboard'); showElement('loginSection'); }

function checkAuth() { const t = localStorage.getItem('token'); const u = localStorage.getItem('user'); if (t && u) { token = t; currentUser = JSON.parse(u); hideElement('loginSection'); if (currentUser.role === 'admin') { showElement('adminDashboard'); loadAdminData(); } else { showElement('facultyDashboard'); loadFacultyData(); } } }

async function apiCall(endpoint, options = {}) { if (!token) { logout(); return; } const defaultOptions = { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }; const resp = await fetch(`${API_BASE}${endpoint}`, { ...defaultOptions, ...options }); if (resp.status === 401) { logout(); throw new Error('Session expired'); } return resp; }

// UI helpers
function showMessage(text, type='success', timeout=3000){
  const el = document.getElementById('message');
  if (!el) { console.log(text); return; }
  el.textContent = text; el.className = `message ${type}`; el.style.display = 'block';
  setTimeout(()=>{ el.style.display='none'; }, timeout);
}

function showLoading(on=true){ const s = document.getElementById('spinner'); if (!s) return; s.style.display = on ? 'flex' : 'none'; }

// Admin flows
async function loadAdminData() { await loadFaculty(); await loadStudents(); await loadAssignmentData(); }

// Render admin summary counts
async function renderAdminSummary() {
  try {
    const [fR, sR, aR] = await Promise.all([apiCall('/admin/faculty'), apiCall('/admin/students'), apiCall('/admin/assignments')]);
    const [faculties, students, assignments] = await Promise.all([fR.json(), sR.json(), aR.json()]);
    const fCountEl = document.getElementById('summaryFacultyCount'); if (fCountEl) fCountEl.textContent = (faculties && faculties.length) ? faculties.length : 0;
    const sCountEl = document.getElementById('summaryStudentsCount'); if (sCountEl) sCountEl.textContent = (students && students.length) ? students.length : 0;
    const aCountEl = document.getElementById('summaryAssignmentsCount'); if (aCountEl) aCountEl.textContent = (assignments && assignments.length) ? assignments.length : 0;
  } catch (e) { console.error('Error rendering admin summary', e); }
}

// FACULTY
async function loadFaculty() {
  try {
    const r = await apiCall('/admin/faculty');
    const faculty = await r.json();
  const tbody = document.querySelector('#facultyTable tbody');
    tbody.innerHTML = faculty.map(f => `
      <tr>
        <td>${f.faculty_id}</td>
        <td>${f.username}</td>
        <td>${f.full_name}</td>
        <td>${f.department}</td>
        <td>${f.subject}</td>
        <td>${f.is_active ? 'Active' : 'Inactive'}</td>
        <td><button onclick="startEditFaculty(${f.faculty_id})">Edit</button> <button onclick="deleteFaculty(${f.faculty_id})">Delete</button></td>
      </tr>
    `).join('');
    // Update admin summary counts
    renderAdminSummary();
  } catch (e) { console.error('Error loading faculty', e); }
}

let editingFacultyId = null;
async function startEditFaculty(id) {
  try {
    const r = await apiCall(`/admin/faculty/${id}`);
    if (!r.ok) { showMessage('Failed to fetch faculty', 'error'); return; }
    const f = await r.json();
    document.getElementById('facultyUsername').value = f.username || '';
    document.getElementById('facultyPassword').value = f.password || '';
    document.getElementById('facultyEmail').value = f.email || '';
    document.getElementById('facultyFullName').value = f.full_name || '';
    document.getElementById('facultyDepartment').value = f.department || '';
    document.getElementById('facultySubject').value = f.subject || '';
    showElement('addFacultyForm');
    document.querySelector('#addFacultyForm h4').textContent = 'Edit Faculty';
    document.getElementById('facultySaveBtn').textContent = 'Save';
    editingFacultyId = id;
  } catch (e) { showMessage('Error: ' + e.message, 'error'); }
}

async function deleteFaculty(id) {
  if (!confirm('Delete this faculty and all related assignments/marks?')) return;
  try {
    showLoading(true);
    const r = await apiCall(`/admin/faculty/${id}`, { method: 'DELETE' });
    if (r.ok) {
      showMessage('Faculty deleted');
      loadFaculty();
      loadAssignmentData();
    } else {
      const e = await r.json();
      showMessage('Error: ' + e.error, 'error');
    }
  } catch (e) {
    showMessage('Error: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function addFaculty() {
  const data = { username: document.getElementById('facultyUsername').value, password: document.getElementById('facultyPassword').value, email: document.getElementById('facultyEmail').value, full_name: document.getElementById('facultyFullName').value, department: document.getElementById('facultyDepartment').value, subject: document.getElementById('facultySubject').value };
  try {
    showLoading(true);
    if (editingFacultyId) {
      const r = await apiCall(`/admin/faculty/${editingFacultyId}`, { method: 'PUT', body: JSON.stringify(data) });
      if (r.ok) {
        showMessage('Faculty updated');
        editingFacultyId = null;
        document.querySelector('#addFacultyForm h4').textContent = 'Add New Faculty';
        document.getElementById('facultySaveBtn').textContent = 'Add Faculty';
        hideAddFacultyForm();
        loadFaculty();
      } else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
    } else {
      const r = await apiCall('/admin/faculty', { method: 'POST', body: JSON.stringify(data) });
      if (r.ok) { showMessage('Faculty added'); hideAddFacultyForm(); loadFaculty(); } else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
    }
  } catch (e) { showMessage('Error: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

function showAddFacultyForm() { showElement('addFacultyForm'); }
function hideAddFacultyForm() { editingFacultyId = null; document.querySelector('#addFacultyForm h4').textContent = 'Add New Faculty'; document.getElementById('facultySaveBtn').textContent = 'Add Faculty'; hideElement('addFacultyForm'); }

// STUDENTS
async function loadStudents() {
  try {
    const r = await apiCall('/admin/students');
    const students = await r.json();
    const tbody = document.querySelector('#studentsTable tbody');
    tbody.innerHTML = students.map(s => `
      <tr>
        <td>${s.roll_number}</td>
        <td>${s.full_name}</td>
        <td>${s.email}</td>
        <td>${s.department}</td>
        <td>${s.semester}</td>
        <td>${s.is_active ? 'Active' : 'Inactive'}</td>
        <td><button onclick="startEditStudent(${s.student_id})">Edit</button> <button onclick="deleteStudent(${s.student_id})">Delete</button></td>
      </tr>
    `).join('');
    renderAdminSummary();
  } catch (e) { console.error('Error loading students', e); }
}

let editingStudentId = null;
async function startEditStudent(id) {
  try {
    const r = await apiCall(`/admin/students/${id}`);
    if (!r.ok) { showMessage('Failed to fetch student', 'error'); return; }
    const s = await r.json();
    document.getElementById('studentRollNumber').value = s.roll_number || '';
    document.getElementById('studentFullName').value = s.full_name || '';
    document.getElementById('studentEmail').value = s.email || '';
    document.getElementById('studentPhone').value = s.phone || '';
    document.getElementById('studentDepartment').value = s.department || '';
    document.getElementById('studentSemester').value = s.semester || '';
    showElement('addStudentForm');
    document.querySelector('#addStudentForm h4').textContent = 'Edit Student';
    document.getElementById('studentSaveBtn').textContent = 'Save';
    editingStudentId = id;
  } catch (e) { showMessage('Error: ' + e.message, 'error'); }
}

async function deleteStudent(id) {
  if (!confirm('Delete this student and all related assignments/marks?')) return;
  try {
    showLoading(true);
    const r = await apiCall(`/admin/students/${id}`, { method: 'DELETE' });
    if (r.ok) {
      showMessage('Student deleted');
      loadStudents();
      loadAssignmentData();
    } else {
      const e = await r.json();
      showMessage('Error: ' + e.error, 'error');
    }
  } catch (e) {
    showMessage('Error: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function addStudent() {
  const data = { roll_number: document.getElementById('studentRollNumber').value, full_name: document.getElementById('studentFullName').value, email: document.getElementById('studentEmail').value, phone: document.getElementById('studentPhone').value, department: document.getElementById('studentDepartment').value, semester: parseInt(document.getElementById('studentSemester').value) };
  try {
    showLoading(true);
    if (editingStudentId) {
      const r = await apiCall(`/admin/students/${editingStudentId}`, { method: 'PUT', body: JSON.stringify(data) });
      if (r.ok) {
        showMessage('Student updated');
        editingStudentId = null;
        document.querySelector('#addStudentForm h4').textContent = 'Add New Student';
        document.getElementById('studentSaveBtn').textContent = 'Add Student';
        hideAddStudentForm();
        loadStudents();
      } else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
    } else {
      const r = await apiCall('/admin/students', { method: 'POST', body: JSON.stringify(data) });
      if (r.ok) { showMessage('Student added'); hideAddStudentForm(); loadStudents(); } else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
    }
  } catch (e) { showMessage('Error: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

function showAddStudentForm() { showElement('addStudentForm'); }
function hideAddStudentForm() { editingStudentId = null; document.querySelector('#addStudentForm h4').textContent = 'Add New Student'; document.getElementById('studentSaveBtn').textContent = 'Add Student'; hideElement('addStudentForm'); }

// Assignments
async function loadAssignmentData() {
  try {
    const [fR, sR] = await Promise.all([apiCall('/admin/faculty'), apiCall('/admin/students')]);
    const faculty = await fR.json(); const students = await sR.json();
    document.getElementById('assignFacultySelect').innerHTML = faculty.map(f => `<option value="${f.faculty_id}">${f.full_name} - ${f.subject}</option>`).join('');
    document.getElementById('assignStudentSelect').innerHTML = students.map(s => `<option value="${s.student_id}">${s.roll_number} - ${s.full_name}</option>`).join('');
    const asR = await apiCall('/admin/assignments'); const assignments = await asR.json(); const tbody = document.querySelector('#assignmentsTable tbody'); if (tbody) tbody.innerHTML = assignments.map(a => `<tr><td>${a.assignment_id}</td><td>${a.faculty_id}</td><td>${a.student_id}</td><td>${a.subject}</td><td><button onclick="deleteAssignment(${a.assignment_id})">Delete</button></td></tr>`).join('');
    renderAdminSummary();
    // Render charts for assignments
    try { renderAssignmentsCharts(assignments, students, faculty); } catch (e) { console.error('Error rendering charts', e); }
  } catch (e) { console.error('Error loading assignments', e); }
}

// Keep copies for filtering
let _cachedFaculty = [];
let _cachedStudents = [];
let _cachedAssignments = [];

function renderAssignmentsTable(assignments = [], faculty = [], students = []){
  _cachedAssignments = assignments;
  _cachedFaculty = faculty;
  _cachedStudents = students;
  const facultyById = Object.fromEntries((faculty||[]).map(f => [f.faculty_id, f]));
  const studentById = Object.fromEntries((students||[]).map(s => [s.student_id, s]));
  const tbody = document.querySelector('#assignmentsTable tbody');
  if (!tbody) return;
  tbody.innerHTML = (assignments||[]).map(a => {
    const f = facultyById[a.faculty_id];
    const s = studentById[a.student_id];
    const fname = f ? (f.full_name || `Faculty ${f.faculty_id}`) : a.faculty_id;
    const sname = s ? (s.full_name || `Student ${s.student_id}`) : a.student_id;
    return `<tr data-id="${a.assignment_id}"><td>${a.assignment_id}</td><td class="assign-faculty">${escapeHtml(fname)}</td><td class="assign-student">${escapeHtml(sname)}</td><td class="assign-subject">${escapeHtml(a.subject || '')}</td><td><button onclick="deleteAssignment(${a.assignment_id})">Delete</button></td></tr>`;
  }).join('');
}

function escapeHtml(s){ return String(s||'').replace(/[&<>\"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function loadAssignmentData() {
  // wrapper to fetch and render with caches
  try {
    const [fR, sR] = await Promise.all([apiCall('/admin/faculty'), apiCall('/admin/students')]);
    const faculty = await fR.json(); const students = await sR.json();
    document.getElementById('assignFacultySelect').innerHTML = faculty.map(f => `<option value="${f.faculty_id}">${f.full_name} - ${f.subject}</option>`).join('');
    document.getElementById('assignStudentSelect').innerHTML = students.map(s => `<option value="${s.student_id}">${s.roll_number} - ${s.full_name}</option>`).join('');
    const asR = await apiCall('/admin/assignments'); const assignments = await asR.json();
    renderAdminSummary();
    renderAssignmentsTable(assignments, faculty, students);
    try { renderAssignmentsCharts(assignments, students, faculty); } catch (e) { console.error('Error rendering charts', e); }
  } catch (e) { console.error('Error loading assignments', e); }
}

// Filters
function filterFaculty(){
  const q = (document.getElementById('searchFacultyInput').value || '').toLowerCase();
  const rows = document.querySelectorAll('#facultyTable tbody tr');
  rows.forEach(r => { r.style.display = (r.textContent || '').toLowerCase().includes(q) ? '' : 'none'; });
}

function filterStudents(){
  const q = (document.getElementById('searchStudentsInput').value || '').toLowerCase();
  const rows = document.querySelectorAll('#studentsTable tbody tr');
  rows.forEach(r => { r.style.display = (r.textContent || '').toLowerCase().includes(q) ? '' : 'none'; });
}

function filterAssignments(){
  const q = (document.getElementById('searchAssignmentsInput').value || '').toLowerCase();
  const rows = document.querySelectorAll('#assignmentsTable tbody tr');
  rows.forEach(r => { r.style.display = (r.textContent || '').toLowerCase().includes(q) ? '' : 'none'; });
}

// Chart instances (so we can destroy and recreate)
let _assignmentsPerFacultyChart = null;
let _studentsByDeptChart = null;

function renderAssignmentsCharts(assignments = [], students = [], faculty = []) {
  // Build faculty id -> name map
  const facultyName = {};
  (faculty || []).forEach(f => { facultyName[f.faculty_id] = f.full_name ? `${f.full_name} (${f.subject || ''})` : `Faculty ${f.faculty_id}`; });

  // Count assignments per faculty
  const facultyCount = {};
  assignments.forEach(a => { const id = a.faculty_id || 'unknown'; facultyCount[id] = (facultyCount[id] || 0) + 1; });

  // Convert to array and sort by count desc for nicer visualization
  const entries = Object.keys(facultyCount).map(id => ({ id, name: facultyName[id] || `ID ${id}`, count: facultyCount[id] }));
  entries.sort((a,b) => b.count - a.count);

  const labels = entries.map(e => e.name);
  const data = entries.map(e => e.count);

  // Generate color palette (repeating if needed)
  const baseColors = ['#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f','#edc949','#b07aa1','#ff9da7','#9c755f'];
  const backgroundColors = labels.map((_,i) => baseColors[i % baseColors.length]);

  // Destroy previous chart if exists
  if (_assignmentsPerFacultyChart) { try { _assignmentsPerFacultyChart.destroy(); } catch(e){} _assignmentsPerFacultyChart = null; }
  const ctx1 = document.getElementById('assignmentsPerFacultyChart');
  if (ctx1) {
    // Use a vertical bar chart (categories on x-axis) with tuned sizing for proportions
    try {
      const container = ctx1.parentElement; // the div around the canvas
      // Keep a reasonable fixed height so bars don't become excessively tall
      const desiredHeight = 320;
      container.style.height = desiredHeight + 'px';
    } catch (e) { /* ignore */ }

    const maxValue = (data && data.length) ? Math.max(...data) : 0;
    const suggestedMax = Math.max(maxValue + 1, 5); // leave some headroom

    _assignmentsPerFacultyChart = new Chart(ctx1.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Assignments', data, backgroundColor: backgroundColors, borderRadius: 8 }] },
      options: {
        indexAxis: 'x',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 6, bottom: 6 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.formattedValue} assignment${ctx.formattedValue === '1' ? '' : 's'}` } }
        },
        scales: {
          // Hide x-axis labels as requested (no names on x axis)
          x: { ticks: { display: false }, grid: { display: false } },
          y: { beginAtZero: true, suggestedMax: suggestedMax, grid: { color: '#f0f0f0' } }
        },
        // Make bars a bit closer but not touching
        elements: { bar: { maxBarThickness: 64, barPercentage: 0.75, categoryPercentage: 0.9, borderRadius: 8 } }
      }
    });
  }

  // Students by Department (unchanged appearance but ensure colors rotate)
  const deptCount = {};
  students.forEach(s => { const d = s.department || 'Unknown'; deptCount[d] = (deptCount[d] || 0) + 1; });
  const deptEntries = Object.keys(deptCount).map(k => ({ k, v: deptCount[k] }));
  const deptLabels = deptEntries.map(e => e.k);
  const deptData = deptEntries.map(e => e.v);
  const deptColors = deptLabels.map((_,i) => baseColors[i % baseColors.length]);

  if (_studentsByDeptChart) { try { _studentsByDeptChart.destroy(); } catch(e){} _studentsByDeptChart = null; }
  const ctx2 = document.getElementById('studentsByDeptChart');
  if (ctx2) {
    _studentsByDeptChart = new Chart(ctx2.getContext('2d'), {
      type: 'pie',
      data: { labels: deptLabels, datasets: [{ data: deptData, backgroundColor: deptColors }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

async function assignStudent() {
  const faculty_id = document.getElementById('assignFacultySelect').value;
  const student_id = document.getElementById('assignStudentSelect').value;
  const subject = document.getElementById('assignSubject').value;
  try {
    showLoading(true);
    const r = await apiCall('/admin/assign-student', { method: 'POST', body: JSON.stringify({ faculty_id, student_id, subject }) });
    if (r.ok) {
      showMessage('Assigned');
      document.getElementById('assignSubject').value = '';
      loadAssignmentData();
    } else {
      const e = await r.json();
      showMessage('Error: ' + e.error, 'error');
    }
  } catch (e) {
    showMessage('Error: ' + e.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function deleteAssignment(id) {
  if (!confirm('Delete assignment?')) return;
  try {
    showLoading(true);
    const r = await apiCall(`/admin/assignments/${id}`, { method: 'DELETE' });
    if (r.ok) { showMessage('Deleted'); loadAssignmentData(); }
    else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
  } catch (e) { showMessage('Error: ' + e.message, 'error'); } finally { showLoading(false); }
}

// Faculty flows
async function loadFacultyData() { await loadAssignedStudents(); await loadMarks(); await loadMarksStudents(); }
async function loadAssignedStudents() { try { const r = await apiCall('/faculty/students'); const students = await r.json(); document.querySelector('#assignedStudentsTable tbody').innerHTML = students.map(s => `<tr><td>${s.roll_number}</td><td>${s.student_name}</td><td>${s.department}</td><td>${s.semester}</td><td>${s.subject}</td></tr>`).join(''); } catch (e) { console.error(e); } }

async function loadMarks() {
  try {
    const r = await apiCall('/faculty/marks');
    const marks = await r.json();
    const tbody = document.querySelector('#marksTable tbody');
    if (tbody) tbody.innerHTML = marks.map(m => `
      <tr>
        <td>${m.roll_number}</td>
        <td>${m.student_name}</td>
        <td>${m.subject}</td>
        <td>${m.theory_marks}</td>
        <td>${m.internal_marks}</td>
        <td>${m.lab_marks}</td>
        <td>${m.assignment_marks}</td>
        <td>${m.total_marks}</td>
        <td><button onclick="deleteMarks(${m.mark_id || 0})">Delete</button></td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}




async function deleteMarks(id) {
  if (!id || id === 0) { showMessage('Invalid mark id', 'error'); return; }
  if (!confirm('Delete marks?')) return;
  try {
    showLoading(true);
    const r = await apiCall(`/faculty/marks/${id}`, { method: 'DELETE' });
    if (r.ok) { showMessage('Deleted'); loadMarks(); }
    else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
  } catch (e) { showMessage('Error: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

async function loadMarksStudents() { try { const r = await apiCall('/faculty/students'); const students = await r.json(); document.getElementById('marksStudentSelect').innerHTML = students.map(s => `<option value="${s.student_id}">${s.roll_number} - ${s.student_name} (${s.subject})</option>`).join(''); } catch (e) { console.error(e); } }

async function updateMarks() {
  const student_id = document.getElementById('marksStudentSelect').value;
  const subject = document.getElementById('marksSubject').value;
  const theory_marks = parseFloat(document.getElementById('theoryMarks').value) || 0;
  const internal_marks = parseFloat(document.getElementById('internalMarks').value) || 0;
  const lab_marks = parseFloat(document.getElementById('labMarks').value) || 0;
  const assignment_marks = parseFloat(document.getElementById('assignmentMarks').value) || 0;
  const semester = parseInt(document.getElementById('semester').value);
  const academic_year = parseInt(document.getElementById('academicYear').value);
  try {
    showLoading(true);
    const r = await apiCall('/faculty/marks', { method: 'POST', body: JSON.stringify({ student_id, subject, theory_marks, internal_marks, lab_marks, assignment_marks, semester, academic_year }) });
    if (r.ok) {
      showMessage('Marks updated');
      loadMarks();
      document.getElementById('theoryMarks').value='';
      document.getElementById('internalMarks').value='';
      document.getElementById('labMarks').value='';
      document.getElementById('assignmentMarks').value='';
      document.getElementById('semester').value='';
    } else { const e = await r.json(); showMessage('Error: ' + e.error, 'error'); }
  } catch (e) { showMessage('Error: ' + e.message, 'error'); }
  finally { showLoading(false); }
}

async function downloadExcelReport() { try { const r = await fetch(`${API_BASE}/faculty/report/excel`, { headers: { 'Authorization': `Bearer ${token}` } }); if (r.ok) { const blob = await r.blob(); const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `marks_report_${currentUser.id}.xlsx`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a); } else showMessage('Error downloading report', 'error'); } catch (e) { showMessage('Error: ' + e.message, 'error'); } }

// Initialize
checkAuth();