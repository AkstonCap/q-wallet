// Wallet Service for React Native
// Main wallet logic and state management

import StorageService from './storage';
import NexusAPI from './nexus-api';

class WalletService {
  constructor() {
    this.storage = new StorageService();
    this.api = null;
    this.session = null;
    this.genesis = null;
    this.username = null;
    this.isLocked = true;
  }

  // Initialize wallet service
  async initialize() {
    // Load node URL
    const nodeUrl = await this.storage.getNodeUrl();
    this.api = new NexusAPI(nodeUrl);

    // Check for existing session
    const savedSession = await this.storage.getSession();
    console.log('Initialize: Retrieved saved session:', savedSession);
    if (savedSession) {
      this.session = savedSession.session;
      this.genesis = savedSession.genesis;
      this.username = savedSession.username;
      this.isLocked = savedSession.isLocked || false;
      console.log('Initialize: Session loaded - session:', this.session, 'genesis:', this.genesis);
    } else {
      console.log('Initialize: No saved session found');
    }

    return this.isLoggedIn();
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.session !== null;
  }

  // Get session information
  getSessionInfo() {
    if (!this.isLoggedIn()) {
      return null;
    }
    return {
      session: this.session,
      genesis: this.genesis,
      username: this.username,
      isLocked: this.isLocked
    };
  }

  // Create a new wallet (register profile)
  async createWallet(username, password, pin) {
    try {
      const result = await this.api.createProfile(username, password, pin);
      
      // Mark wallet as initialized
      await this.storage.markWalletInitialized(username, result.genesis);
      
      // Create session
      const sessionResult = await this.api.createSession(username, password, pin);
      
      this.session = sessionResult.session;
      this.genesis = sessionResult.genesis;
      this.username = username;
      this.isLocked = true; // Session starts locked

      // Save session to secure storage
      await this.storage.saveSession({
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: true
      });

      return {
        success: true,
        genesis: this.genesis,
        username: this.username
      };
    } catch (error) {
      console.error('Failed to create wallet:', error);
      throw error;
    }
  }

  // Login to wallet
  async login(username, password, pin) {
    try {
      const result = await this.api.createSession(username, password, pin);
      
      console.log('Login result:', result);
      
      // Handle both direct response and wrapped result
      const sessionData = result.result || result;
      
      this.session = sessionData.session;
      this.genesis = sessionData.genesis;
      this.username = username;
      this.isLocked = false; // Unlocked after login with PIN

      // Save session
      await this.storage.saveSession({
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: false
      });

      return {
        success: true,
        session: this.session,
        genesis: this.genesis
      };
    } catch (error) {
      console.error('Failed to login:', error);
      throw error;
    }
  }

  // Logout (terminate session)
  async logout() {
    try {
      if (this.session) {
        // Terminate session on blockchain
        await this.api.terminateSession(this.session);
      }
    } catch (error) {
      console.error('Error terminating session:', error);
      // Continue with logout even if termination fails
    }

    // Clear local session data
    this.session = null;
    this.genesis = null;
    this.username = null;
    this.isLocked = true;

    // Clear stored session
    await this.storage.clearSession();

    return { success: true };
  }

  // Unlock session with PIN
  async unlock(pin) {
    if (!this.session) {
      throw new Error('No active session');
    }

    try {
      await this.api.unlockSession(pin, this.session);
      this.isLocked = false;

      // Update stored session
      await this.storage.saveSession({
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: false
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to unlock session:', error);
      throw error;
    }
  }

  // Lock session
  async lock(pin) {
    if (!this.session) {
      throw new Error('No active session');
    }

    try {
      await this.api.lockSession(pin, this.session);
      this.isLocked = true;

      // Update stored session
      await this.storage.saveSession({
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: true
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to lock session:', error);
      throw error;
    }
  }

  // Get account information
  async getAccount(name = 'default') {
    if (!this.session) {
      throw new Error('Not logged in');
    }
    return await this.api.getAccount(name, this.session);
  }

  // List all accounts
  async listAccounts() {
    if (!this.session) {
      throw new Error('Not logged in');
    }
    return await this.api.listAccounts(this.session);
  }

  // Get all balances
  async getBalances() {
    if (!this.session) {
      throw new Error('Not logged in');
    }
    return await this.api.getBalances(this.session);
  }

  // Create new account
  async createAccount(name, token = 'NXS', pin) {
    if (!this.session) {
      throw new Error('Not logged in');
    }
    return await this.api.createAccount(name, token, this.session, pin);
  }

  // Send transaction
  async sendTransaction(fromAccount, toAddress, amount, pin, reference = '') {
    if (!this.session) {
      throw new Error('Not logged in');
    }
    return await this.api.debit(fromAccount, amount, toAddress, pin, reference, this.session);
  }

  // Get transactions
  async getTransactions(accountName = 'default', limit = 20) {
    if (!this.session) {
      throw new Error('Not logged in');
    }
    return await this.api.getTransactions(accountName, this.session, limit);
  }

  // Validate recipient address
  async validateRecipient(addressOrName) {
    return await this.api.getAccountByAddress(addressOrName);
  }

  // Get node URL
  async getNodeUrl() {
    return await this.storage.getNodeUrl();
  }

  // Set node URL
  async setNodeUrl(url) {
    await this.storage.saveNodeUrl(url);
    this.api = new NexusAPI(url);
  }

  // Get session status
  async getSessionStatus() {
    if (!this.session) {
      throw new Error('No active session');
    }
    return await this.api.getSessionStatus(this.session);
  }
}

export default WalletService;
