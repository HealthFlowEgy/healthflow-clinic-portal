/**
 * HealthFlow Token Refresh Manager - Fixed Version
 * Automatically refreshes JWT tokens before expiration
 * Updated to use correct localStorage keys: healthflow_auth_token, healthflow_refresh_token, healthflow_token_expiry
 */
(function() {
  'use strict';
  
  console.log('🔄 Loading HealthFlow Token Refresh Manager (Fixed)...');
  
  // Configuration
  const CONFIG = {
    TOKEN_KEY: 'healthflow_auth_token',           // Fixed: was 'token'
    REFRESH_TOKEN_KEY: 'healthflow_refresh_token', // Fixed: was 'refreshToken'
    EXPIRY_KEY: 'healthflow_token_expiry',         // Fixed: was 'tokenExpiry'
    REFRESH_ENDPOINT: '/api/auth/refresh',
    CHECK_INTERVAL_MS: 60000,                      // Check every 60 seconds
    REFRESH_BEFORE_EXPIRY_SECONDS: 300,            // Refresh 5 minutes before expiry
    DEBUG: true
  };
  
  let checkInterval = null;
  let lastRefreshAttempt = 0;
  
  /**
   * Decode JWT token
   */
  function decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('Failed to decode token:', e);
      return null;
    }
  }
  
  /**
   * Get token information from localStorage
   */
  function getTokenInfo() {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const refreshToken = localStorage.getItem(CONFIG.REFRESH_TOKEN_KEY);
    const expiryStr = localStorage.getItem(CONFIG.EXPIRY_KEY);
    
    if (!token) {
      return { hasToken: false };
    }
    
    // Parse expiry
    let expiryTime;
    if (expiryStr) {
      expiryTime = parseInt(expiryStr);
    } else {
      // Try to decode token to get expiry
      const decoded = decodeToken(token);
      if (decoded && decoded.exp) {
        expiryTime = decoded.exp * 1000;
      }
    }
    
    if (!expiryTime) {
      return { hasToken: true, secondsUntilExpiry: null };
    }
    
    const now = Date.now();
    const secondsUntilExpiry = Math.floor((expiryTime - now) / 1000);
    
    return {
      hasToken: true,
      token: token,
      refreshToken: refreshToken,
      expiryTime: expiryTime,
      secondsUntilExpiry: secondsUntilExpiry,
      isExpired: secondsUntilExpiry <= 0,
      needsRefresh: secondsUntilExpiry <= CONFIG.REFRESH_BEFORE_EXPIRY_SECONDS
    };
  }
  
  /**
   * Refresh the authentication token
   */
  async function refreshToken() {
    const tokenInfo = getTokenInfo();
    
    if (!tokenInfo.hasToken) {
      if (CONFIG.DEBUG) {
        console.log('⏸️ No token to refresh');
      }
      return false;
    }
    
    if (!tokenInfo.refreshToken) {
      console.warn('⚠️ No refresh token available');
      return false;
    }
    
    // Prevent multiple simultaneous refresh attempts
    if (lastRefreshAttempt && (Date.now() - lastRefreshAttempt) < 5000) {
      if (CONFIG.DEBUG) {
        console.log('⏳ Refresh already in progress, skipping...');
      }
      return false;
    }
    
    lastRefreshAttempt = Date.now();
    
    try {
      if (CONFIG.DEBUG) {
        console.log('🔄 Refreshing token... (expires in ' + tokenInfo.secondsUntilExpiry + 's)');
      }
      
      const response = await fetch(CONFIG.REFRESH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refreshToken: tokenInfo.refreshToken
        })
      });
      
      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.token) {
        // Update localStorage with new token
        localStorage.setItem(CONFIG.TOKEN_KEY, data.token);
        
        if (data.refreshToken) {
          localStorage.setItem(CONFIG.REFRESH_TOKEN_KEY, data.refreshToken);
        }
        
        // Decode new token to get expiration
        const decoded = decodeToken(data.token);
        if (decoded && decoded.exp) {
          const expiresAt = decoded.exp * 1000;
          localStorage.setItem(CONFIG.EXPIRY_KEY, expiresAt.toString());
        }
        
        console.log('✅ Token refreshed successfully!');
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('healthflow:token-refreshed', {
          detail: { token: data.token, timestamp: Date.now() }
        }));
        
        return true;
      } else {
        throw new Error('No token in refresh response');
      }
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      
      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('healthflow:token-refresh-failed', {
        detail: { error: error.message, timestamp: Date.now() }
      }));
      
      return false;
    }
  }
  
  /**
   * Check token status and refresh if needed
   */
  async function checkAndRefresh() {
    const tokenInfo = getTokenInfo();
    
    if (!tokenInfo.hasToken) {
      return;
    }
    
    if (tokenInfo.isExpired) {
      console.warn('⚠️ Token has expired!');
      // Attempt refresh anyway, might work with refresh token
      await refreshToken();
      return;
    }
    
    if (tokenInfo.needsRefresh) {
      if (CONFIG.DEBUG) {
        console.log(`⏰ Token expires in ${tokenInfo.secondsUntilExpiry}s, refreshing...`);
      }
      await refreshToken();
    } else {
      if (CONFIG.DEBUG) {
        console.log(`✅ Token valid for ${tokenInfo.secondsUntilExpiry}s`);
      }
    }
  }
  
  /**
   * Start the automatic token refresh monitor
   */
  function start() {
    if (checkInterval) {
      console.warn('⚠️ Token refresh manager already running');
      return;
    }
    
    console.log('🚀 Starting automatic token refresh manager...');
    console.log(`   - Check interval: ${CONFIG.CHECK_INTERVAL_MS / 1000}s`);
    console.log(`   - Refresh before expiry: ${CONFIG.REFRESH_BEFORE_EXPIRY_SECONDS}s`);
    
    // Check immediately
    checkAndRefresh();
    
    // Then check periodically
    checkInterval = setInterval(checkAndRefresh, CONFIG.CHECK_INTERVAL_MS);
    
    console.log('✅ Token refresh manager started successfully!');
  }
  
  /**
   * Stop the automatic token refresh monitor
   */
  function stop() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
      console.log('🛑 Token refresh manager stopped');
    }
  }
  
  /**
   * Manually trigger a token refresh
   */
  async function manualRefresh() {
    console.log('🔄 Manual token refresh triggered');
    return await refreshToken();
  }
  
  /**
   * Get current token status
   */
  function getStatus() {
    const tokenInfo = getTokenInfo();
    return {
      hasToken: tokenInfo.hasToken,
      secondsUntilExpiry: tokenInfo.secondsUntilExpiry,
      isExpired: tokenInfo.isExpired,
      needsRefresh: tokenInfo.needsRefresh,
      isRunning: checkInterval !== null
    };
  }
  
  // Expose API
  window.HealthFlowTokenRefresh = {
    start,
    stop,
    refresh: manualRefresh,
    getStatus,
    config: CONFIG
  };
  
  // Auto-start if token exists
  const tokenInfo = getTokenInfo();
  if (tokenInfo.hasToken) {
    start();
  } else {
    console.log('⏸️ No token found, waiting for login...');
    
    // Watch for login
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      originalSetItem.apply(this, arguments);
      if (key === CONFIG.TOKEN_KEY && !checkInterval) {
        console.log('🔑 Token detected, starting refresh manager...');
        setTimeout(start, 1000);
      }
    };
  }
  
  console.log('✅ Token Refresh Manager (Fixed) loaded successfully!');
  console.log('   Use window.HealthFlowTokenRefresh.getStatus() to check status');
  console.log('   Use window.HealthFlowTokenRefresh.refresh() to manually refresh');
})();
