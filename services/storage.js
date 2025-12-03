// Storage Service
// Handles secure storage of wallet data using Chrome storage API

class StorageService {
  constructor() {
    this.storage = chrome.storage.local; // For persistent data
    // Use chrome.storage.session for session tokens (auto-cleared on browser close)
    // Falls back to chrome.storage.local with manual cleanup if session storage unavailable
    this.sessionStorage = chrome.storage.session || chrome.storage.local;
    this.useSessionAPI = !!chrome.storage.session;
    
    if (this.useSessionAPI) {
      console.log('Using chrome.storage.session for secure session storage');
    } else {
      console.warn('chrome.storage.session unavailable, using chrome.storage.local with manual cleanup');
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

  // Save data to session storage (automatically cleared when browser closes)
  async setSession(key, value) {
    return new Promise((resolve, reject) => {
      const storageKey = this.useSessionAPI ? key : `session_${key}`;
      this.sessionStorage.set({ [storageKey]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
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
          resolve(result[storageKey]);
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

  // Save session data (cleared when browser closes)
  async saveSession(sessionData) {
    await this.setSession('session', sessionData);
  }

  // Get session data
  async getSession() {
    return await this.getSessionData('session');
  }

  // Clear session data (secure deletion - overwrite then remove)
  async clearSession() {
    return new Promise(async (resolve, reject) => {
      try {
        const storageKey = this.useSessionAPI ? 'session' : 'session_session';
        
        // SECURITY: Overwrite session data with null before removal (secure deletion)
        await this.setSession('session', null);
        
        // Remove the key
        this.sessionStorage.remove([storageKey], () => {
          if (chrome.runtime.lastError) {
            console.warn('Error clearing session:', chrome.runtime.lastError);
            // Don't reject - session may already be cleared
            resolve();
          } else {
            console.log('Session data securely cleared');
            resolve();
          }
        });
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
