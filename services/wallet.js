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
      console.log('Unlock called with PIN present:', !!pin);
      console.log('Current session:', this.session);
      console.log('Current genesis:', this.genesis);
      
      if (!this.session) {
        throw new Error('No active session to unlock');
      }
      
      if (!pin) {
        throw new Error('PIN is required to unlock session');
      }
      
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

  // List all accounts (each token has its own account with unique address)
  async listAccounts() {
    try {
      console.log('listAccounts: Using session:', this.session);
      const accounts = await this.api.listAccounts(this.session);
      console.log('listAccounts: Got accounts:', accounts);
      return accounts;
    } catch (error) {
      console.error('Failed to list accounts:', error);
      console.error('Session value:', this.session);
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
  async createAccount(name, token = '0', pin) {
    try {
      // Check if default account has sufficient balance for fees
      const nexusFee = 0.01; // Nexus transaction fee (auto-deducted by blockchain)
      const distordiaFee = 0.01; // Distordia service fee
      const totalFees = nexusFee + distordiaFee;
      
      const nxsBalance = await this.getBalance('default');
      if (nxsBalance.balance < totalFees) {
        throw new Error(`Insufficient NXS in default account for fees. Need ${totalFees} NXS (Nexus: ${nexusFee} + Service: ${distordiaFee}).`);
      }
      
      // Create the account first
      const result = await this.api.createAccount(name, token, this.session, pin);
      
      // Charge only Distordia service fee
      // (Nexus fee of 0.01 NXS is automatically deducted by the blockchain)
      const DISTORDIA_FEE_ADDRESS = '8Csmb3RP227N1NHJDH8QZRjZjobe4udaygp7aNv5VLPWDvLDVD7';
      
      try {
        await this.api.debit(
          'default', // Debit from default NXS account
          distordiaFee,
          DISTORDIA_FEE_ADDRESS,
          pin,
          '',
          this.session
        );
        console.log(`Distordia service fee charged: ${distordiaFee} NXS (Nexus tx fee ${nexusFee} NXS auto-deducted by blockchain)`);
      } catch (feeError) {
        console.error('Failed to charge Distordia service fee:', feeError);
        // Don't fail the account creation if fee payment fails
        // but log it for visibility
      }
      
      return result;
    } catch (error) {
      console.error('Failed to create account:', error);
      throw error;
    }
  }

  // Send transaction
  async send(accountName, amount, recipientAddress, pin, reference = '') {
    try {
      // Validate amount
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Invalid amount');
      }

      // Validate PIN
      if (!pin || pin.length < 4) {
        throw new Error('Valid PIN is required');
      }

      // Check balance and determine token type
      const accountInfo = await this.getBalance(accountName);
      const isNXS = accountInfo.token === '0' || accountInfo.token === 'NXS' || !accountInfo.token;
      
      // Check if sending account has sufficient balance
      if (parsedAmount > accountInfo.balance) {
        throw new Error('Insufficient balance');
      }

      // Calculate fees
      const DISTORDIA_FEE_ADDRESS = '8Csmb3RP227N1NHJDH8QZRjZjobe4udaygp7aNv5VLPWDvLDVD7';
      let distordiaFee = 0;
      const nexusFee = 0.01; // Nexus transaction fee (automatically deducted by blockchain for 2 tx within 10s)
      
      if (isNXS) {
        // NXS: 0.1% of send amount, minimum 0.000001 (1e-6) NXS
        const calculated = parsedAmount * 0.001;
        distordiaFee = Math.max(calculated, 0.000001);
        console.log(`Fee calculation for NXS: ${parsedAmount} * 0.001 = ${calculated}, final fee = ${distordiaFee}`);
      } else {
        // Other tokens: 0.01 NXS flat fee
        distordiaFee = 0.01;
        console.log(`Fee calculation for token: flat fee = ${distordiaFee}`);
      }
      
      console.log(`Total fees: ${distordiaFee} (service) + ${nexusFee} (Nexus auto) = ${distordiaFee + nexusFee}`);
      const totalFees = distordiaFee + nexusFee;

      // Check if default NXS account has sufficient balance for Distordia fee + Nexus fee
      const nxsBalance = await this.getBalance('default');
      if (nxsBalance.balance < totalFees) {
        throw new Error(`Insufficient NXS in default account for fees. Need ${totalFees} NXS (Nexus: ${nexusFee} + Service: ${distordiaFee}).`);
      }

      // Send transaction with PIN
      console.log(`Sending main transaction: ${parsedAmount} from ${accountName} to ${recipientAddress}`);
      const result = await this.api.debit(
        accountName,
        parsedAmount,
        recipientAddress,
        pin,
        reference,
        this.session
      );
      console.log('Main transaction successful:', result);

      // Charge only Distordia service fee from default NXS account
      // (Nexus fee of 0.01 NXS is automatically deducted by the blockchain)
      console.log(`Charging Distordia service fee: ${distordiaFee} NXS from default account`);
      try {
        const feeResult = await this.api.debit(
          'default',
          distordiaFee,
          DISTORDIA_FEE_ADDRESS,
          pin,
          '',
          this.session
        );
        console.log(`Distordia service fee charged successfully:`, feeResult);
        console.log(`Total cost: ${parsedAmount} + ${distordiaFee} service fee + ${nexusFee} Nexus fee (auto) = ${parsedAmount + totalFees} NXS`);
      } catch (feeError) {
        console.error('Failed to charge Distordia service fee:', feeError);
        console.error('Fee error details:', feeError.message);
        // Main transaction already completed, log fee error but don't fail
      }

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
