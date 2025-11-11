import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Import your logo - adjust the path and file name as needed
import pharmacyLogo from './assets/logo.png';

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://982f1e1a-2983-404d-a359-a517bdb8eff0-00-1tul3hqr1nf9g.picard.replit.dev'
  : 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [medications, setMedications] = useState([]);
  const [basket, setBasket] = useState([]);
  const [patients, setPatients] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [customInstruction, setCustomInstruction] = useState('');
  const [useCustomInstruction, setUseCustomInstruction] = useState(false);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [auditLogs, setAuditLogs] = useState([]);

  // Generate months (01-12) and years (26-50)
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString().padStart(2, '0'),
    label: `${(i + 1).toString().padStart(2, '0')} - ${new Date(2000, i).toLocaleString('en', { month: 'long' })}`
  }));
  
  const years = Array.from({ length: 25 }, (_, i) => ({
    value: (i + 26).toString(),
    label: `20${(i + 26).toString()}`
  }));

  // Load medications on startup
  useEffect(() => {
    loadMedications();
    loadBasket();
    loadLocalAuditLogs();
  }, []);

  // Login function
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, loginData);
      if (response.data.success) {
        setUser(response.data.user);
        alert(`Welcome ${response.data.user.fullName}!`);
      } else {
        alert('Login failed: ' + response.data.message);
      }
    } catch (error) {
      alert('Login error: ' + error.message);
    }
  };

  // Load medications
  const loadMedications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/medications`);
      setMedications(response.data.medications);
      console.log('Loaded medications:', response.data.medications.length);
    } catch (error) {
      console.error('Error loading medications:', error);
    }
  };

  // Load basket
  const loadBasket = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/basket`);
      // Add expiry date field to each basket item with separate month/year
      const basketWithExpiry = response.data.basket.map(item => {
        const expiryDate = item.expiryDate || '';
        const [month, year] = expiryDate.split('/');
        return {
          ...item,
          expiryDate,
          expiryMonth: month || '',
          expiryYear: year || ''
        };
      });
      setBasket(basketWithExpiry);
    } catch (error) {
      console.error('Error loading basket:', error);
    }
  };

  // Search patient by ID/Year
  const searchPatient = async (patientId, year) => {
    if (!patientId || !year) {
      alert('Please enter both Patient ID and Year');
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/patients/search?patientId=${patientId}&year=${year}`);
      if (response.data.success) {
        setPatients({
          ...response.data.patient,
          fullId: response.data.fullId
        });
      } else {
        alert('Patient not found: ' + response.data.message);
        setPatients(null);
      }
    } catch (error) {
      alert('Error searching patient: ' + error.message);
      setPatients(null);
    }
  };

  // FIXED SEARCH FUNCTION - Remove duplicates and create unique keys
  const filterMedications = (medications, searchTerm) => {
    if (!searchTerm.trim()) return medications;
    
    const searchText = searchTerm.trim().toLowerCase();
    
    const filtered = medications.filter(medication => {
      const drugName = (medication.DrugName || '').toLowerCase();
      const instruction = (medication.Instruction || '').toLowerCase();
      
      const nameMatch = drugName.includes(searchText);
      const instructionMatch = instruction.includes(searchText);
      const matches = nameMatch || instructionMatch;
      
      return matches;
    });
    
    return filtered;
  };

  // FUNCTION TO CREATE UNIQUE KEYS - Fixes duplicate key issue
  const createUniqueKey = (medication, index) => {
    // Use combination of DrugName and index to ensure uniqueness
    return `${medication.DrugName}-${index}-${medication.InternationalCode || ''}`;
  };

  // Add medication to basket
  const addToBasket = async (medication) => {
    if (!patients) {
      alert('Please search and select a patient first!');
      return;
    }

    const instructionToUse = useCustomInstruction && customInstruction 
      ? customInstruction 
      : medication.Instruction;

    try {
      await axios.post(`${API_BASE_URL}/api/basket/add`, {
        drugName: medication.DrugName,
        instructionText: instructionToUse
      });
      
      loadBasket();
      
      // Clear custom instruction after adding
      if (useCustomInstruction) {
        setCustomInstruction('');
        setUseCustomInstruction(false);
      }
      
      // Show success message
      const message = useCustomInstruction 
        ? `Added ${medication.DrugName} with custom instruction`
        : `Added ${medication.DrugName} to basket`;
      
      alert(message);
    } catch (error) {
      alert('Error adding to basket: ' + error.message);
    }
  };

  // FIXED: DROPDOWN EXPIRY DATE SELECTOR
  const handleExpiryMonthChange = (tempId, month) => {
    setBasket(prevBasket => 
      prevBasket.map(item => {
        if (item.TempID === tempId) {
          const newExpiryDate = month && item.expiryYear ? `${month}/${item.expiryYear}` : '';
          return {
            ...item,
            expiryMonth: month,
            expiryDate: newExpiryDate
          };
        }
        return item;
      })
    );
  };

  const handleExpiryYearChange = (tempId, year) => {
    setBasket(prevBasket => 
      prevBasket.map(item => {
        if (item.TempID === tempId) {
          const newExpiryDate = item.expiryMonth && year ? `${item.expiryMonth}/${year}` : '';
          return {
            ...item,
            expiryYear: year,
            expiryDate: newExpiryDate
          };
        }
        return item;
      })
    );
  };

  // Remove from basket
  const removeFromBasket = async (tempId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/basket/${tempId}`);
      loadBasket();
    } catch (error) {
      alert('Error removing from basket: ' + error.message);
    }
  };

  // Clear basket
  const clearBasket = async () => {
    if (basket.length === 0) {
      alert('Basket is already empty');
      return;
    }

    if (window.confirm('Are you sure you want to clear all medications from the basket?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/basket`);
        loadBasket();
        alert('Basket cleared successfully');
      } catch (error) {
        alert('Error clearing basket: ' + error.message);
      }
    }
  };

  // Function to convert image to base64 for printing
  const getLogoForPrint = () => {
    return pharmacyLogo;
  };

  // LOCAL STORAGE AUDIT LOGGING - No backend modification needed
  const saveToLocalAudit = async () => {
    try {
      const timestamp = new Date().toISOString();
      const printSessionId = Date.now().toString();
      
      const localAuditEntries = basket.map((item, index) => ({
        id: `${printSessionId}-${index}`,
        timestamp,
        printSessionId,
        patientId: patients.PatientID,
        patientYear: patients.Year,
        patientName: patients.PatientName,
        drugName: item.DrugName,
        instructionText: item.InstructionText,
        printedBy: user.fullName,
        expiryDate: item.expiryDate,
        printQuantity,
        status: 'printed'
      }));

      // Save to localStorage
      const existingLogs = JSON.parse(localStorage.getItem('medicationAuditLogs') || '[]');
      const updatedLogs = [...existingLogs, ...localAuditEntries];
      localStorage.setItem('medicationAuditLogs', JSON.stringify(updatedLogs));
      
      console.log('✅ Saved to local audit:', localAuditEntries.length, 'entries');
      setAuditLogs(updatedLogs);
      
      return localAuditEntries;
    } catch (error) {
      console.error('Error saving to local audit:', error);
      return [];
    }
  };

  // Load local audit logs
  const loadLocalAuditLogs = () => {
    try {
      const logs = JSON.parse(localStorage.getItem('medicationAuditLogs') || '[]');
      setAuditLogs(logs);
      console.log('📊 Loaded local audit logs:', logs.length);
    } catch (error) {
      console.error('Error loading local audit logs:', error);
    }
  };

  // Clear local audit logs
  const clearLocalAuditLogs = () => {
    if (window.confirm('Are you sure you want to clear all local audit logs?')) {
      localStorage.removeItem('medicationAuditLogs');
      setAuditLogs([]);
      alert('Local audit logs cleared successfully');
    }
  };

  // FIXED BACKEND AUDIT - Remove ExpiryDate field to match database schema
  const testBackendAudit = async () => {
    console.log('🔧 Testing backend audit endpoint...');
    
    try {
      // Test with data that matches the database schema (NO ExpiryDate)
      const testData = {
        patientId: 'TEST123',
        patientYear: '2025',
        patientName: 'Test Patient',
        drugName: 'Test Drug',
        instructionText: 'Test Instruction',
        printedBy: user?.fullName || 'Test User'
        // Removed ExpiryDate field to match database schema
      };

      const response = await axios.post(`${API_BASE_URL}/api/audit`, testData, {
        timeout: 3000
      });
      
      console.log('✅ Backend audit test SUCCESS:', response.data);
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('❌ Backend audit test FAILED:', error.response?.data || error.message);
      
      // Detailed error analysis
      if (error.response) {
        console.error('📋 Backend response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('🌐 No response received - network issue');
      } else {
        console.error('⚙️ Request setup error:', error.message);
      }
      
      return { success: false, error: error.message };
    }
  };

  // FIXED AUDIT TRAIL - Remove ExpiryDate from backend requests
  const saveToAuditTrail = async () => {
    console.log('🔄 Starting audit trail process...');
    
    // First try backend
    const backendTest = await testBackendAudit();
    
    if (backendTest.success) {
      console.log('✅ Backend audit available - proceeding with backend save');
      try {
        const auditPromises = basket.map((item, index) => {
          // FIXED: Remove ExpiryDate field to match database schema
          const auditData = {
            patientId: patients.PatientID,
            patientYear: patients.Year,
            patientName: patients.PatientName,
            drugName: item.DrugName,
            instructionText: item.InstructionText,
            printedBy: user.fullName
            // Removed ExpiryDate to fix the database column error
          };

          return axios.post(`${API_BASE_URL}/api/audit`, auditData, {
            timeout: 3000
          }).then(response => {
            console.log(`✅ Backend audit saved for: ${item.DrugName}`);
            return response;
          }).catch(error => {
            console.warn(`❌ Backend save failed for ${item.DrugName}:`, error.message);
            return { success: false, error: error.message };
          });
        });

        const results = await Promise.allSettled(auditPromises);
        
        const successfulSaves = results.filter(result => 
          result.status === 'fulfilled' && 
          result.value && 
          !result.value.success === false
        ).length;
        
        console.log(`✅ Backend audit completed: ${successfulSaves}/${basket.length} successful`);
        
        // Also save to local storage for backup
        await saveToLocalAudit();
        
      } catch (error) {
        console.error('❌ Backend audit failed, using local storage:', error);
        await saveToLocalAudit();
      }
    } else {
      console.log('⚠️ Backend audit unavailable - using local storage');
      await saveToLocalAudit();
    }
  };

  // FIXED PRINT FUNCTION - REMOVES HEADERS/FOOTERS AND ENSURES EXACT LABEL SIZE
  const generatePrintPreview = () => {
    if (!patients || basket.length === 0 || !user) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-GB');
    const logoUrl = getLogoForPrint();
    
    let labelsHTML = '';

    // Generate separate labels for each medication
    basket.forEach(item => {
      for (let i = 0; i < printQuantity; i++) {
        let displayExpiry = item.expiryDate;
        if (item.expiryDate && item.expiryDate.includes('/')) {
          const [month, year] = item.expiryDate.split('/');
          displayExpiry = `${month}/20${year}`;
        }
        
        labelsHTML += `
          <div class="label-container">
            <div class="label-content">
              <!-- Header Section with Logo and ID -->
              <div class="label-header">
                <!-- Logo -->
                <div class="logo-container">
                  <img src="${logoUrl}" alt="Pharmacy Logo" class="logo-image" onerror="this.style.display='none'" />
                </div>
                
                <!-- Patient ID -->
                <div class="patient-id">
                  ID: ${patients.fullId}
                </div>
              </div>
              
              <!-- Patient Name Section -->
              <div class="patient-name">
                <strong>${patients.PatientName}</strong>
              </div>
              
              <!-- Drug Name Section -->
              <div class="drug-name">
                <strong>${item.DrugName}</strong>
              </div>
              
              <!-- MEDICATION INSTRUCTIONS - LARGER AREA -->
              <div class="instructions">
                <span>${item.InstructionText}</span>
              </div>
              
              <!-- Footer Section -->
              <div class="label-footer">
                <!-- First line: Expiry and Doctor -->
                <div class="footer-line">
                  <span>Exp: ${displayExpiry}</span>
                  <span>By: Dr Mahmoud</span>
                </div>
                
                <!-- Second line: Date -->
                <div class="footer-date">
                  <span>${currentDate}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Medication Labels</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* RESET ALL MARGINS AND PADDING */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white;
            font-family: Arial, sans-serif;
            width: 4cm;
            height: 2.5cm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          
          /* LABEL CONTAINER - EXACT SIZE */
          .label-container {
            width: 4cm !important;
            height: 2.5cm !important;
            border: 0.5px solid #000;
            padding: 1mm;
            margin: 0 !important;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: white;
          }
          
          .label-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
          }
          
          /* HEADER SECTION */
          .label-header {
            height: 0.4cm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 0.5mm;
            border-bottom: 0.5px solid #000;
          }
          
          .logo-container {
            flex: 1;
            display: flex;
            align-items: center;
          }
          
          .logo-image {
            max-height: 0.3cm;
            max-width: 70%;
            width: auto;
            object-fit: contain;
          }
          
          .patient-id {
            flex: 1;
            text-align: right;
            font-size: 4pt;
          }
          
          /* PATIENT NAME */
          .patient-name {
            height: 0.25cm;
            text-align: center;
            margin: 0.3mm 0;
            padding: 0.5mm 0;
            line-height: 1;
            overflow: hidden;
            border-bottom: 0.5px solid #000;
            font-size: 5pt;
          }
          
          .patient-name strong {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          /* DRUG NAME */
          .drug-name {
            height: 0.25cm;
            text-align: center;
            margin: 0.1mm 0;
            padding: 0.3mm 0;
            line-height: 1;
            overflow: hidden;
            border-bottom: 0.5px solid #000;
            font-size: 5pt;
          }
          
          .drug-name strong {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          /* INSTRUCTIONS */
          .instructions {
            flex: 1;
            min-height: 0.8cm;
            margin: 0.1mm 0;
            padding: 0.5mm;
            line-height: 1.1;
            overflow: hidden;
            border-bottom: 0.5px solid #000;
            font-size: 5pt;
          }
          
          .instructions span {
            display: block;
            word-wrap: break-word;
            line-height: 1.2;
            height: 100%;
            overflow: hidden;
            text-align: center;
            direction: rtl;
          }
          
          /* FOOTER */
          .label-footer {
            height: 0.3cm;
            font-size: 4pt;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding-top: 0.2mm;
          }
          
          .footer-line {
            display: flex;
            justify-content: space-between;
          }
          
          .footer-date {
            text-align: center;
          }
          
          /* PRINT SETTINGS - CRITICAL FOR EXACT SIZE */
          @media print {
            /* REMOVE ALL BROWSER HEADERS/FOOTERS */
            @page {
              margin: 0 !important;
              padding: 0 !important;
              size: 4cm 2.5cm !important;
            }
            
            body {
              margin: 0 !important;
              padding: 0 !important;
              width: 4cm !important;
              height: 2.5cm !important;
            }
            
            .label-container {
              width: 4cm !important;
              height: 2.5cm !important;
              margin: 0 !important;
              padding: 1mm !important;
              page-break-after: always;
              break-after: page;
            }
            
            /* HIDE EVERYTHING EXCEPT LABELS */
            body * {
              visibility: hidden;
            }
            
            .label-container, .label-container * {
              visibility: visible;
            }
            
            .label-container {
              position: relative;
              left: 0;
              top: 0;
            }
          }
          
          /* PDF SPECIFIC SETTINGS */
          @media print and (color) {
            .label-container {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${labelsHTML}
        <script>
          window.onload = function() {
            // Force print without dialogs
            setTimeout(function() {
              window.print();
              
              // Close window after print
              setTimeout(function() {
                window.close();
              }, 100);
            }, 100);
          }
          
          // Prevent any browser headers
          window.onafterprint = function() {
            window.close();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Print labels
  const printLabels = async () => {
    if (!patients) {
      alert('Please search and select a patient first!');
      return;
    }

    if (basket.length === 0) {
      alert('Basket is empty. Please add medications first.');
      return;
    }

    // Check if all medications have expiry dates
    const medicationsWithoutExpiry = basket.filter(item => !item.expiryDate);
    if (medicationsWithoutExpiry.length > 0) {
      const missingItems = medicationsWithoutExpiry.map(item => item.DrugName).join(', ');
      alert(`Please enter expiry dates for all medications in the basket.\n\nMissing expiry dates for: ${missingItems}`);
      return;
    }

    if (!user) {
      alert('User not logged in');
      return;
    }

    try {
      // Generate print preview first (this is what users see)
      generatePrintPreview();
      
      // Then save to audit trail in the background
      await saveToAuditTrail();
      
      // Clear basket after successful print
      await axios.delete(`${API_BASE_URL}/api/basket`);
      loadBasket();
      
      alert('Labels printed successfully!');
      
    } catch (error) {
      console.error('Print error:', error);
      alert('Print completed, but there was an issue with audit logging. Check console for details.');
    }
  };

  // Quick patient search handler
  const handleQuickPatientSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const patientId = formData.get('patientId');
    const year = formData.get('year');
    searchPatient(patientId, year);
  };

  // Logout
  const handleLogout = () => {
    setUser(null);
    setPatients(null);
    setBasket([]);
    setLoginData({ username: '', password: '' });
  };

  // Get filtered medications based on search
  const filteredMedications = filterMedications(medications, searchTerm);

  // If not logged in, show login form
  if (!user) {
    return (
      <div className="App login-container">
        <div className="login-box">
          <h1>💊 Medication Label System</h1>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Username:</label>
              <input 
                type="text" 
                value={loginData.username}
                onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                required 
              />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input 
                type="password" 
                value={loginData.password}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required 
              />
            </div>
            <button type="submit">Login</button>
          </form>
        </div>
      </div>
    );
  }

  // Main application
  return (
    <div className="App">
      {/* Header */}
      <header className="app-header">
        <h1>💊 Medication Label Printing System</h1>
        <div className="user-info">
          <span>Welcome, <strong>{user.fullName}</strong></span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="main-container">
        {/* Left Panel - Patient Search & Medications */}
        <div className="left-panel">
          {/* Patient Search */}
          <div className="section patient-search">
            <h2>🔍 Patient Search</h2>
            <form onSubmit={handleQuickPatientSearch} className="search-form">
              <div className="input-group">
                <input 
                  type="text" 
                  name="patientId" 
                  placeholder="Patient ID" 
                  required 
                />
                <input 
                  type="text" 
                  name="year" 
                  placeholder="Year" 
                  defaultValue="2025"
                  required 
                />
                <button type="submit">Search Patient</button>
              </div>
            </form>
            
            {patients && (
              <div className="patient-info">
                <h3>✅ Patient Found</h3>
                <p><strong>Name:</strong> {patients.PatientName}</p>
                <p><strong>ID:</strong> {patients.fullId}</p>
                <p><strong>National ID:</strong> {patients.NationalID}</p>
              </div>
            )}
          </div>

          {/* Medications List */}
          <div className="section medications-section">
            <h2>💊 Available Medications ({medications.length})</h2>
            
            {/* Search Box */}
            <input 
              type="text" 
              placeholder="ابحث باسم الدواء..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{textAlign: 'right'}}
            />

            {/* Show search results info */}
            {searchTerm && (
              <div style={{margin: '5px 0', fontSize: '0.9em', color: '#666'}}>
                {filteredMedications.length} medications found for "{searchTerm}"
              </div>
            )}

            {/* Custom Instruction Toggle */}
            <div className="custom-instruction-toggle">
              <label>
                <input 
                  type="checkbox" 
                  checked={useCustomInstruction}
                  onChange={(e) => setUseCustomInstruction(e.target.checked)}
                />
                Use Custom Instruction
              </label>
              {useCustomInstruction && (
                <textarea 
                  placeholder="Enter custom instruction..." 
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  rows="3"
                />
              )}
            </div>

            {/* Medications List - Uses unique keys to avoid duplicates */}
            <div className="medications-list">
              {filteredMedications.length === 0 && searchTerm ? (
                <div style={{textAlign: 'center', padding: '20px', color: '#666'}}>
                  No medications found for "{searchTerm}"
                </div>
              ) : (
                filteredMedications.map((medication, index) => (
                  <div key={createUniqueKey(medication, index)} className="medication-item">
                    <div className="medication-info">
                      <strong>{medication.DrugName}</strong>
                      <p>{medication.Instruction}</p>
                      {medication.InternationalCode && (
                        <small>Barcode: {medication.InternationalCode}</small>
                      )}
                    </div>
                    <button 
                      onClick={() => addToBasket(medication)}
                      disabled={!patients}
                    >
                      Add to Basket
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Basket & Print Controls */}
        <div className="right-panel">
          {/* Basket */}
          <div className="section basket-section">
            <h2>🛒 Medication Basket ({basket.length} items)</h2>
            
            {basket.length === 0 ? (
              <p className="empty-basket">Basket is empty</p>
            ) : (
              <div className="basket-list">
                {basket.map(item => (
                  <div key={item.TempID} className="basket-item">
                    <div className="basket-info">
                      <strong>{item.DrugName}</strong>
                      <p>{item.InstructionText}</p>
                      
                      {/* FIXED: DROPDOWN EXPIRY DATE SELECTOR */}
                      <div className="expiry-input">
                        <label>Expiry Date:</label>
                        <div style={{display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px'}}>
                          <select 
                            value={item.expiryMonth || ''}
                            onChange={(e) => handleExpiryMonthChange(item.TempID, e.target.value)}
                            style={{padding: '5px', minWidth: '100px'}}
                          >
                            <option value="">Select Month</option>
                            {months.map(month => (
                              <option key={month.value} value={month.value}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                          
                          <select 
                            value={item.expiryYear || ''}
                            onChange={(e) => handleExpiryYearChange(item.TempID, e.target.value)}
                            style={{padding: '5px', minWidth: '80px'}}
                          >
                            <option value="">Select Year</option>
                            {years.map(year => (
                              <option key={year.value} value={year.value}>
                                {year.label}
                              </option>
                            ))}
                          </select>
                          
                          {item.expiryDate && (
                            <span style={{fontSize: '0.8em', color: 'green', fontWeight: 'bold'}}>
                              ✓ {item.expiryDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFromBasket(item.TempID)}
                      className="remove-btn"
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Basket Controls */}
            {basket.length > 0 && (
              <div className="basket-controls">
                <div className="form-group">
                  <label>Number of Labels per Medication:</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={printQuantity}
                    onChange={(e) => setPrintQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>
                <button onClick={clearBasket} className="clear-btn">
                  Clear Basket
                </button>
              </div>
            )}
          </div>

          {/* Print Controls */}
          {patients && basket.length > 0 && (
            <div className="section print-section">
              <h2>🖨️ Print Labels</h2>
              
              <div className="print-controls">
                <button onClick={printLabels} className="print-btn">
                  🖨️ Print All Labels
                </button>
                
                <div className="print-summary">
                  <p><strong>Print Summary:</strong></p>
                  <p>Patient: {patients.PatientName}</p>
                  <p>Total Labels: {basket.length * printQuantity}</p>
                  <p>Medications: {basket.length}</p>
                  <p style={{color: basket.some(item => !item.expiryDate) ? 'red' : 'green'}}>
                    Expiry Dates: {basket.filter(item => item.expiryDate).length}/{basket.length} set
                  </p>
                </div>
              </div>

              {/* Audit Logging Controls */}
              <div className="section audit-section" style={{marginTop: '20px', border: '1px solid #ddd', padding: '15px'}}>
                <h3>📊 Audit Logging</h3>
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                  <button 
                    onClick={testBackendAudit}
                    style={{backgroundColor: '#17a2b8'}}
                  >
                    🔧 Test Backend Audit
                  </button>
                  <button 
                    onClick={loadLocalAuditLogs}
                    style={{backgroundColor: '#28a745'}}
                  >
                    📋 View Local Logs ({auditLogs.length})
                  </button>
                  <button 
                    onClick={clearLocalAuditLogs}
                    style={{backgroundColor: '#dc3545'}}
                  >
                    🗑️ Clear Local Logs
                  </button>
                </div>
                
                {/* Local Audit Logs Display */}
                {auditLogs.length > 0 && (
                  <div style={{marginTop: '10px', maxHeight: '200px', overflowY: 'auto'}}>
                    <h4>Recent Local Audit Logs:</h4>
                    {auditLogs.slice(-5).map((log, index) => (
                      <div key={log.id} style={{border: '1px solid #ccc', padding: '5px', margin: '2px', fontSize: '0.8em'}}>
                        <strong>{log.patientName}</strong> - {log.drugName} - {new Date(log.timestamp).toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;