// Nexus API Service for React Native
// Handles all communication with the Nexus blockchain node

class NexusAPI {
  constructor(nodeUrl = 'https://api.distordia.com') {
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
  async terminateSession(session) {
    return this.request('sessions/terminate/local', { session });
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

  // ===== TOKENS API =====

  // Get token information
  async getToken(name, session) {
    const response = await this.request('tokens/get/token', {
      name,
      session
    });
    return response.result || response;
  }

  // List all tokens
  async listTokens(session) {
    const response = await this.request('tokens/list/token', { session });
    return response.result || response;
  }
}

export default NexusAPI;
