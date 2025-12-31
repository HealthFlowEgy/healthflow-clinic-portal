/**
 * HealthFlow Clinic Portal - Session Expiration Warning System
 * 
 * This module displays warning notifications to users before their session expires,
 * giving them the opportunity to extend their session or save their work.
 * 
 * Features:
 * - Shows warning 5 minutes before session expiration
 * - Shows critical warning 2 minutes before expiration
 * - Provides "Extend Session" button to refresh token
 * - Visual countdown timer
 * - Auto-dismisses after session is extended
 * 
 * @version 1.0.0
 * @date 2025-12-30
 */

(function() {
  'use strict';

  console.log('⚠️ HealthFlow Session Warning System v1.0 - Initializing...');

  // Configuration
  const CONFIG = {
    TOKEN_KEY: 'healthflow_auth_token',
    
    // Show warning 5 minutes (300 seconds) before expiration
    WARNING_THRESHOLD_SECONDS: 300,
    
    // Show critical warning 2 minutes (120 seconds) before expiration
    CRITICAL_THRESHOLD_SECONDS: 120,
    
    // Check every 10 seconds
    CHECK_INTERVAL_MS: 10000,
    
    // Enable debug logging
    DEBUG: true
  };

  // State
  let checkInterval = null;
  let warningShown = false;
  let criticalWarningShown = false;
  let warningElement = null;
  let countdownInterval = null;

  /**
   * Decode JWT token to extract expiration time
   */
  function decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('❌ Failed to decode token:', error);
      return null;
    }
  }

  /**
   * Get seconds until token expiration
   */
  function getSecondsUntilExpiry() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    if (!token) return null;

    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return null;

    const expiresAt = decoded.exp * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    return Math.floor(timeUntilExpiry / 1000);
  }

  /**
   * Format seconds into MM:SS
   */
  function formatTime(seconds) {
    if (seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Create warning notification element
   */
  function createWarningElement(isCritical) {
    const div = document.createElement('div');
    div.id = 'healthflow-session-warning';
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${isCritical ? '#dc2626' : '#f59e0b'};
      color: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    title.innerHTML = `
      <span style="font-size: 24px;">${isCritical ? '🚨' : '⚠️'}</span>
      <span>${isCritical ? 'Session Expiring Soon!' : 'Session Warning'}</span>
    `;

    const message = document.createElement('div');
    message.style.cssText = `
      font-size: 14px;
      margin-bottom: 15px;
      line-height: 1.5;
    `;
    message.textContent = isCritical 
      ? 'Your session will expire very soon. Please extend your session to avoid losing your work.'
      : 'Your session will expire soon. Click "Extend Session" to continue working.';

    const countdown = document.createElement('div');
    countdown.id = 'healthflow-countdown';
    countdown.style.cssText = `
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      margin: 15px 0;
      font-family: 'Courier New', monospace;
    `;
    countdown.textContent = '00:00';

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 15px;
    `;

    const extendButton = document.createElement('button');
    extendButton.textContent = '🔄 Extend Session';
    extendButton.style.cssText = `
      flex: 1;
      background: white;
      color: ${isCritical ? '#dc2626' : '#f59e0b'};
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.2s;
    `;
    extendButton.onmouseover = () => extendButton.style.transform = 'scale(1.05)';
    extendButton.onmouseout = () => extendButton.style.transform = 'scale(1)';
    extendButton.onclick = async () => {
      extendButton.textContent = '⏳ Extending...';
      extendButton.disabled = true;
      
      // Call token refresh if available
      if (window.HealthFlowTokenRefresh) {
        const success = await window.HealthFlowTokenRefresh.refresh();
        if (success) {
          hideWarning();
          showSuccessNotification();
        } else {
          extendButton.textContent = '❌ Failed - Try Again';
          extendButton.disabled = false;
        }
      } else {
        // Fallback: reload page to re-authenticate
        window.location.reload();
      }
    };

    const dismissButton = document.createElement('button');
    dismissButton.textContent = '✕';
    dismissButton.style.cssText = `
      background: rgba(255, 255, 255, 0.3);
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    `;
    dismissButton.onmouseover = () => dismissButton.style.background = 'rgba(255, 255, 255, 0.5)';
    dismissButton.onmouseout = () => dismissButton.style.background = 'rgba(255, 255, 255, 0.3)';
    dismissButton.onclick = () => hideWarning();

    buttonContainer.appendChild(extendButton);
    buttonContainer.appendChild(dismissButton);

    div.appendChild(title);
    div.appendChild(message);
    div.appendChild(countdown);
    div.appendChild(buttonContainer);

    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    return div;
  }

  /**
   * Update countdown timer
   */
  function updateCountdown() {
    const seconds = getSecondsUntilExpiry();
    const countdownEl = document.getElementById('healthflow-countdown');
    
    if (countdownEl && seconds !== null) {
      countdownEl.textContent = formatTime(seconds);
      
      // Change color based on time remaining
      if (seconds <= 60) {
        countdownEl.style.color = '#fee2e2';
        countdownEl.style.animation = 'pulse 1s infinite';
      } else if (seconds <= 120) {
        countdownEl.style.color = '#fef3c7';
      }
    }
  }

  /**
   * Show warning notification
   */
  function showWarning(isCritical) {
    if (warningElement) {
      // Update existing warning to critical if needed
      if (isCritical && !criticalWarningShown) {
        hideWarning();
      } else {
        return;
      }
    }

    warningElement = createWarningElement(isCritical);
    document.body.appendChild(warningElement);

    if (isCritical) {
      criticalWarningShown = true;
    } else {
      warningShown = true;
    }

    // Start countdown
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);

    console.log(`⚠️ Session warning displayed (${isCritical ? 'CRITICAL' : 'WARNING'})`);
  }

  /**
   * Hide warning notification
   */
  function hideWarning() {
    if (warningElement) {
      warningElement.remove();
      warningElement = null;
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    warningShown = false;
    criticalWarningShown = false;
  }

  /**
   * Show success notification
   */
  function showSuccessNotification() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;
    div.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 24px;">✅</span>
        <span style="font-size: 16px; font-weight: bold;">Session Extended Successfully!</span>
      </div>
    `;

    document.body.appendChild(div);

    setTimeout(() => {
      div.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => div.remove(), 300);
    }, 3000);
  }

  /**
   * Check session status and show warnings if needed
   */
  function checkSessionStatus() {
    const seconds = getSecondsUntilExpiry();

    if (seconds === null) {
      // No token, hide any warnings
      hideWarning();
      return;
    }

    if (CONFIG.DEBUG) {
      console.log(`⏰ Session expires in ${seconds}s (${formatTime(seconds)})`);
    }

    // Show critical warning
    if (seconds <= CONFIG.CRITICAL_THRESHOLD_SECONDS && !criticalWarningShown) {
      showWarning(true);
    }
    // Show regular warning
    else if (seconds <= CONFIG.WARNING_THRESHOLD_SECONDS && !warningShown) {
      showWarning(false);
    }
    // Hide warning if session was extended
    else if (seconds > CONFIG.WARNING_THRESHOLD_SECONDS && (warningShown || criticalWarningShown)) {
      hideWarning();
    }
  }

  /**
   * Start the session warning monitor
   */
  function start() {
    if (checkInterval) {
      console.warn('⚠️ Session warning system already running');
      return;
    }

    console.log('🚀 Starting session warning system...');
    console.log(`   - Warning threshold: ${CONFIG.WARNING_THRESHOLD_SECONDS}s (${formatTime(CONFIG.WARNING_THRESHOLD_SECONDS)})`);
    console.log(`   - Critical threshold: ${CONFIG.CRITICAL_THRESHOLD_SECONDS}s (${formatTime(CONFIG.CRITICAL_THRESHOLD_SECONDS)})`);

    // Check immediately
    checkSessionStatus();

    // Then check periodically
    checkInterval = setInterval(checkSessionStatus, CONFIG.CHECK_INTERVAL_MS);

    console.log('✅ Session warning system started successfully!');
  }

  /**
   * Stop the session warning monitor
   */
  function stop() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    hideWarning();
    console.log('🛑 Session warning system stopped');
  }

  /**
   * Get current status
   */
  function getStatus() {
    const seconds = getSecondsUntilExpiry();
    return {
      secondsUntilExpiry: seconds,
      warningShown,
      criticalWarningShown,
      isRunning: checkInterval !== null
    };
  }

  // Expose API
  window.HealthFlowSessionWarning = {
    start,
    stop,
    getStatus,
    config: CONFIG
  };

  // Auto-start if token exists
  const seconds = getSecondsUntilExpiry();
  if (seconds !== null) {
    start();
  } else {
    console.log('⏸️ No token found, waiting for login...');
    
    // Watch for login
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      if (key === CONFIG.TOKEN_KEY && !checkInterval) {
        console.log('🔑 Token detected, starting session warning system...');
        setTimeout(start, 1000);
      }
    };
  }

  // Listen for token refresh events
  window.addEventListener('healthflow:token-refreshed', () => {
    console.log('✅ Token refreshed, resetting warnings');
    hideWarning();
  });

  console.log('✅ Session Warning System loaded successfully!');
  console.log('   Use window.HealthFlowSessionWarning.getStatus() to check status');

})();
