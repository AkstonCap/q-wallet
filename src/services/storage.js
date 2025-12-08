// Storage Service for React Native
// Handles secure storage of wallet data using AsyncStorage and SecureStore

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

class StorageService {
  constructor() {
    // Use SecureStore for sensitive session data
    // Use AsyncStorage for non-sensitive persistent data
  }

  // Save data to storage
  async set(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to storage:', error);
      throw error;
    }
  }

  // Save sensitive data to secure storage
  async setSecure(key, value) {
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to secure storage:', error);
      throw error;
    }
  }

  // Get data from storage
  async get(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting from storage:', error);
      throw error;
    }
  }

  // Get data from secure storage
  async getSecure(key) {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Error getting from secure storage:', error);
      throw error;
    }
  }

  // Remove data from storage
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  }

  // Remove data from secure storage
  async removeSecure(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing from secure storage:', error);
      throw error;
    }
  }

  // Clear all storage
  async clear() {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // Get all storage data
  async getAll() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);
      const result = {};
      items.forEach(([key, value]) => {
        result[key] = value ? JSON.parse(value) : null;
      });
      return result;
    } catch (error) {
      console.error('Error getting all storage:', error);
      throw error;
    }
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

  // Save session data (stored securely)
  async saveSession(sessionData) {
    await this.setSecure('session', sessionData);
  }

  // Get session data
  async getSession() {
    return await this.getSecure('session');
  }

  // Clear session data (secure deletion)
  async clearSession() {
    try {
      // Overwrite with null first for security
      await this.setSecure('session', null);
      // Then delete
      await this.removeSecure('session');
      console.log('Session data securely cleared');
    } catch (error) {
      console.warn('Error clearing session:', error);
      // Don't throw - allow logout to continue
    }
  }

  // Save node URL
  async saveNodeUrl(url) {
    await this.set('nodeUrl', url);
  }

  // Get node URL
  async getNodeUrl() {
    return (await this.get('nodeUrl')) || 'https://api.distordia.com';
  }

  // Save wallet initialization state
  async markWalletInitialized(username, genesis) {
    await this.set('walletInitialized', {
      username,
      genesis,
      timestamp: Date.now()
    });
  }

  // Check if wallet is initialized
  async isWalletInitialized() {
    const data = await this.get('walletInitialized');
    return data !== null;
  }

  // Get wallet init data
  async getWalletInitData() {
    return await this.get('walletInitialized');
  }

  // Connected dApps management
  async getConnectedDapps() {
    return (await this.get('connectedDapps')) || {};
  }

  async saveConnectedDapps(dapps) {
    await this.set('connectedDapps', dapps);
  }

  async addConnectedDapp(origin, accountAddress) {
    const dapps = await this.getConnectedDapps();
    dapps[origin] = {
      connected: true,
      accountAddress,
      timestamp: Date.now()
    };
    await this.saveConnectedDapps(dapps);
  }

  async removeConnectedDapp(origin) {
    const dapps = await this.getConnectedDapps();
    delete dapps[origin];
    await this.saveConnectedDapps(dapps);
  }

  async isConnectedDapp(origin) {
    const dapps = await this.getConnectedDapps();
    return dapps[origin]?.connected || false;
  }

  async getConnectedDappAccount(origin) {
    const dapps = await this.getConnectedDapps();
    return dapps[origin]?.accountAddress || null;
  }

  // Blocked domains management
  async getBlockedDomains() {
    return (await this.get('blockedDomains')) || [];
  }

  async saveBlockedDomains(domains) {
    await this.set('blockedDomains', domains);
  }

  async addBlockedDomain(domain) {
    const blocked = await this.getBlockedDomains();
    if (!blocked.includes(domain)) {
      blocked.push(domain);
      await this.saveBlockedDomains(blocked);
    }
  }

  async removeBlockedDomain(domain) {
    const blocked = await this.getBlockedDomains();
    const filtered = blocked.filter(d => d !== domain);
    await this.saveBlockedDomains(filtered);
  }

  async isBlockedDomain(domain) {
    const blocked = await this.getBlockedDomains();
    return blocked.includes(domain);
  }

  // Revoke all dApp connections
  async revokeAllConnections() {
    await this.saveConnectedDapps({});
  }
}

export default StorageService;
