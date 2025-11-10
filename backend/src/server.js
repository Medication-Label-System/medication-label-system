const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// ✅ FIXED FOR DEPLOYMENT: Dynamic port for hosting platforms
const PORT = process.env.PORT || 5000;

// ✅ FIXED DATABASE PATH: Use absolute path that works in production
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'medications.db');
const db = new sqlite3.Database(dbPath);

// ✅ ENHANCED CORS: Allow both local and production frontends
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-app-name.netlify.app', // You'll update this later
    'https://*.netlify.app'
  ],
  credentials: true
}));

app.use(express.json());

// ✅ HEALTH CHECK - Required by deployment platforms
app.get('/', (req, res) => {
  res.json({ 
    status: 'Backend server is working!',
    message: 'Medication Label System API',
    timestamp: new Date().toISOString()
  });
});

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend server is working!' });
});

// Get all medications
app.get('/api/medications', (req, res) => {
  const sql = `SELECT d.DrugName, 
               COALESCE(i.InstructionText, 'Take as directed') AS Instruction,
               d.InternationalCode
               FROM tblDrugs d 
               LEFT JOIN tblUsageInstructions i ON d.DrugName = i.DrugName 
               ORDER BY d.DrugName`;
  
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ medications: rows });
  });
});

// PATIENT SEARCH
app.get('/api/patients/search', (req, res) => {
  const { patientId, year } = req.query;
  
  if (!patientId || !year) {
    return res.json({
      success: false,
      message: 'Patient ID and Year are required'
    });
  }
  
  const pid = parseInt(patientId);
  const yr = parseInt(year);
  
  if (isNaN(pid) || isNaN(yr)) {
    return res.json({
      success: false,
      message: 'Invalid Patient ID or Year format'
    });
  }
  
  const sql = `SELECT PatientID, Year, PatientName, NationalID 
               FROM patients_correct 
               WHERE PatientID = ? AND Year = ?`;
  
  db.get(sql, [pid, yr], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({
        success: false,
        message: 'Database error: ' + err.message
      });
    }
    
    if (row) {
      res.json({
        success: true,
        patient: row,
        fullId: `${row.PatientID}/${row.Year}`
      });
    } else {
      res.json({
        success: false,
        message: `Patient not found with ID: ${patientId} and Year: ${year}`
      });
    }
  });
});

// ADD TO BASKET
app.post('/api/basket/add', (req, res) => {
  const { drugName, instructionText } = req.body;
  
  if (!drugName) {
    res.status(400).json({ error: 'Drug name is required' });
    return;
  }
  
  const sql = `INSERT INTO tblPrintQueue (DrugName, InstructionText, Selected) 
               VALUES (?, ?, TRUE)`;
  
  db.run(sql, [drugName, instructionText || 'Take as directed'], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ 
      success: true, 
      message: 'Medication added to basket',
      id: this.lastID 
    });
  });
});

// GET BASKET
app.get('/api/basket', (req, res) => {
  const sql = `SELECT TempID, DrugName, InstructionText FROM tblPrintQueue ORDER BY DrugName`;
  
  db.all(sql, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ basket: rows });
  });
});

// REMOVE FROM BASKET
app.delete('/api/basket/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM tblPrintQueue WHERE TempID = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: 'Medication removed from basket' });
  });
});

// CLEAR BASKET
app.delete('/api/basket', (req, res) => {
  db.run('DELETE FROM tblPrintQueue', function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: 'Basket cleared' });
  });
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }
  
  const sql = `SELECT UserID, UserName, Password, FullName, AccessLevel, IsActive 
               FROM tblUsers 
               WHERE UserName = ? AND IsActive = TRUE`;
  
  db.get(sql, [username], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row && row.Password === password) {
      res.json({ 
        success: true, 
        user: {
          id: row.UserID,
          username: row.UserName,
          fullName: row.FullName,
          accessLevel: row.AccessLevel
        }
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
  });
});

// AUDIT
app.post('/api/audit', (req, res) => {
  const { patientId, patientYear, patientName, drugName, instructionText, printedBy } = req.body;
  
  const sql = `INSERT INTO tblPrintedLabelsAudit 
               (PatientID, PatientYear, PatientName, DrugName, InstructionText, PrintedBy) 
               VALUES (?, ?, ?, ?, ?, ?)`;
  
  db.run(sql, [patientId, patientYear, patientName, drugName, instructionText, printedBy], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, auditId: this.lastID });
  });
});

// ✅ ENHANCED ERROR HANDLING
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ✅ START SERVER
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💊 Medication Label System Ready!`);
});