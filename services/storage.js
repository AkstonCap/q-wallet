// Storage Service
// Handles secure storage of wallet data using Chrome storage API

class StorageService {
  constructor() {
    this.storage = chrome.storage.local; // For persistent data (settings, node URL)
    this.sessionStorage = chrome.storage.session; // For session data (cleared when browser closes)
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

  // Save data to session storage (cleared when browser closes)
  async setSession(key, value) {
    return new Promise((resolve, reject) => {
      this.sessionStorage.set({ [key]: value }, () => {
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
      this.sessionStorage.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
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
      this.sessionStorage.remove(['session'], () => {
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageService;
}
