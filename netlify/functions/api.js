const express = require('express');
const serverless = require('serverless-http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();

// Database setup - path adjusted for Netlify
const dbPath = path.join(__dirname, '../../backend/medications.db');
const db = new sqlite3.Database(dbPath);

app.use(cors());
app.use(express.json());

// Health check
app.get('/.netlify/functions/api/health', (req, res) => {
  res.json({ status: 'Backend server is working!' });
});

// Get all medications
app.get('/.netlify/functions/api/medications', (req, res) => {
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
app.get('/.netlify/functions/api/patients/search', (req, res) => {
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
app.post('/.netlify/functions/api/basket/add', (req, res) => {
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
app.get('/.netlify/functions/api/basket', (req, res) => {
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
app.delete('/.netlify/functions/api/basket/:id', (req, res) => {
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
app.delete('/.netlify/functions/api/basket', (req, res) => {
  db.run('DELETE FROM tblPrintQueue', function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: 'Basket cleared' });
  });
});

// LOGIN
app.post('/.netlify/functions/api/auth/login', (req, res) => {
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
app.post('/.netlify/functions/api/audit', (req, res) => {
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

// Error handling
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export the serverless function
module.exports.handler = serverless(app);