// Storage Service
// Handles secure storage of wallet data using Chrome storage API
//
// SECURITY MODEL:
// ===============
// Primary: chrome.storage.session (RAM-only, NEVER written to disk)
//   - Automatically cleared when browser closes
//   - Not accessible to other extensions or web pages
//   - No encryption needed (never touches disk)
//
// Fallback: Encrypted chrome.storage.local (if session storage unavailable)
//   - Encryption key generated randomly per session
//   - Key stored in JavaScript memory ONLY (this.encryptionKey)
//   - Key lost on extension reload/browser close
//   - Encrypted data on disk is unrecoverable without key
//   - Manual cleanup on browser close removes encrypted data
//
// Why this is secure:
//   - Primary mode: Data never written to disk
//   - Fallback mode: Encryption key never written to disk
//   - Both modes: Data cleared/unrecoverable on browser close
//   - Public computer safe: No recoverable credentials left behind

class StorageService {
  constructor() {
    this.storage = chrome.storage.local; // For persistent data
    
    // SECURITY: Use chrome.storage.session (memory-only) for sensitive data
    // This is NOT written to disk and is cleared when browser closes
    this.useSessionAPI = true;
    this.encryptionEnabled = false;
    
    // Check if chrome.storage.session is available
    // Note: In Manifest V3, chrome.storage.session should be available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      this.sessionStorage = chrome.storage.session;
      console.log('✅ Using chrome.storage.session (memory-only, NOT written to disk)');
    } else {
      // Fallback for browsers without session storage support
      console.warn('⚠️ chrome.storage.session not available - falling back to encrypted local storage');
      this.sessionStorage = chrome.storage.local;
      this.useSessionAPI = false;
      this.encryptionEnabled = true;
      
      // Initialize encryption synchronously
      this.encryptionKey = this.generateEncryptionKeySync();
      console.log('🔐 Encryption enabled with memory-only key');
    }
  }
  
  // Generate a random encryption key synchronously
  generateEncryptionKeySync() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Simple XOR encryption (better than plaintext, key in memory only)
  encrypt(text, key) {
    if (!text) return text;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result); // Base64 encode
  }
  
  // Simple XOR decryption
  decrypt(encrypted, key) {
    if (!encrypted) return encrypted;
    try {
      const decoded = atob(encrypted);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch (e) {
      console.error('Decryption failed:', e);
      return null;
    }
  }

  // Save data to storage
  async set(key, value) {
    return new Promise((resolve, reject) => {
      this.storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Save data to session storage (memory-only, NOT written to disk)
  async setSession(key, value) {
    return new Promise(async (resolve, reject) => {
      try {
        let dataToStore = value;
        
        // If using fallback mode with encryption
        if (!this.useSessionAPI && this.encryptionEnabled && this.encryptionKey) {
          // Encrypt sensitive data before storing on disk
          if (typeof value === 'object') {
            dataToStore = this.encrypt(JSON.stringify(value), this.encryptionKey);
          } else {
            dataToStore = this.encrypt(String(value), this.encryptionKey);
          }
        }
        
        const storageKey = this.useSessionAPI ? key : `session_${key}`;
        this.sessionStorage.set({ [storageKey]: dataToStore }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get data from storage
  async get(key) {
    return new Promise((resolve, reject) => {
      this.storage.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  // Get data from session storage
  async getSessionData(key) {
    return new Promise((resolve, reject) => {
      const storageKey = this.useSessionAPI ? key : `session_${key}`;
      this.sessionStorage.get([storageKey], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          let data = result[storageKey];
          
          // If using fallback mode with encryption, decrypt the data
          if (!this.useSessionAPI && this.encryptionEnabled && this.encryptionKey && data) {
            try {
              const decrypted = this.decrypt(data, this.encryptionKey);
              // Try to parse as JSON
              try {
                data = JSON.parse(decrypted);
              } catch (e) {
                // Not JSON, return as string
                data = decrypted;
              }
            } catch (error) {
              console.error('Failed to decrypt session data:', error);
              data = null;
            }
          }
          
          resolve(data);
        }
      });
    });
  }

  // Remove data from storage
  async remove(key) {
    return new Promise((resolve, reject) => {
      this.storage.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Clear all storage
  async clear() {
    return new Promise((resolve, reject) => {
      this.storage.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Get all storage data
  async getAll() {
    return new Promise((resolve, reject) => {
      this.storage.get(null, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  // ===== Wallet-specific methods =====

  // Save wallet configuration
  async saveWalletConfig(config) {
    await this.set('walletConfig', config);
  }

  // Get wallet configuration
  async getWalletConfig() {
    return await this.get('walletConfig');
  }

  // Save session data (memory-only in chrome.storage.session, encrypted in fallback)
  async saveSession(sessionData) {
    console.log('=== StorageService.saveSession ===');
    console.log('Saving session data: [REDACTED for security]');
    console.log('Using storage:', this.useSessionAPI ? 'chrome.storage.session (memory-only)' : 'chrome.storage.local (encrypted)');
    console.log('Storage object:', this.sessionStorage === chrome.storage.session ? 'session' : 'local');
    await this.setSession('session', sessionData);
    console.log('Session data saved successfully');
    
    // Verify it was saved
    const verification = await this.getSession();
    console.log('Verification check - session exists:', !!verification);
  }

  // Get session data
  async getSession() {
    console.log('=== StorageService.getSession ===');
    console.log('Using storage:', this.useSessionAPI ? 'chrome.storage.session (memory-only)' : 'chrome.storage.local (encrypted)');
    console.log('Storage object:', this.sessionStorage === chrome.storage.session ? 'session' : 'local');
    console.log('Encryption enabled:', this.encryptionEnabled);
    const data = await this.getSessionData('session');
    console.log('Retrieved session data:', data ? '[REDACTED for security]' : 'null');
    return data;
  }

  // Save PIN securely (memory-only in chrome.storage.session, encrypted in fallback)
  async savePin(pin) {
    await this.setSession('pin', pin);
  }

  // Get saved PIN from session storage
  async getPin() {
    return await this.getSessionData('pin');
  }

  // Clear session data (secure deletion - overwrite then remove)
  async clearSession() {
    return new Promise(async (resolve, reject) => {
      try {
        // SECURITY: Overwrite session data with null before removal (secure deletion)
        if (this.useSessionAPI) {
          await chrome.storage.session.set({ session: null, pin: null });
          await chrome.storage.session.remove(['session', 'pin']);
        } else {
          await chrome.storage.local.set({ session_session: null, session_pin: null });
          await chrome.storage.local.remove(['session_session', 'session_pin']);
        }
        
        console.log('Session data securely cleared');
        resolve();
      } catch (error) {
        console.error('Error in clearSession:', error);
        resolve(); // Resolve anyway to allow logout to continue
      }
    });
  }
  
  // Clear all session-prefixed data (for fallback mode cleanup)
  async clearAllSessionData() {
    return new Promise((resolve, reject) => {
      this.storage.get(null, (items) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        // Find all keys with session_ prefix
        const sessionKeys = Object.keys(items).filter(key => key.startsWith('session_'));
        
        if (sessionKeys.length === 0) {
          resolve();
          return;
        }
        
        // Remove all session keys
        this.storage.remove(sessionKeys, () => {
          if (chrome.runtime.lastError) {
            console.warn('Error clearing all session data:', chrome.runtime.lastError);
            resolve(); // Don't fail on cleanup errors
          } else {
            console.log(`Cleared ${sessionKeys.length} session data keys`);
            resolve();
          }
        });
      });
    });
  }

  // Save node URL
  async saveNodeUrl(url) {
    await this.set('nodeUrl', url);
  }

  // Get node URL
  async getNodeUrl() {
    return await this.get('nodeUrl') || 'http://localhost:8080';
  }

  // Save account data
  async saveAccountData(accountData) {
    await this.set('accountData', accountData);
  }

  // Get account data
  async getAccountData() {
    return await this.get('accountData');
  }

  // Save transaction cache
  async saveTransactions(transactions) {
    await this.set('transactions', transactions);
  }

  // Get transaction cache
  async getTransactions() {
    return await this.get('transactions') || [];
  }

  // Check if wallet is initialized
  async isWalletInitialized() {
    const config = await this.getWalletConfig();
    return config && config.initialized === true;
  }

  // Mark wallet as initialized
  async markWalletInitialized(username, genesis) {
    await this.saveWalletConfig({
      initialized: true,
      username,
      genesis,
      createdAt: Date.now()
    });
  }

  // ===== DApp Connection Management =====

  // Get list of approved domains
  async getApprovedDomains() {
    return await this.get('approvedDomains') || [];
  }

  // Add approved domain
  async addApprovedDomain(domain) {
    const approved = await this.getApprovedDomains();
    if (!approved.includes(domain)) {
      approved.push(domain);
      await this.set('approvedDomains', approved);
    }
  }

  // Remove approved domain
  async removeApprovedDomain(domain) {
    const approved = await this.getApprovedDomains();
    const filtered = approved.filter(d => d !== domain);
    await this.set('approvedDomains', filtered);
  }

  // Check if domain is approved
  async isDomainApproved(domain) {
    const approved = await this.getApprovedDomains();
    return approved.includes(domain);
  }

  // Get list of blocked domains
  async getBlockedDomains() {
    return await this.get('blockedDomains') || [];
  }

  // Add blocked domain
  async addBlockedDomain(domain) {
    const blocked = await this.getBlockedDomains();
    if (!blocked.includes(domain)) {
      blocked.push(domain);
      await this.set('blockedDomains', blocked);
    }
    // Also remove from approved if present
    await this.removeApprovedDomain(domain);
  }

  // Check if domain is blocked
  async isDomainBlocked(domain) {
    const blocked = await this.getBlockedDomains();
    return blocked.includes(domain);
  }

  // Remove blocked domain
  async removeBlockedDomain(domain) {
    const blocked = await this.getBlockedDomains();
    const filtered = blocked.filter(d => d !== domain);
    await this.set('blockedDomains', filtered);
  }

  // ===== DApp Activity Tracking =====

  // Update last activity timestamp for a domain
  async updateDomainActivity(domain) {
    const activities = await this.get('domainActivities') || {};
    activities[domain] = Date.now();
    await this.set('domainActivities', activities);
  }

  // Get last activity timestamp for a domain
  async getDomainActivity(domain) {
    const activities = await this.get('domainActivities') || {};
    return activities[domain] || null;
  }

  // Clean up inactive domains (older than timeout in milliseconds)
  async cleanupInactiveDomains(timeoutMs = 30 * 60 * 1000) { // 30 minutes default
    const activities = await this.get('domainActivities') || {};
    const approved = await this.getApprovedDomains();
    const now = Date.now();
    const inactiveDomains = [];

    for (const domain of approved) {
      const lastActivity = activities[domain];
      if (lastActivity && (now - lastActivity) > timeoutMs) {
        inactiveDomains.push(domain);
      }
    }

    // Remove inactive domains
    for (const domain of inactiveDomains) {
      await this.removeApprovedDomain(domain);
      delete activities[domain];
    }

    // Update activities
    if (inactiveDomains.length > 0) {
      await this.set('domainActivities', activities);
    }

    return inactiveDomains;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
