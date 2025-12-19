// Inpage Script
// Provides the window.nexus object for dApps (similar to window.ethereum for MetaMask)

(function() {
  'use strict';

  // Simple logger for inpage script
  const Logger = {
    DEBUG: true, // Set to false in production
    SENSITIVE_FIELDS: ['pin', 'password', 'session', 'privatekey', 'private_key', 'mnemonic', 'seed', 'genesis', 'username'],
    
    redact(value) {
      if (value === null || value === undefined) return value;
      if (typeof value === 'string' && value.length > 32 && /^[a-f0-9]+$/i.test(value)) return '[REDACTED]';
      if (Array.isArray(value)) return value.map(item => this.redact(item));
      if (typeof value === 'object') {
        const redacted = {};
        for (const [key, val] of Object.entries(value)) {
          redacted[key] = this.SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f)) ? '[REDACTED]' : this.redact(val);
        }
        return redacted;
      }
      return value;
    },
    
    _processArgs(...args) {
      return args.map(arg => this.redact(arg));
    },
    
    debug(...args) {
      if (this.DEBUG) console.debug('[Nexus Provider]', ...this._processArgs(...args));
    },
    info(...args) {
      console.info('[Nexus Provider]', ...this._processArgs(...args));
    },
    error(...args) {
      console.error('[Nexus Provider]', ...this._processArgs(...args));
    }
  };

  // Guard against multiple injections
  if (window.__NEXUS_WALLET_PROVIDER_INJECTED__) {
    Logger.debug('Provider already injected, skipping');
    return;
  }
  window.__NEXUS_WALLET_PROVIDER_INJECTED__ = true;

  // Create Nexus Provider
  class NexusProvider {
    constructor() {
      this.isNexus = true;
      this.isConnected = false;
      this.selectedAddress = null;
      this.chainId = 'nexus-mainnet';
      this._requestId = 0;
      this._callbacks = new Map();
      
      // Setup message listener
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'NEXUS_PROVIDER_RESPONSE') {
          const { id, result, error } = event.data;
          const callback = this._callbacks.get(id);
          
          if (callback) {
            this._callbacks.delete(id);
            if (error) {
              callback.reject(new Error(error));
            } else {
              callback.resolve(result);
            }
          }
        }
      });
    }

    // Send request to background script via content script
    async request({ method, params = {} }) {
      return new Promise((resolve, reject) => {
        const id = ++this._requestId;
        
        this._callbacks.set(id, { resolve, reject });
        
        window.postMessage({
          type: 'NEXUS_PROVIDER_REQUEST',
          id,
          method,
          params
        }, '*');
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this._callbacks.has(id)) {
            this._callbacks.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
      });
    }

    // Connect to wallet (request account access)
    async connect() {
      try {
        const result = await this.request({
          method: 'dapp.requestConnection',
          params: {}
        });
        
        this.isConnected = result.connected;
        if (result.accounts && result.accounts.length > 0) {
          this.selectedAddress = result.accounts[0];
        }
        
        return result.accounts;
      } catch (error) {
        Logger.error('Failed to connect:', error.message);
        throw error;
      }
    }

    // Get connected accounts
    async getAccounts() {
      try {
        const accounts = await this.request({
          method: 'dapp.getAccounts',
          params: {}
        });
        
        if (accounts && accounts.length > 0) {
          this.selectedAddress = accounts[0];
          this.isConnected = true;
        }
        
        return accounts;
      } catch (error) {
        console.error('Failed to get accounts:', error);
        return [];
      }
    }

    // Disconnect from wallet (revoke site's own connection)
    async disconnect() {
      try {
        const result = await this.request({
          method: 'dapp.disconnect',
          params: {}
        });
        
        this.isConnected = false;
        this.selectedAddress = null;
        
        return result;
      } catch (error) {
        Logger.error('Failed to disconnect:', error.message);
        throw error;
      }
    }

    // Get all token balances
    async getAllBalances() {
      try {
        const result = await this.request({
          method: 'dapp.getAllBalances',
          params: {}
        });
        return result;
      } catch (error) {
        Logger.error('Failed to get all balances:', error.message);
        throw error;
      }
    }

    // Send NXS or tokens
    async sendTransaction({ from, to, amount, reference }) {
      try {
        // Build params object with only defined values
        const params = { to, amount };
        
        // Only include from if provided, otherwise backend will use 'default'
        if (from !== undefined && from !== null && from !== '') {
          params.from = from;
        }
        
        // Only include reference if provided and not empty
        if (reference !== undefined && reference !== null && reference !== '') {
          params.reference = reference;
        }
        
        return await this.request({
          method: 'dapp.sendTransaction',
          params
        });
      } catch (error) {
        Logger.error('Failed to send transaction:', error.message);
        throw error;
      }
    }

    // Send multiple transactions with single approval
    async sendBatchTransactions(transactions) {
      try {
        return await this.request({
          method: 'dapp.sendBatchTransactions',
          params: { transactions }
        });
      } catch (error) {
        Logger.error('Failed to send batch transactions:', error.message);
        throw error;
      }
    }

    // Execute batch API calls with single approval
    // Each call: { endpoint: 'market/execute/order', params: {...} }
    async executeBatchCalls(calls) {
      try {
        return await this.request({
          method: 'dapp.executeBatchCalls',
          params: { calls }
        });
      } catch (error) {
        Logger.error('Failed to execute batch calls:', error.message);
        throw error;
      }
    }

    // Sign transaction
    async signTransaction(transaction) {
      try {
        return await this.request({
          method: 'dapp.signTransaction',
          params: { transaction }
        });
      } catch (error) {
        Logger.error('Failed to sign transaction:', error.message);
        throw error;
      }
    }

    // Get balance
    async getBalance(account = 'default') {
      try {
        return await this.request({
          method: 'account.getBalance',
          params: { account }
        });
      } catch (error) {
        Logger.error('Failed to get accounts:', error.message);
        throw error;
      }
    }

    // Get transaction history
    async getTransactionHistory(limit = 50) {
      try {
        return await this.request({
          method: 'transaction.getHistory',
          params: { limit }
        });
      } catch (error) {
        Logger.error('Failed to get transaction history:', error.message);
        throw error;
      }
    }

    // Check if wallet is connected
    async isWalletConnected() {
      try {
        const accounts = await this.getAccounts();
        return accounts.length > 0;
      } catch (error) {
        return false;
      }
    }

    // Event emitter (for future implementation)
    on(eventName, callback) {
      // Placeholder for event handling
      Logger.debug('Event listener registered:', eventName);
    }

    removeListener(eventName, callback) {
      // Placeholder for event handling
      Logger.debug('Event listener removed:', eventName);
    }
  }

  // Inject provider into window
  const nexusProvider = new NexusProvider();
  
  Object.defineProperty(window, 'nexus', {
    value: nexusProvider,
    writable: false,
    configurable: false
  });

  // Also set as window.nexusWallet for clarity
  Object.defineProperty(window, 'nexusWallet', {
    value: nexusProvider,
    writable: false,
    configurable: false
  });

  // Announce provider availability
  window.dispatchEvent(new Event('nexus#initialized'));

  Logger.info('Provider injected successfully');
  Logger.debug('Access via window.nexus or window.nexusWallet');
})();
