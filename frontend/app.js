const API_BASE = 'http://localhost:5000/api';
let currentUser = null;
let token = null;

// Utility functions
function showElement(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideElement(id) {
    document.getElementById(id).classList.add('hidden');
}

function showTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    // Remove active class from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    // Show selected tab
    document.getElementById(tabId).classList.add('active');
    // Activate corresponding button
    event.target.classList.add('active');
}

function showFacultyTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}

// Login function
async function login() {
    const role = document.getElementById('roleSelect').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/${role}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            hideElement('loginSection');
            if (role === 'admin') {
                showElement('adminDashboard');
                loadAdminData();
            } else {
                showElement('facultyDashboard');
                loadFacultyData();
            }
        } else {
            document.getElementById('loginMessage').textContent = data.error;
        }
    } catch (error) {
        document.getElementById('loginMessage').textContent = 'Login failed: ' + error.message;
    }
}

// Logout function
function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    hideElement('adminDashboard');
    hideElement('facultyDashboard');
    showElement('loginSection');
}

// Check if user is already logged in
function checkAuth() {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        
        hideElement('loginSection');
        if (currentUser.role === 'admin') {
            showElement('adminDashboard');
            loadAdminData();
        } else {
            showElement('facultyDashboard');
            loadFacultyData();
        }
    }
}

// API call helper
async function apiCall(endpoint, options = {}) {
    if (!token) {
        logout();
        return;
    }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...defaultOptions,
        ...options,
    });

    if (response.status === 401) {
        logout();
        throw new Error('Session expired');
    }

    return response;
}

// Admin functions
async function loadAdminData() {
    await loadFaculty();
    await loadStudents();
    await loadAssignmentData();
}

async function loadFaculty() {
    try {
        const response = await apiCall('/admin/faculty');
        const faculty = await response.json();
        
        const tbody = document.querySelector('#facultyTable tbody');
        tbody.innerHTML = faculty.map(f => `
            <tr>
                <td>${f.faculty_id}</td>
                <td>${f.username}</td>
                <td>${f.full_name}</td>
                <td>${f.department}</td>
                <td>${f.subject}</td>
                <td>${f.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading faculty:', error);
    }
}

async function loadStudents() {
    try {
        const response = await apiCall('/admin/students');
        const students = await response.json();
        
        const tbody = document.querySelector('#studentsTable tbody');
        tbody.innerHTML = students.map(s => `
            <tr>
                <td>${s.roll_number}</td>
                <td>${s.full_name}</td>
                <td>${s.email}</td>
                <td>${s.department}</td>
                <td>${s.semester}</td>
                <td>${s.is_active ? 'Active' : 'Inactive'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

async function loadAssignmentData() {
    try {
        const [facultyResponse, studentsResponse] = await Promise.all([
            apiCall('/admin/faculty'),
            apiCall('/admin/students')
        ]);
        
        const faculty = await facultyResponse.json();
        const students = await studentsResponse.json();
        
        const facultySelect = document.getElementById('assignFacultySelect');
        facultySelect.innerHTML = faculty.map(f => 
            `<option value="${f.faculty_id}">${f.full_name} - ${f.subject}</option>`
        ).join('');
        
        const studentSelect = document.getElementById('assignStudentSelect');
        studentSelect.innerHTML = students.map(s => 
            `<option value="${s.student_id}">${s.roll_number} - ${s.full_name}</option>`
        ).join('');
    } catch (error) {
        console.error('Error loading assignment data:', error);
    }
}

function showAddFacultyForm() {
    showElement('addFacultyForm');
}

function hideAddFacultyForm() {
    hideElement('addFacultyForm');
}

async function addFaculty() {
    const facultyData = {
        username: document.getElementById('facultyUsername').value,
        password: document.getElementById('facultyPassword').value,
        email: document.getElementById('facultyEmail').value,
        full_name: document.getElementById('facultyFullName').value,
        department: document.getElementById('facultyDepartment').value,
        subject: document.getElementById('facultySubject').value
    };

    try {
        const response = await apiCall('/admin/faculty', {
            method: 'POST',
            body: JSON.stringify(facultyData)
        });

        if (response.ok) {
            alert('Faculty added successfully');
            hideAddFacultyForm();
            loadFaculty();
            // Clear form
            document.getElementById('facultyUsername').value = '';
            document.getElementById('facultyPassword').value = '';
            document.getElementById('facultyEmail').value = '';
            document.getElementById('facultyFullName').value = '';
            document.getElementById('facultyDepartment').value = '';
            document.getElementById('facultySubject').value = '';
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error adding faculty: ' + error.message);
    }
}

function showAddStudentForm() {
    showElement('addStudentForm');
}

function hideAddStudentForm() {
    hideElement('addStudentForm');
}

async function addStudent() {
    const studentData = {
        roll_number: document.getElementById('studentRollNumber').value,
        full_name: document.getElementById('studentFullName').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value,
        department: document.getElementById('studentDepartment').value,
        semester: parseInt(document.getElementById('studentSemester').value)
    };

    try {
        const response = await apiCall('/admin/students', {
            method: 'POST',
            body: JSON.stringify(studentData)
        });

        if (response.ok) {
            alert('Student added successfully');
            hideAddStudentForm();
            loadStudents();
            // Clear form
            document.getElementById('studentRollNumber').value = '';
            document.getElementById('studentFullName').value = '';
            document.getElementById('studentEmail').value = '';
            document.getElementById('studentPhone').value = '';
            document.getElementById('studentDepartment').value = '';
            document.getElementById('studentSemester').value = '';
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error adding student: ' + error.message);
    }
}

async function assignStudent() {
    const faculty_id = document.getElementById('assignFacultySelect').value;
    const student_id = document.getElementById('assignStudentSelect').value;
    const subject = document.getElementById('assignSubject').value;

    try {
        const response = await apiCall('/admin/assign-student', {
            method: 'POST',
            body: JSON.stringify({ faculty_id, student_id, subject })
        });

        if (response.ok) {
            alert('Student assigned successfully');
            document.getElementById('assignSubject').value = '';
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error assigning student: ' + error.message);
    }
}

// Faculty functions
async function loadFacultyData() {
    await loadAssignedStudents();
    await loadMarks();
    await loadMarksStudents();
}

async function loadAssignedStudents() {
    try {
        const response = await apiCall('/faculty/students');
        const students = await response.json();
        
        const tbody = document.querySelector('#assignedStudentsTable tbody');
        tbody.innerHTML = students.map(s => `
            <tr>
                <td>${s.roll_number}</td>
                <td>${s.student_name}</td>
                <td>${s.department}</td>
                <td>${s.semester}</td>
                <td>${s.subject}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading assigned students:', error);
    }
}

async function loadMarks() {
    try {
        const response = await apiCall('/faculty/marks');
        const marks = await response.json();
        
        const tbody = document.querySelector('#marksTable tbody');
        tbody.innerHTML = marks.map(m => `
            <tr>
                <td>${m.roll_number}</td>
                <td>${m.student_name}</td>
                <td>${m.subject}</td>
                <td>${m.theory_marks}</td>
                <td>${m.internal_marks}</td>
                <td>${m.lab_marks}</td>
                <td>${m.assignment_marks}</td>
                <td>${m.total_marks}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading marks:', error);
    }
}

async function loadMarksStudents() {
    try {
        const response = await apiCall('/faculty/students');
        const students = await response.json();
        
        const select = document.getElementById('marksStudentSelect');
        select.innerHTML = students.map(s => 
            `<option value="${s.student_id}">${s.roll_number} - ${s.student_name} (${s.subject})</option>`
        ).join('');
    } catch (error) {
        console.error('Error loading marks students:', error);
    }
}

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
        const response = await apiCall('/faculty/marks', {
            method: 'POST',
            body: JSON.stringify({
                student_id,
                subject,
                theory_marks,
                internal_marks,
                lab_marks,
                assignment_marks,
                semester,
                academic_year
            })
        });

        if (response.ok) {
            alert('Marks updated successfully');
            loadMarks();
            // Clear form
            document.getElementById('theoryMarks').value = '';
            document.getElementById('internalMarks').value = '';
            document.getElementById('labMarks').value = '';
            document.getElementById('assignmentMarks').value = '';
            document.getElementById('semester').value = '';
        } else {
            const error = await response.json();
            alert('Error: ' + error.error);
        }
    } catch (error) {
        alert('Error updating marks: ' + error.message);
    }
}

async function downloadExcelReport() {
    try {
        const response = await fetch(`${API_BASE}/faculty/report/excel`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `marks_report_${currentUser.id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Error downloading report');
        }
    } catch (error) {
        alert('Error downloading report: ' + error.message);
    }
}

// Initialize app
checkAuth();