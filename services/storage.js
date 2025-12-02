// Storage Service
// Handles secure storage of wallet data using Chrome storage API

class StorageService {
  constructor() {
    this.storage = chrome.storage.local; // For all data including session (cleared on browser close via background.js)
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

  // Save data to session storage (in-memory, cleared when extension/browser closes)
  async setSession(key, value) {
    // Use chrome.storage.local with a special prefix to share across contexts
    // Note: We'll manually clear this on browser close via background.js
    return new Promise((resolve, reject) => {
      this.storage.set({ [`session_${key}`]: value }, () => {
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

  // Get data from session storage (in-memory)
  async getSessionData(key) {
    // Retrieve from chrome.storage.local with session prefix
    return new Promise((resolve, reject) => {
      this.storage.get([`session_${key}`], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[`session_${key}`]);
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

  // Clear session data
  async clearSession() {
    return new Promise((resolve, reject) => {
      this.storage.remove(['session_session'], () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
