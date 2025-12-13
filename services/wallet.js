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
    console.log('=== WalletService Initialize ===');
    console.log('Retrieved saved session:', savedSession ? 'Yes [REDACTED]' : 'No');
    console.log('Session exists:', !!savedSession);
    
    if (savedSession) {
      this.session = savedSession.session;
      this.genesis = savedSession.genesis;
      this.username = savedSession.username;
      this.isLocked = savedSession.isLocked !== undefined ? savedSession.isLocked : false;
      console.log('Session loaded:');
      console.log('  - session: [REDACTED]');
      console.log('  - genesis: [REDACTED]');
      console.log('  - username:', this.username);
      console.log('  - isLocked:', this.isLocked);
      
      // Verify lock status against blockchain
      await this.verifyLockStatus();
    } else {
      console.log('No saved session found');
    }

    return this.isLoggedIn();
  }

  // Verify lock status against blockchain and sync local state
  async verifyLockStatus() {
    try {
      if (!this.session) {
        return;
      }
      
      console.log('=== Verifying lock status against blockchain ===');
      const response = await this.api.getSessionStatus(this.session);
      
      console.log('Raw session status response:', response);
      
      // Extract result from API response
      const status = response.result || response;
      console.log('Status object:', status);
      console.log('Full unlocked object:', status.unlocked);
      
      // Check if session is unlocked on-chain
      const isUnlockedOnChain = status.unlocked && 
                                status.unlocked.notifications === true && 
                                status.unlocked.transactions === true;
      
      console.log('On-chain status:');
      console.log('  - notifications unlocked:', status.unlocked?.notifications);
      console.log('  - transactions unlocked:', status.unlocked?.transactions);
      console.log('  - isUnlockedOnChain:', isUnlockedOnChain);
      console.log('  - local isLocked:', this.isLocked);
      
      // Sync local state with blockchain state
      if (isUnlockedOnChain && this.isLocked) {
        console.log('Session is unlocked on-chain but locked locally - syncing to unlocked');
        this.isLocked = false;
        
        // Update stored session
        await this.storage.saveSession({
          session: this.session,
          genesis: this.genesis,
          username: this.username,
          isLocked: false
        });
        console.log('Lock status synced: now unlocked');
      } else if (!isUnlockedOnChain && !this.isLocked) {
        console.log('Session is locked on-chain but unlocked locally - syncing to locked');
        this.isLocked = true;
        
        // Update stored session
        await this.storage.saveSession({
          session: this.session,
          genesis: this.genesis,
          username: this.username,
          isLocked: true
        });
        console.log('Lock status synced: now locked');
      } else {
        console.log('Lock status already in sync');
      }
    } catch (error) {
      console.error('Failed to verify lock status:', error);
      // Don't throw - initialization should continue even if verification fails
    }
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
      
      console.log('=== Login successful ===');
      console.log('Session set: [REDACTED]');
      console.log('Genesis set: [REDACTED]');
      console.log('Username set:', this.username);
      
      // Nexus sessions are created in locked state by default
      // We need to unlock them with the PIN to enable transactions
      console.log('=== Unlocking session after login ===');
      try {
        await this.api.unlockSession(pin, this.session);
        this.isLocked = false;
        console.log('Session unlocked successfully');
      } catch (unlockError) {
        console.warn('Could not unlock session immediately:', unlockError.message);
        this.isLocked = true;
      }

      // Save session state
      const sessionToSave = {
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: this.isLocked
      };
      console.log('Saving session to storage: [session data redacted for security]');
      await this.storage.saveSession(sessionToSave);
      console.log('Session saved successfully');

      return {
        success: true,
        genesis: this.genesis,
        username: this.username,
        isLocked: this.isLocked
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
      console.log('Current session: [REDACTED]');
      console.log('Current genesis: [REDACTED]');
      
      if (!this.session) {
        throw new Error('No active session to unlock');
      }
      
      if (!pin) {
        throw new Error('PIN is required to unlock session');
      }
      
      console.log('=== Calling unlockSession API ===');
      await this.api.unlockSession(pin, this.session);
      console.log('API unlockSession successful');
      
      this.isLocked = false;
      console.log('isLocked set to: false');

      // Update session in sessionStorage
      const sessionToSave = {
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: false
      };
      console.log('Updating session in storage: [session data redacted for security]');
      await this.storage.saveSession(sessionToSave);
      console.log('Session updated successfully - wallet is now unlocked');

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

  // Get total NXS balance across all accounts
  async getTotalNXSBalance() {
    try {
      console.log('Getting total NXS balance with session: [REDACTED]');
      const response = await this.api.getBalances(this.session);
      console.log('Balances API response:', response);
      
      const balances = response.result || response;
      console.log('Balances result:', balances);
      
      // Find NXS balance entry (ticker === 'NXS')
      const nxsBalance = Array.isArray(balances) 
        ? balances.find(b => b.ticker === 'NXS')
        : (balances.ticker === 'NXS' ? balances : null);
      
      console.log('NXS balance entry:', nxsBalance);
      
      if (!nxsBalance) {
        console.log('No NXS balance found, returning 0');
        return 0;
      }
      
      // Sum confirmed + unconfirmed + unclaimed + stake
      const confirmed = nxsBalance.confirmed || 0;
      const unconfirmed = nxsBalance.unconfirmed || 0;
      const unclaimed = nxsBalance.unclaimed || 0;
      const stake = nxsBalance.stake || 0;
      const total = confirmed + unconfirmed + unclaimed + stake;
      
      console.log('NXS balance components:');
      console.log('  - confirmed:', confirmed);
      console.log('  - unconfirmed:', unconfirmed);
      console.log('  - unclaimed:', unclaimed);
      console.log('  - stake:', stake);
      console.log('  - total:', total);
      
      return total;
    } catch (error) {
      console.error('Failed to get total NXS balance:', error);
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

  // Get transaction history from all accounts
  async getTransactions(accountName = null, limit = 100) {
    try {
      let allTransactions = [];
      
      // If specific account requested, fetch only for that account
      if (accountName) {
        const transactions = await this.api.getTransactions(accountName, this.session, limit);
        allTransactions = transactions;
      } else {
        // Fetch transactions from all accounts
        console.log('Fetching transactions from all accounts...');
        const accounts = await this.listAccounts();
        console.log('Found accounts:', accounts.length);
        
        // Fetch transactions for each account in parallel
        const transactionPromises = accounts.map(account => 
          this.api.getTransactions(account.name || account.address, this.session, limit)
            .catch(error => {
              console.warn(`Failed to fetch transactions for account ${account.name || account.address}:`, error.message);
              return []; // Return empty array if account has no transactions or error
            })
        );
        
        const transactionArrays = await Promise.all(transactionPromises);
        
        // Merge all transactions
        allTransactions = transactionArrays.flat();
        console.log('Total transactions from all accounts:', allTransactions.length);
        
        // Sort by timestamp (most recent first)
        allTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        // Limit to requested number
        allTransactions = allTransactions.slice(0, limit);
      }
      
      // Cache transactions
      await this.storage.saveTransactions(allTransactions);
      
      return allTransactions;
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
