// Nexus API Service
// Handles all communication with the Nexus blockchain node

class NexusAPI {
  constructor(nodeUrl = 'http://localhost:8080') {
    this.nodeUrl = nodeUrl;
  }

  // Set node URL
  setNodeUrl(url) {
    this.nodeUrl = url;
  }

  // Make API request
  async request(endpoint, params = {}) {
    const url = `${this.nodeUrl}/${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }

      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // ===== SESSIONS API =====

  // Create a new session (login)
  async createSession(username, password, pin) {
    return this.request('sessions/create/local', {
      username,
      password,
      pin
    });
  }

  // Terminate session (logout)
  async terminateSession(session) {
    return this.request('sessions/terminate/local', { session });
  }

  // Unlock session with PIN
  async unlockSession(pin, session) {
    return this.request('sessions/unlock/local', {
      pin,
      session
    });
  }

  // Lock session
  async lockSession(session) {
    return this.request('sessions/lock/local', { session });
  }

  // Get session status
  async getSessionStatus(session) {
    return this.request('sessions/status/local', { session });
  }

  // ===== PROFILES API =====

  // Create a new profile (register user)
  async createProfile(username, password, pin) {
    return this.request('profiles/create/master', {
      username,
      password,
      pin
    });
  }

  // Get profile information
  async getProfile(session) {
    return this.request('profiles/get/master', { session });
  }

  // ===== FINANCE API =====

  // Get account balance
  async getAccount(name = 'default', session) {
    return this.request('finance/get/account', {
      name,
      session
    });
  }

  // List all accounts
  async listAccounts(session) {
    return this.request('finance/list/accounts', { session });
  }

  // Get balances for all accounts
  async getBalances(session) {
    return this.request('finance/get/balances', { session });
  }

  // Create a new account
  async createAccount(name, token = 'NXS', session) {
    return this.request('finance/create/account', {
      name,
      token,
      session
    });
  }

  // Send NXS or tokens (debit)
  async debit(accountName, amount, recipientAddress, reference = '', session) {
    return this.request('finance/debit/account', {
      name: accountName,
      amount: parseFloat(amount),
      name_to: recipientAddress,
      reference,
      session
    });
  }

  // Credit (claim) a debit transaction
  async credit(txid, session) {
    return this.request('finance/credit/account', {
      txid,
      session
    });
  }

  // Get transaction history
  async getTransactions(session, limit = 100) {
    return this.request('finance/transactions/account', {
      session,
      limit
    });
  }

  // Get stake info
  async getStakeInfo(session) {
    return this.request('finance/get/stakeinfo', { session });
  }

  // ===== LEDGER API =====

  // Get transaction details
  async getTransaction(txid) {
    return this.request('ledger/get/transaction', { txid });
  }

  // List transactions for a genesis ID
  async listTransactionsByGenesis(genesis, limit = 100) {
    return this.request('ledger/list/transactions', {
      genesis,
      limit
    });
  }

  // Get block information
  async getBlock(hash) {
    return this.request('ledger/get/block', { hash });
  }

  // Get blockchain info
  async getInfo() {
    return this.request('ledger/get/info');
  }

  // ===== SYSTEM API =====

  // Get system info
  async getSystemInfo() {
    return this.request('system/get/info');
  }

  // List peers
  async listPeers() {
    return this.request('system/list/peers');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NexusAPI;
}
