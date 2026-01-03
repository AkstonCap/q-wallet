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
      this.isLocked = savedSession.isLocked !== undefined ? savedSession.isLocked : false;
      
      // Verify lock status against blockchain
      await this.verifyLockStatus();
    }

    return this.isLoggedIn();
  }

  // Verify lock status against blockchain and sync local state
  async verifyLockStatus() {
    try {
      if (!this.session) {
        return;
      }
      
      const response = await this.api.getSessionStatus(this.session);
      
      // Extract result from API response
      const status = response.result || response;
      
      // Check if session is unlocked on-chain
      const isUnlockedOnChain = status.unlocked && 
                                status.unlocked.notifications === true && 
                                status.unlocked.transactions === true;
      
      // Sync local state with blockchain state
      if (isUnlockedOnChain && this.isLocked) {
        this.isLocked = false;
        
        // Update stored session
        await this.storage.saveSession({
          session: this.session,
          genesis: this.genesis,
          username: this.username,
          isLocked: false
        });
      } else if (!isUnlockedOnChain && !this.isLocked) {
        this.isLocked = true;
        
        // Update stored session
        await this.storage.saveSession({
          session: this.session,
          genesis: this.genesis,
          username: this.username,
          isLocked: true
        });
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
      
      // Handle both direct response and wrapped result
      const sessionData = result.result || result;
      
      this.session = sessionData.session;
      this.genesis = sessionData.genesis;
      this.username = username;
      
      // Nexus sessions are created in locked state by default
      // We need to unlock them with the PIN to enable transactions
      try {
        await this.api.unlockSession(pin, this.session);
        this.isLocked = false;
        
        // Save PIN in session storage for session termination on logout/browser close
        await this.storage.savePin(pin);
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
      await this.storage.saveSession(sessionToSave);

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
      if (!this.session) {
        throw new Error('No active session to unlock');
      }
      
      if (!pin) {
        throw new Error('PIN is required to unlock session');
      }
      
      await this.api.unlockSession(pin, this.session);
      
      this.isLocked = false;

      // Save PIN in session storage for session termination on browser close
      await this.storage.savePin(pin);

      // Update session in sessionStorage
      const sessionToSave = {
        session: this.session,
        genesis: this.genesis,
        username: this.username,
        isLocked: false
      };
      await this.storage.saveSession(sessionToSave);

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
  async logout(pin) {
    if (this.session) {
      // Get PIN from parameter or storage
      let pinToUse = pin;
      if (!pinToUse) {
        pinToUse = await this.storage.getPin();
      }
      
      if (!pinToUse) {
        // PIN not available - this can happen if user logged in with old code
        // For now, we'll skip blockchain termination and just clear local state
        console.warn('Logout: PIN not available in storage - session will not be terminated on blockchain');
      } else {
        try {
          // Terminate with PIN for multi-user nodes
          const response = await this.api.request('sessions/terminate/local', {
            pin: pinToUse,
            session: this.session
          });
          
          if (!response.result || !response.result.success) {
            console.warn('Logout: Session termination returned unsuccessful response');
          }
        } catch (error) {
          // SECURITY: Always clear local data, even if blockchain termination fails
          // This is critical for public computers and offline scenarios
          if (!error.message.includes('Session not found')) {
            console.error('Logout: Failed to terminate session on blockchain:', error.message);
          }
          // Do NOT re-throw - continue with local cleanup
        }
      }
    }

    // SECURITY: Always clear session data (including PIN) from local storage
    // This happens regardless of blockchain termination success
    // Local machine security takes priority over remote session cleanup
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
      const response = await this.api.getBalances(this.session);
      
      const balances = response.result || response;
      
      // Find NXS balance entry (ticker === 'NXS')
      const nxsBalance = Array.isArray(balances) 
        ? balances.find(b => b.ticker === 'NXS')
        : (balances.ticker === 'NXS' ? balances : null);
      
      if (!nxsBalance) {
        return 0;
      }
      
      // Sum confirmed + unconfirmed + unclaimed + stake
      const confirmed = nxsBalance.confirmed || 0;
      const unconfirmed = nxsBalance.unconfirmed || 0;
      const unclaimed = nxsBalance.unclaimed || 0;
      const stake = nxsBalance.stake || 0;
      const total = confirmed + unconfirmed + unclaimed + stake;
      
      return total;
    } catch (error) {
      console.error('Failed to get total NXS balance:', error);
      throw error;
    }
  }

  // List all accounts (each token has its own account with unique address)
  async listAccounts() {
    try {
      const accounts = await this.api.listAccounts(this.session);
      return accounts;
    } catch (error) {
      console.error('Failed to list accounts:', error.message);
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
      const tokenTicker = accountInfo.token === '0' ? 'NXS' : (accountInfo.ticker || accountInfo.token || '');
      const isNXS = tokenTicker === 'NXS';
      const isUSDD = tokenTicker === 'USDD';
      
      // Check if sending account has sufficient balance
      if (parsedAmount > accountInfo.balance) {
        throw new Error('Insufficient balance');
      }

      // Calculate fees
      const DISTORDIA_FEE_ADDRESS = '8Csmb3RP227N1NHJDH8QZRjZjobe4udaygp7aNv5VLPWDvLDVD7';
      const DISTORDIA_FEE_ADDRESS_USDD = '8BcBZfUd4i4xcVLmQ6uMT3Lp5usJLN2D7TqBavcyYDEQHiteK1H';
      let distordiaFee = 0;
      let feeInToken = false; // Whether fee is in same token as sending
      const nexusFee = 0.01; // Nexus transaction fee (automatically deducted by blockchain for 2 tx within 10s)
      
      if (isNXS) {
        // NXS: 0.1% of send amount, minimum 0.000001 NXS
        const calculated = parsedAmount * 0.001;
        distordiaFee = Math.max(calculated, 0.000001);
        feeInToken = false; // Fee paid from default NXS account
      } else if (isUSDD) {
        // USDD: 0.1% of send amount (in USDD), minimum 0.0001 USDD
        const calculated = parsedAmount * 0.001;
        distordiaFee = Math.max(calculated, 0.0001);
        feeInToken = true; // Fee paid from same USDD account
      } else {
        // Other tokens: No Distordia fee
        distordiaFee = 0;
      }
      
      // Check balance requirements based on fee structure
      if (feeInToken) {
        // For USDD: need amount + fee in the same account
        const totalNeeded = parsedAmount + distordiaFee;
        if (totalNeeded > accountInfo.balance) {
          throw new Error(`Insufficient balance. Need ${totalNeeded} ${tokenTicker} (amount: ${parsedAmount} + fee: ${distordiaFee}).`);
        }
      } else if (distordiaFee > 0) {
        // For NXS with fee from default account
        const totalFees = distordiaFee + nexusFee;
        const nxsBalance = await this.getBalance('default');
        if (nxsBalance.balance < totalFees) {
          throw new Error(`Insufficient NXS in default account for fees. Need ${totalFees} NXS (Nexus: ${nexusFee} + Service: ${distordiaFee}).`);
        }
      }

      // Send transaction with PIN
      const result = await this.api.debit(
        accountName,
        parsedAmount,
        recipientAddress,
        pin,
        reference,
        this.session
      );

      // Charge Distordia service fee if applicable
      if (distordiaFee > 0) {
        try {
          const feeResult = await this.api.debit(
            feeInToken ? accountName : 'default', // USDD from same account, NXS from default
            distordiaFee,
            isNXS ? DISTORDIA_FEE_ADDRESS : DISTORDIA_FEE_ADDRESS_USDD,
            pin,
            '',
            this.session
          );
        } catch (feeError) {
          console.error('Failed to charge Distordia service fee:', feeError);
          // Main transaction already completed, log fee error but don't fail
        }
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
        const accounts = await this.listAccounts();
        
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
