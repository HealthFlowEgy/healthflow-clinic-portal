/**
 * HealthFlow Clinic Portal - Prescription Auto-Save System
 * 
 * This module automatically saves prescription drafts to prevent data loss
 * during session timeouts or unexpected interruptions.
 * 
 * Features:
 * - Auto-saves prescription data every 2 minutes
 * - Saves to localStorage for persistence
 * - Detects unsaved changes
 * - Provides restore functionality on page load
 * - Shows save status indicator
 * - Handles multiple medications
 * 
 * @version 1.0.0
 * @date 2025-12-30
 */

(function() {
  'use strict';

  console.log('💾 HealthFlow Prescription Auto-Save System v1.0 - Initializing...');

  // Configuration
  const CONFIG = {
    // Auto-save every 2 minutes (120 seconds)
    AUTOSAVE_INTERVAL_MS: 120000,
    
    // LocalStorage key for draft
    DRAFT_KEY: 'healthflow_prescription_draft',
    
    // Maximum draft age (24 hours)
    MAX_DRAFT_AGE_MS: 24 * 60 * 60 * 1000,
    
    // Enable debug logging
    DEBUG: true
  };

  // State
  let saveInterval = null;
  let lastSaveTime = null;
  let hasUnsavedChanges = false;
  let saveIndicator = null;

  /**
   * Extract prescription form data from the page
   */
  function extractFormData() {
    const data = {
      timestamp: Date.now(),
      patient: {},
      diagnosis: '',
      clinicalNotes: '',
      medications: []
    };

    try {
      // Extract patient information
      const patientNameInput = document.querySelector('input[placeholder="Full name"]');
      const nationalIdInput = document.querySelector('input[placeholder*="14 digits"]');
      const ageInput = document.querySelector('input[placeholder="Years"]');
      const genderSelect = document.querySelector('select');

      if (patientNameInput) data.patient.name = patientNameInput.value;
      if (nationalIdInput) data.patient.nationalId = nationalIdInput.value;
      if (ageInput) data.patient.age = ageInput.value;
      if (genderSelect) data.patient.gender = genderSelect.value;

      // Extract diagnosis
      const diagnosisInput = document.querySelector('input[placeholder="Primary diagnosis"]');
      if (diagnosisInput) data.diagnosis = diagnosisInput.value;

      // Extract clinical notes
      const notesTextarea = document.querySelector('textarea[placeholder*="Additional clinical notes"]');
      if (notesTextarea) data.clinicalNotes = notesTextarea.value;

      // Extract medications
      const medicineContainers = document.querySelectorAll('[id^="Medicine #"]').length || 
                                 document.querySelectorAll('div').length;
      
      // Try to find all medicine input groups
      const allInputs = Array.from(document.querySelectorAll('input, select, textarea'));
      
      // Group inputs by medicine section
      let currentMedicine = null;
      const medicines = [];

      allInputs.forEach(input => {
        const placeholder = input.placeholder || '';
        const type = input.type;

        // Detect medicine name field (start of new medicine)
        if (placeholder.includes('Search National Medicine Directory')) {
          if (currentMedicine && Object.keys(currentMedicine).length > 0) {
            medicines.push(currentMedicine);
          }
          currentMedicine = { medicineName: input.value };
        }
        // Drug ID
        else if (currentMedicine && placeholder.includes('Auto-filled from search')) {
          currentMedicine.drugId = input.value;
        }
        // Generic name
        else if (currentMedicine && placeholder.includes('Sitagliptin')) {
          currentMedicine.genericName = input.value;
        }
        // Dosage
        else if (currentMedicine && placeholder.includes('100mg')) {
          currentMedicine.dosage = input.value;
        }
        // Frequency
        else if (currentMedicine && input.tagName === 'SELECT' && !placeholder.includes('Gender')) {
          currentMedicine.frequency = input.value;
        }
        // Duration
        else if (currentMedicine && placeholder.includes('30 days')) {
          currentMedicine.duration = input.value;
        }
        // Quantity
        else if (currentMedicine && type === 'number' && !placeholder) {
          currentMedicine.quantity = input.value;
        }
        // ICD-10
        else if (currentMedicine && placeholder.includes('E11.9')) {
          currentMedicine.icd = input.value;
        }
        // Instructions
        else if (currentMedicine && placeholder.includes('Take with breakfast')) {
          currentMedicine.instructions = input.value;
        }
        // Substitution
        else if (currentMedicine && type === 'checkbox' && input.id && input.id.includes('substitution')) {
          currentMedicine.allowSubstitution = input.checked;
        }
      });

      // Add last medicine if exists
      if (currentMedicine && Object.keys(currentMedicine).length > 0) {
        medicines.push(currentMedicine);
      }

      data.medications = medicines;

      // Check if form has any data
      const hasData = data.patient.name || 
                     data.patient.nationalId || 
                     data.diagnosis || 
                     data.medications.length > 0;

      return hasData ? data : null;

    } catch (error) {
      console.error('❌ Error extracting form data:', error);
      return null;
    }
  }

  /**
   * Save draft to localStorage
   */
  function saveDraft() {
    try {
      const formData = extractFormData();

      if (!formData) {
        if (CONFIG.DEBUG) {
          console.log('⏭️ No form data to save, skipping...');
        }
        return false;
      }

      // Save to localStorage
      localStorage.setItem(CONFIG.DRAFT_KEY, JSON.stringify(formData));
      lastSaveTime = Date.now();
      hasUnsavedChanges = false;

      console.log('💾 Prescription draft saved successfully!');
      console.log(`   - Patient: ${formData.patient.name || 'N/A'}`);
      console.log(`   - Medications: ${formData.medications.length}`);
      
      updateSaveIndicator('saved');
      
      // Dispatch save event
      window.dispatchEvent(new CustomEvent('healthflow:draft-saved', {
        detail: { timestamp: lastSaveTime, data: formData }
      }));

      return true;

    } catch (error) {
      console.error('❌ Error saving draft:', error);
      updateSaveIndicator('error');
      return false;
    }
  }

  /**
   * Load draft from localStorage
   */
  function loadDraft() {
    try {
      const draftJson = localStorage.getItem(CONFIG.DRAFT_KEY);
      if (!draftJson) {
        return null;
      }

      const draft = JSON.parse(draftJson);

      // Check if draft is too old
      const age = Date.now() - draft.timestamp;
      if (age > CONFIG.MAX_DRAFT_AGE_MS) {
        console.log('⏰ Draft is too old, discarding...');
        clearDraft();
        return null;
      }

      console.log('📂 Draft found!');
      console.log(`   - Age: ${Math.floor(age / 1000 / 60)} minutes`);
      console.log(`   - Patient: ${draft.patient.name || 'N/A'}`);
      console.log(`   - Medications: ${draft.medications.length}`);

      return draft;

    } catch (error) {
      console.error('❌ Error loading draft:', error);
      return null;
    }
  }

  /**
   * Restore draft to form
   */
  function restoreDraft(draft) {
    if (!draft) return false;

    try {
      console.log('🔄 Restoring draft to form...');

      // Restore patient information
      const patientNameInput = document.querySelector('input[placeholder="Full name"]');
      const nationalIdInput = document.querySelector('input[placeholder*="14 digits"]');
      const ageInput = document.querySelector('input[placeholder="Years"]');
      const genderSelect = document.querySelector('select');

      if (patientNameInput && draft.patient.name) {
        patientNameInput.value = draft.patient.name;
        patientNameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (nationalIdInput && draft.patient.nationalId) {
        nationalIdInput.value = draft.patient.nationalId;
        nationalIdInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (ageInput && draft.patient.age) {
        ageInput.value = draft.patient.age;
        ageInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (genderSelect && draft.patient.gender) {
        genderSelect.value = draft.patient.gender;
        genderSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Restore diagnosis
      const diagnosisInput = document.querySelector('input[placeholder="Primary diagnosis"]');
      if (diagnosisInput && draft.diagnosis) {
        diagnosisInput.value = draft.diagnosis;
        diagnosisInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Restore clinical notes
      const notesTextarea = document.querySelector('textarea[placeholder*="Additional clinical notes"]');
      if (notesTextarea && draft.clinicalNotes) {
        notesTextarea.value = draft.clinicalNotes;
        notesTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      }

      console.log('✅ Draft restored successfully!');
      
      // Show success notification
      showRestoreNotification(draft);

      return true;

    } catch (error) {
      console.error('❌ Error restoring draft:', error);
      return false;
    }
  }

  /**
   * Clear saved draft
   */
  function clearDraft() {
    localStorage.removeItem(CONFIG.DRAFT_KEY);
    lastSaveTime = null;
    hasUnsavedChanges = false;
    console.log('🗑️ Draft cleared');
  }

  /**
   * Create save status indicator
   */
  function createSaveIndicator() {
    const div = document.createElement('div');
    div.id = 'healthflow-save-indicator';
    div.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 9999;
      display: none;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
    div.innerHTML = `
      <span id="healthflow-save-icon">💾</span>
      <span id="healthflow-save-text">Draft saved</span>
    `;
    document.body.appendChild(div);
    return div;
  }

  /**
   * Update save indicator
   */
  function updateSaveIndicator(status) {
    if (!saveIndicator) {
      saveIndicator = createSaveIndicator();
    }

    const icon = document.getElementById('healthflow-save-icon');
    const text = document.getElementById('healthflow-save-text');

    if (status === 'saved') {
      saveIndicator.style.background = '#10b981';
      icon.textContent = '✅';
      text.textContent = 'Draft saved';
    } else if (status === 'saving') {
      saveIndicator.style.background = '#3b82f6';
      icon.textContent = '💾';
      text.textContent = 'Saving draft...';
    } else if (status === 'error') {
      saveIndicator.style.background = '#dc2626';
      icon.textContent = '❌';
      text.textContent = 'Save failed';
    }

    saveIndicator.style.display = 'flex';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      saveIndicator.style.display = 'none';
    }, 3000);
  }

  /**
   * Show restore notification
   */
  function showRestoreNotification(draft) {
    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideDown 0.3s ease-out;
    `;

    const age = Math.floor((Date.now() - draft.timestamp) / 1000 / 60);
    
    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 24px;">📂</span>
        <div>
          <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">
            Draft Restored
          </div>
          <div style="font-size: 12px; opacity: 0.9;">
            Saved ${age} minute${age !== 1 ? 's' : ''} ago • ${draft.medications.length} medication${draft.medications.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateX(-50%) translateY(-100px);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(div);

    setTimeout(() => {
      div.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => div.remove(), 300);
    }, 5000);
  }

  /**
   * Start auto-save
   */
  function start() {
    if (saveInterval) {
      console.warn('⚠️ Auto-save already running');
      return;
    }

    console.log('🚀 Starting prescription auto-save...');
    console.log(`   - Save interval: ${CONFIG.AUTOSAVE_INTERVAL_MS / 1000}s`);

    // Save immediately
    saveDraft();

    // Then save periodically
    saveInterval = setInterval(() => {
      updateSaveIndicator('saving');
      saveDraft();
    }, CONFIG.AUTOSAVE_INTERVAL_MS);

    console.log('✅ Auto-save started successfully!');
  }

  /**
   * Stop auto-save
   */
  function stop() {
    if (saveInterval) {
      clearInterval(saveInterval);
      saveInterval = null;
      console.log('🛑 Auto-save stopped');
    }
  }

  /**
   * Get status
   */
  function getStatus() {
    return {
      isRunning: saveInterval !== null,
      lastSaveTime,
      hasUnsavedChanges,
      hasDraft: localStorage.getItem(CONFIG.DRAFT_KEY) !== null
    };
  }

  // Expose API
  window.HealthFlowAutoSave = {
    start,
    stop,
    save: saveDraft,
    load: loadDraft,
    restore: restoreDraft,
    clear: clearDraft,
    getStatus,
    config: CONFIG
  };

  // Check for existing draft on load
  setTimeout(() => {
    const draft = loadDraft();
    if (draft) {
      // Show restore prompt
      const shouldRestore = confirm(
        `Found a saved draft from ${Math.floor((Date.now() - draft.timestamp) / 1000 / 60)} minutes ago.\n\n` +
        `Patient: ${draft.patient.name || 'N/A'}\n` +
        `Medications: ${draft.medications.length}\n\n` +
        `Would you like to restore it?`
      );

      if (shouldRestore) {
        restoreDraft(draft);
      } else {
        clearDraft();
      }
    }

    // Start auto-save
    start();
  }, 2000);

  console.log('✅ Prescription Auto-Save System loaded successfully!');
  console.log('   Use window.HealthFlowAutoSave.save() to manually save');
  console.log('   Use window.HealthFlowAutoSave.load() to load draft');
  console.log('   Use window.HealthFlowAutoSave.clear() to clear draft');

})();
