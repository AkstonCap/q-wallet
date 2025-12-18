// Inpage Script
// Provides the window.nexus object for dApps (similar to window.ethereum for MetaMask)

(function() {
  'use strict';

  // Guard against multiple injections
  if (window.__NEXUS_WALLET_PROVIDER_INJECTED__) {
    console.log('Nexus Provider already injected, skipping');
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
        console.error('Failed to connect to Nexus wallet:', error);
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
        console.error('Failed to disconnect from Nexus wallet:', error);
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
        console.error('Failed to get all balances:', error);
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
        console.error('Failed to send transaction:', error);
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
        console.error('Failed to send batch transactions:', error);
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
        console.error('Failed to execute batch calls:', error);
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
        console.error('Failed to sign transaction:', error);
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
        console.error('Failed to get balance:', error);
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
        console.error('Failed to get transaction history:', error);
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
      console.log(`Event listener registered for: ${eventName}`);
    }

    removeListener(eventName, callback) {
      // Placeholder for event handling
      console.log(`Event listener removed for: ${eventName}`);
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

  console.log('Nexus Provider injected successfully');
  console.log('Access via window.nexus or window.nexusWallet');
})();
