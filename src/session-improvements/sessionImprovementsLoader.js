/**
 * HealthFlow Clinic Portal - Session Improvements Loader
 * 
 * This script loads all session improvement modules:
 * 1. Automatic Token Refresh
 * 2. Session Expiration Warnings
 * 3. Prescription Auto-Save
 * 
 * @version 1.0.0
 * @date 2025-12-30
 */

(function() {
  'use strict';

  console.log('🚀 HealthFlow Session Improvements - Loading...');
  console.log('   Version: 1.0.0');
  console.log('   Date: 2025-12-30');
  console.log('');

  // Check if already loaded
  if (window.HealthFlowSessionImprovements) {
    console.warn('⚠️ Session improvements already loaded');
    return;
  }

  // Load token refresh manager
  const tokenRefreshScript = document.createElement('script');
  tokenRefreshScript.src = '/session-improvements/tokenRefreshManager.js';
  tokenRefreshScript.onload = () => {
    console.log('✅ Token Refresh Manager loaded');
  };
  tokenRefreshScript.onerror = () => {
    console.error('❌ Failed to load Token Refresh Manager');
  };
  document.head.appendChild(tokenRefreshScript);

  // Load session warning system
  const sessionWarningScript = document.createElement('script');
  sessionWarningScript.src = '/session-improvements/sessionWarningSystem.js';
  sessionWarningScript.onload = () => {
    console.log('✅ Session Warning System loaded');
  };
  sessionWarningScript.onerror = () => {
    console.error('❌ Failed to load Session Warning System');
  };
  document.head.appendChild(sessionWarningScript);

  // Load prescription auto-save
  const autoSaveScript = document.createElement('script');
  autoSaveScript.src = '/session-improvements/prescriptionAutoSave.js';
  autoSaveScript.onload = () => {
    console.log('✅ Prescription Auto-Save loaded');
  };
  autoSaveScript.onerror = () => {
    console.error('❌ Failed to load Prescription Auto-Save');
  };
  document.head.appendChild(autoSaveScript);

  // Mark as loaded
  window.HealthFlowSessionImprovements = {
    version: '1.0.0',
    loaded: true,
    modules: {
      tokenRefresh: () => window.HealthFlowTokenRefresh,
      sessionWarning: () => window.HealthFlowSessionWarning,
      autoSave: () => window.HealthFlowAutoSave
    },
    getStatus: function() {
      return {
        tokenRefresh: window.HealthFlowTokenRefresh?.getStatus(),
        sessionWarning: window.HealthFlowSessionWarning?.getStatus(),
        autoSave: window.HealthFlowAutoSave?.getStatus()
      };
    }
  };

  console.log('');
  console.log('✅ Session Improvements Loader initialized');
  console.log('   Use window.HealthFlowSessionImprovements.getStatus() to check all modules');

})();
