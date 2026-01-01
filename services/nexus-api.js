// Nexus API Service
// Handles all communication with the Nexus blockchain node

class NexusAPI {
  constructor(nodeUrl = 'http://localhost:8080') {
    this.validateAndSetNodeUrl(nodeUrl);
  }

  // Validate and set node URL with HTTPS enforcement
  validateAndSetNodeUrl(url) {
    // Validate URL format
    try {
      const urlObj = new URL(url);
      
      // SECURITY: Enforce HTTPS for remote connections
      if (urlObj.hostname !== 'localhost' && 
          urlObj.hostname !== '127.0.0.1' && 
          !urlObj.hostname.startsWith('192.168.') &&
          !urlObj.hostname.startsWith('10.') &&
          urlObj.protocol === 'http:') {
        throw new Error('HTTPS is required for remote connections. Use https:// instead of http://');
      }
      
      // SECURITY WARNING: Recommend TLS 1.3+ for quantum resistance
      // Note: Browser enforces TLS version, but users should verify their node uses modern TLS
      if (urlObj.protocol === 'https:') {
        console.warn(
          '%c⚠️ QUANTUM SECURITY NOTICE',
          'color: #ff6600; font-weight: bold; font-size: 14px',
          '\n\nFor optimal quantum resistance, ensure your Nexus node uses:\n' +
          '  • TLS 1.3 or higher\n' +
          '  • Modern cipher suites (AES-256-GCM, ChaCha20-Poly1305)\n' +
          '  • Up-to-date certificates\n\n' +
          'While Nexus SigChains provide quantum-resistant transactions,\n' +
          'weak TLS versions may expose data in transit.\n\n' +
          'Contact your node operator to verify TLS configuration.'
        );
      }
      
      this.nodeUrl = url;
    } catch (error) {
      if (error.message.includes('HTTPS is required')) {
        throw error;
      }
      throw new Error('Invalid node URL format');
    }
  }

  // Set node URL (with validation)
  setNodeUrl(url) {
    this.validateAndSetNodeUrl(url);
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
        // Try to get error details from response body
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error.message || JSON.stringify(errorData.error);
          }
          console.error('API Error response:', errorData);
        } catch (e) {
          // If response isn't JSON, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          } catch (e2) {
            // Ignore
          }
        }
        throw new Error(errorMessage);
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
  async terminateSession(session, pin) {
    return this.request('sessions/terminate/local', { session, pin });
  }

  // Unlock session with PIN
  async unlockSession(pin, session) {
    return this.request('sessions/unlock/local', {
      pin,
      session,
      notifications: true,
      transactions: true
    });
  }

  // Lock session
  async lockSession(pin, session) {
    return this.request('sessions/lock/local', {
      pin,
      session,
      notifications: false,
      transactions: false
    });
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
    const response = await this.request('finance/get/account', {
      name,
      session
    });
    // API returns object directly in result property
    return response.result || response;
  }

  // Get account by address or name (for validation)
  async getAccountByAddress(addressOrName) {
    try {
      // First try as address
      try {
        const response = await this.request('register/get/finance:account', {
          address: addressOrName
        });
        return response.result || response;
      } catch (addressError) {
        // If address lookup fails, try as name
        const response = await this.request('register/get/finance:account', {
          name: addressOrName
        });
        return response.result || response;
      }
    } catch (error) {
      // Return null if neither address nor name lookup succeeds
      console.log('Account lookup failed for:', addressOrName);
      return null;
    }
  }

  // List all accounts
  async listAccounts(session) {
    const response = await this.request('finance/list/account', { session });
    // API returns array directly in result property
    return response.result || response;
  }

  // Get balances for all accounts
  async getBalances(session) {
    return this.request('finance/get/balances', { session });
  }

  // Create a new account
  async createAccount(name, token = 'NXS', session, pin) {
    const params = {
      token,
      session,
      pin
    };
    
    // Only include name if provided
    if (name) {
      params.name = name;
    }
    
    return this.request('finance/create/account', params);
  }

  // Send NXS or tokens (debit)
  async debit(accountName, amount, recipientAddress, pin, reference = '', session) {
    console.log(`[API] Debit request: ${amount} from ${accountName} to ${recipientAddress}`);
    const params = {
      pin,
      session,
      from: accountName,
      amount: parseFloat(amount),
      to: recipientAddress
    };
    
    // Only include reference if it's not empty
    if (reference && reference.trim()) {
      params.reference = reference;
    }
    
    console.log('[API] Debit params:', { ...params, pin: '***' });
    const result = await this.request('finance/debit/account', params);
    console.log('[API] Debit result:', result);
    return result;
  }

  // Credit (claim) a debit transaction
  async credit(txid, pin, session) {
    return this.request('finance/credit/account', {
      pin,
      session,
      txid
    });
  }

  // Get transactions for given account with name
  async getTransactions(name = 'default', session, limit = 20, sort = 'timestamp', order = 'desc') {
    const response = await this.request('finance/transactions/account', {
      name,
      session,
      limit,
      sort,
      order
    });
    // API returns array directly in result property
    return response.result || response;
  }

  // ===== LEDGER API =====

  // Get blockchain info
  async getInfo() {
    return this.request('ledger/get/info');
  }

  // ===== SYSTEM API =====

  // Get system info
  async getSystemInfo() {
    return this.request('system/get/info');
  }

  // ===== CONNECTION FEE CHECKING =====

  // Check if user has paid connection fee within time window
  // Returns: { hasPaid: boolean, accountName: string|null, txid: string|null, timestamp: number|null }
  async checkConnectionFeePayment(session, recipientAddress, tokenName, requiredAmount, timeWindowSeconds) {
    try {
      // Get all accounts for this session
      const accountsResponse = await this.listAccounts(session);
      const accounts = accountsResponse.result || [];
      
      if (!accounts || accounts.length === 0) {
        return { hasPaid: false, accountName: null, txid: null, timestamp: null, confirmations: null };
      }
      
      const now = Math.floor(Date.now() / 1000); // Current time in seconds
      const cutoffTime = now - timeWindowSeconds;
      
      // Check each account's transaction history
      for (const account of accounts) {
        const accountName = account.name || account.address;
        
        // Get account info to check token type
        const accountInfo = await this.getAccount(accountName, session);
        const accountResult = accountInfo.result || accountInfo;
        
        // Skip if token doesn't match
        const accountToken = accountResult.token_name || accountResult.token || 'NXS';
        if (accountToken !== tokenName) {
          continue;
        }
        
        try {
          // Get transaction history for this account
          const txResponse = await this.request('finance/transactions/account', {
            session,
            name: accountName,
            limit: 1000
          });
          
          const transactions = txResponse.result || [];
          
          // Look for matching debit transactions
          for (const tx of transactions) {

            // Check timestamp
            const txTimestamp = tx.timestamp || 0;
            if (txTimestamp < cutoffTime) {
              return { hasPaid: false, accountName: null, txid: null, timestamp: null }; // Too old
            }

            for (const contract of tx.contracts || []) {
              // Skip if not a debit
              if (contract.OP !== 'DEBIT') {
                continue;
              }
            
              // Check recipient matches
              const txRecipientAddress = contract.to.address || '';
              const txRecipientName = contract.to.name || '';
              if (txRecipientAddress !== recipientAddress && txRecipientName !== recipientAddress) {
                continue;
              }
            
              // Check amount matches or exceeds required
              const txAmount = parseFloat(contract.amount || 0);
              if (txAmount >= requiredAmount) {
                return {
                  hasPaid: true,
                  accountName: accountName,
                  txid: tx.txid,
                  timestamp: txTimestamp,
                  confirmations: tx.confirmations || 0
                };
              }
            }
          }
        } catch (txError) {
          // Skip this account if we can't get transactions
          console.warn('Could not get transactions for account:', accountName, txError.message);
          continue;
        }
      }
      
      return { hasPaid: false, accountName: null, txid: null, timestamp: null };
    } catch (error) {
      console.error('Error checking connection fee payment:', error);
      throw error;
    }
  }

}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NexusAPI;
}
