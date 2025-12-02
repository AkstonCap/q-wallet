// Wallet Service
// Main wallet logic and state management

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
    if (savedSession) {
      this.session = savedSession.session;
      this.genesis = savedSession.genesis;
      this.username = savedSession.username;
      this.isLocked = savedSession.isLocked || false;
    }

    return this.isLoggedIn();
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.session !== null;
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

      // Save session to sessionStorage (cleared when browser closes)
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
      this.isLocked = true; // Session starts locked
      
      console.log('Session set:', this.session);
      console.log('Genesis set:', this.genesis);

      // Save session to sessionStorage (cleared when browser closes)
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
      console.error('Failed to login:', error);
      throw error;
    }
  }

  // Unlock wallet with PIN
  async unlock(pin) {
    try {
      await this.api.unlockSession(pin, this.session);
      this.isLocked = false;

      // Update session in sessionStorage
      await this.storage.saveSession({
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: false
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to unlock wallet:', error);
      throw error;
    }
  }

  // Lock wallet
  async lock(pin) {
    try {
      if (this.session) {
        await this.api.lockSession(pin, this.session);
      }
      
      this.isLocked = true;

      // Update session in sessionStorage
      await this.storage.saveSession({
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: true
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to lock wallet:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      if (this.session) {
        await this.api.terminateSession(this.session);
      }
    } catch (error) {
      console.error('Failed to terminate session:', error);
    }

    // Clear session data
    this.session = null;
    this.genesis = null;
    this.username = null;
    this.isLocked = true;

    await this.storage.clearSession();
    
    return { success: true };
  }

  // Get account balance
  async getBalance(accountName = 'default') {
    try {
      const account = await this.api.getAccount(accountName, this.session);
      return {
        balance: account.balance || 0,
        address: account.address,
        token: account.token || 'NXS'
      };
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  // Get all balances
  async getAllBalances() {
    try {
      const balances = await this.api.getBalances(this.session);
      return balances;
    } catch (error) {
      console.error('Failed to get all balances:', error);
      throw error;
    }
  }

  // Get account address
  async getAccountAddress(accountName = 'default') {
    try {
      const account = await this.api.getAccount(accountName, this.session);
      return account.address;
    } catch (error) {
      console.error('Failed to get account address:', error);
      throw error;
    }
  }

  // Create a new account
  async createAccount(name, token = 'NXS') {
    try {
      const result = await this.api.createAccount(name, token, this.session);
      return result;
    } catch (error) {
      console.error('Failed to create account:', error);
      throw error;
    }
  }

  // Send transaction
  async send(accountName, amount, recipientAddress, reference = '') {
    try {
      // Validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Invalid amount');
      }

      // Check balance
      const balance = await this.getBalance(accountName);
      if (parsedAmount > balance.balance) {
        throw new Error('Insufficient balance');
      }

      // Send transaction
      const result = await this.api.debit(
        accountName,
        parsedAmount,
        recipientAddress,
        reference,
        this.session
      );

      return result;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    }
  }

  // Get transaction history
  async getTransactions(accountName = 'default', limit = 100) {
    try {
      const transactions = await this.api.getTransactions(accountName, this.session, limit);
      
      // Cache transactions
      await this.storage.saveTransactions(transactions);
      
      return transactions;
    } catch (error) {
      console.error('Failed to get transactions:', error);
      // Return cached transactions if available
      return await this.storage.getTransactions();
    }
  }

  // Get transaction details
  async getTransactionDetails(txid) {
    try {
      return await this.api.getTransaction(txid);
    } catch (error) {
      console.error('Failed to get transaction details:', error);
      throw error;
    }
  }

  // Update node URL
  async updateNodeUrl(url) {
    await this.storage.saveNodeUrl(url);
    this.api.setNodeUrl(url);
  }

  // Get node URL
  async getNodeUrl() {
    return await this.storage.getNodeUrl();
  }

  // Get wallet info
  getWalletInfo() {
    return {
      username: this.username,
      genesis: this.genesis,
      isLoggedIn: this.isLoggedIn(),
      isLocked: this.isLocked
    };
  }

  // Check if wallet is initialized
  async isWalletInitialized() {
    return await this.storage.isWalletInitialized();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WalletService;
}
