const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const ExcelJS = require('exceljs');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '12345678',
    database: 'StudentManagementSystem'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Database connected');
});

const JWT_SECRET = 'your_jwt_secret';

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Admin Login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM admin WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const admin = results[0];
        // In real application, use bcrypt.compare for hashed passwords
        if (password === admin.password) {
            const token = jwt.sign(
                { id: admin.admin_id, username: admin.username, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.json({ token, user: { id: admin.admin_id, username: admin.username, role: 'admin' } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// Faculty Login
app.post('/api/faculty/login', async (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM faculty WHERE username = ? AND is_active = TRUE';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const faculty = results[0];
        if (password === faculty.password) {
            const token = jwt.sign(
                { id: faculty.faculty_id, username: faculty.username, role: 'faculty' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.json({ token, user: { id: faculty.faculty_id, username: faculty.username, role: 'faculty' } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// Admin: Get all faculty
app.get('/api/admin/faculty', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const query = `
        SELECT f.*, a.username as created_by_name 
        FROM faculty f 
        LEFT JOIN admin a ON f.created_by = a.admin_id
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Admin: Get single faculty
app.get('/api/admin/faculty/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const facultyId = req.params.id;
    const query = 'SELECT * FROM faculty WHERE faculty_id = ?';
    db.query(query, [facultyId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Faculty not found' });
        res.json(results[0]);
    });
});

// Admin: Update faculty
app.put('/api/admin/faculty/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const facultyId = req.params.id;
    const { username, password, email, full_name, department, subject, is_active } = req.body;
    const query = `
        UPDATE faculty SET username = ?, password = ?, email = ?, full_name = ?, department = ?, subject = ?, is_active = ?
        WHERE faculty_id = ?
    `;
    db.query(query, [username, password, email, full_name, department, subject, is_active ? 1 : 0, facultyId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.affectedRows === 0) return res.status(404).json({ error: 'Faculty not found' });
        res.json({ message: 'Faculty updated successfully' });
    });
});

// Admin: Add new faculty
app.post('/api/admin/faculty', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const { username, password, email, full_name, department, subject } = req.body;
    
    const query = `
        INSERT INTO faculty (username, password, email, full_name, department, subject, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [username, password, email, full_name, department, subject, req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Faculty added successfully', faculty_id: results.insertId });
    });
});

// Admin: Get all students
app.get('/api/admin/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const query = 'SELECT * FROM student';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Admin: Get single student
app.get('/api/admin/students/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const studentId = req.params.id;
    const query = 'SELECT * FROM student WHERE student_id = ?';
    db.query(query, [studentId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Student not found' });
        res.json(results[0]);
    });
});

// Admin: Update student
app.put('/api/admin/students/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const studentId = req.params.id;
    const { roll_number, full_name, email, phone, department, semester, date_of_birth, address, is_active } = req.body;
    const query = `
        UPDATE student SET roll_number = ?, full_name = ?, email = ?, phone = ?, department = ?, semester = ?, date_of_birth = ?, address = ?, is_active = ?
        WHERE student_id = ?
    `;
    db.query(query, [roll_number, full_name, email, phone, department, semester, date_of_birth, address, is_active ? 1 : 0, studentId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.affectedRows === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ message: 'Student updated successfully' });
    });
});

// Admin: Add new student
app.post('/api/admin/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const { roll_number, full_name, email, phone, department, semester, date_of_birth, address } = req.body;
    
    const query = `
        INSERT INTO student (roll_number, full_name, email, phone, department, semester, date_of_birth, address, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(query, [roll_number, full_name, email, phone, department, semester, date_of_birth, address, req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Student added successfully', student_id: results.insertId });
    });
});

// Admin: Assign student to faculty
app.post('/api/admin/assign-student', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const { faculty_id, student_id, subject } = req.body;
    
    const query = 'CALL AssignStudentToFaculty(?, ?, ?, ?)';
    db.query(query, [faculty_id, student_id, subject, req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Student assigned to faculty successfully' });
    });
});

// Admin: Delete faculty
app.delete('/api/admin/faculty/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const facultyId = req.params.id;

    // Delete marks and assignments related to this faculty, then delete faculty in a transaction
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: err.message });

        const deleteMarks = 'DELETE FROM marks WHERE faculty_id = ?';
        db.query(deleteMarks, [facultyId], (err1) => {
            if (err1) return db.rollback(() => res.status(500).json({ error: err1.message }));

            const deleteAssignments = 'DELETE FROM faculty_student_assignment WHERE faculty_id = ?';
            db.query(deleteAssignments, [facultyId], (err2) => {
                if (err2) return db.rollback(() => res.status(500).json({ error: err2.message }));

                const deleteFaculty = 'DELETE FROM faculty WHERE faculty_id = ?';
                db.query(deleteFaculty, [facultyId], (err3, results3) => {
                    if (err3) return db.rollback(() => res.status(500).json({ error: err3.message }));
                    if (results3.affectedRows === 0) return db.rollback(() => res.status(404).json({ error: 'Faculty not found' }));

                    db.commit((errCommit) => {
                        if (errCommit) return db.rollback(() => res.status(500).json({ error: errCommit.message }));
                        res.json({ message: 'Faculty and related assignments/marks deleted successfully' });
                    });
                });
            });
        });
    });
});

// Admin: Delete student
app.delete('/api/admin/students/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const studentId = req.params.id;

    // Delete marks and assignments related to this student, then delete student in a transaction
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ error: err.message });

        const deleteMarks = 'DELETE FROM marks WHERE student_id = ?';
        db.query(deleteMarks, [studentId], (err1) => {
            if (err1) return db.rollback(() => res.status(500).json({ error: err1.message }));

            const deleteAssignments = 'DELETE FROM faculty_student_assignment WHERE student_id = ?';
            db.query(deleteAssignments, [studentId], (err2) => {
                if (err2) return db.rollback(() => res.status(500).json({ error: err2.message }));

                const deleteStudent = 'DELETE FROM student WHERE student_id = ?';
                db.query(deleteStudent, [studentId], (err3, results3) => {
                    if (err3) return db.rollback(() => res.status(500).json({ error: err3.message }));
                    if (results3.affectedRows === 0) return db.rollback(() => res.status(404).json({ error: 'Student not found' }));

                    db.commit((errCommit) => {
                        if (errCommit) return db.rollback(() => res.status(500).json({ error: errCommit.message }));
                        res.json({ message: 'Student and related assignments/marks deleted successfully' });
                    });
                });
            });
        });
    });
});

// Admin: Get and Delete assignments
app.get('/api/admin/assignments', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const query = 'SELECT * FROM faculty_student_assignment';
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.delete('/api/admin/assignments/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied' });

    const assignmentId = req.params.id;
    const query = 'DELETE FROM faculty_student_assignment WHERE assignment_id = ?';
    db.query(query, [assignmentId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.affectedRows === 0) return res.status(404).json({ error: 'Assignment not found' });
        res.json({ message: 'Assignment deleted successfully' });
    });
});

// Faculty: Get assigned students
app.get('/api/faculty/students', authenticateToken, (req, res) => {
    if (req.user.role !== 'faculty') return res.status(403).json({ error: 'Access denied' });

    const query = 'SELECT * FROM faculty_assigned_students WHERE faculty_id = ?';
    db.query(query, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Faculty: Update student marks
app.post('/api/faculty/marks', authenticateToken, (req, res) => {
    if (req.user.role !== 'faculty') return res.status(403).json({ error: 'Access denied' });

    const { student_id, subject, theory_marks, internal_marks, lab_marks, assignment_marks, semester, academic_year } = req.body;
    
    const query = 'CALL UpdateStudentMarks(?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [
        req.user.id, student_id, subject, theory_marks, internal_marks, 
        lab_marks, assignment_marks, semester, academic_year
    ], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Marks updated successfully' });
    });
});

// Faculty: Get marks for assigned students
app.get('/api/faculty/marks', authenticateToken, (req, res) => {
    if (req.user.role !== 'faculty') return res.status(403).json({ error: 'Access denied' });

    // Return detailed marks rows, include primary key mark_id so frontend can delete by id
    const query = `
        SELECT m.mark_id, m.faculty_id, m.student_id, s.roll_number, s.full_name AS student_name,
               m.subject, m.theory_marks, m.internal_marks, m.lab_marks, m.assignment_marks,
               m.total_marks, m.academic_year, m.semester, m.last_updated
        FROM marks m
        JOIN student s ON m.student_id = s.student_id
        JOIN faculty_student_assignment fsa ON m.student_id = fsa.student_id AND m.subject = fsa.subject
        WHERE fsa.faculty_id = ? AND fsa.is_active = TRUE
        ORDER BY s.roll_number, m.subject, m.last_updated DESC
    `;
    db.query(query, [req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Faculty: Generate Excel report
app.get('/api/faculty/report/excel', authenticateToken, async (req, res) => {
    if (req.user.role !== 'faculty') return res.status(403).json({ error: 'Access denied' });

    try {
        const query = `
            SELECT 
                s.roll_number AS 'Roll Number',
                s.full_name AS 'Student Name',
                m.subject AS 'Subject',
                m.theory_marks AS 'Theory Marks',
                m.internal_marks AS 'Internal Marks',
                m.lab_marks AS 'Lab Marks',
                m.assignment_marks AS 'Assignment Marks',
                m.total_marks AS 'Total Marks',
                m.academic_year AS 'Academic Year'
            FROM marks m
            JOIN student s ON m.student_id = s.student_id
            WHERE m.faculty_id = ?
            ORDER BY s.roll_number, m.subject
        `;

        db.query(query, [req.user.id], async (err, results) => {
            if (err) throw err;

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Student Marks Report');

            // Add headers
            if (results.length > 0) {
                worksheet.columns = Object.keys(results[0]).map(key => ({
                    header: key,
                    key: key,
                    width: 15
                }));
            }

            // Add data
            worksheet.addRows(results);

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="marks_report_${req.user.id}.xlsx"`);

            // Write to response
            await workbook.xlsx.write(res);
            res.end();
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Faculty: Delete marks (for a student-subject entry)
app.delete('/api/faculty/marks/:id', authenticateToken, (req, res) => {
    if (req.user.role !== 'faculty') return res.status(403).json({ error: 'Access denied' });

    const markId = req.params.id;

    // Ensure the marks belong to this faculty
    const checkQuery = 'SELECT * FROM marks WHERE mark_id = ? AND faculty_id = ?';
    db.query(checkQuery, [markId, req.user.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Marks not found or access denied' });

        const deleteQuery = 'DELETE FROM marks WHERE mark_id = ?';
        db.query(deleteQuery, [markId], (err2, delRes) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ message: 'Marks deleted successfully' });
        });
    });
});

// (Performance endpoint removed)