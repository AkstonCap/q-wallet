// Background Service Worker
// Handles background processes, message passing, and dApp connections

// Import services
importScripts('services/nexus-api.js', 'services/storage.js', 'services/wallet.js');

let wallet;

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Nexus Wallet extension installed');
  wallet = new WalletService();
  await wallet.initialize();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Nexus Wallet extension started');
  wallet = new WalletService();
  await wallet.initialize();
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    });
  
  // Return true to indicate async response
  return true;
});

// Message handler
async function handleMessage(request, sender) {
  const { method, params } = request;

  if (!wallet) {
    wallet = new WalletService();
    await wallet.initialize();
  }

  switch (method) {
    // Wallet management
    case 'wallet.isInitialized':
      return { result: await wallet.isWalletInitialized() };
    
    case 'wallet.isLoggedIn':
      return { result: wallet.isLoggedIn() };
    
    case 'wallet.getInfo':
      return { result: wallet.getWalletInfo() };
    
    case 'wallet.createWallet':
      return { result: await wallet.createWallet(params.username, params.password, params.pin) };
    
    case 'wallet.login':
      return { result: await wallet.login(params.username, params.password, params.pin) };
    
    case 'wallet.logout':
      return { result: await wallet.logout() };
    
    case 'wallet.lock':
      return { result: await wallet.lock() };
    
    case 'wallet.unlock':
      return { result: await wallet.unlock(params.pin) };

    // Account operations
    case 'account.getBalance':
      return { result: await wallet.getBalance(params.account) };
    
    case 'account.getAddress':
      return { result: await wallet.getAccountAddress(params.account) };
    
    case 'account.getAllBalances':
      return { result: await wallet.getAllBalances() };

    // Transactions
    case 'transaction.send':
      return { result: await wallet.send(params.account, params.amount, params.recipient, params.reference) };
    
    case 'transaction.getHistory':
      return { result: await wallet.getTransactions(params.account || 'default', params.limit) };
    
    case 'transaction.getDetails':
      return { result: await wallet.getTransactionDetails(params.txid) };

    // Settings
    case 'settings.getNodeUrl':
      return { result: await wallet.getNodeUrl() };
    
    case 'settings.setNodeUrl':
      await wallet.updateNodeUrl(params.url);
      return { result: true };

    // DApp connections (for web3 provider)
    case 'dapp.requestConnection':
      return await handleDAppConnection(sender, params);
    
    case 'dapp.getAccounts':
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      const address = await wallet.getAccountAddress('default');
      return { result: [address] };
    
    case 'dapp.signTransaction':
      return await handleSignTransaction(params);
    
    case 'dapp.sendTransaction':
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      return { result: await wallet.send(params.from, params.amount, params.to, params.reference) };

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// Handle DApp connection request
async function handleDAppConnection(sender, params) {
  const { origin } = params;
  
  // In a production environment, you would show a popup for user approval
  // For now, we'll auto-approve if logged in
  if (!wallet.isLoggedIn()) {
    throw new Error('Wallet not connected');
  }

  // Store approved domain
  const storage = new StorageService();
  const approvedDomains = await storage.get('approvedDomains') || [];
  if (!approvedDomains.includes(origin)) {
    approvedDomains.push(origin);
    await storage.set('approvedDomains', approvedDomains);
  }

  const address = await wallet.getAccountAddress('default');
  return {
    result: {
      connected: true,
      accounts: [address]
    }
  };
}

// Handle transaction signing
async function handleSignTransaction(params) {
  if (!wallet.isLoggedIn()) {
    throw new Error('Wallet not connected');
  }

  // In production, show approval popup
  // For now, return a simple signed indicator
  return {
    result: {
      signed: true,
      txid: 'pending'
    }
  };
}

// Handle external connections (for advanced dApp integration)
chrome.runtime.onConnect.addListener((port) => {
  console.log('External connection established:', port.name);
  
  port.onMessage.addListener(async (msg) => {
    try {
      const response = await handleMessage(msg, { origin: port.sender.origin });
      port.postMessage(response);
    } catch (error) {
      port.postMessage({ error: error.message });
    }
  });
});

// Periodic balance refresh (every 50 seconds)
setInterval(async () => {
  if (wallet && wallet.isLoggedIn()) {
    try {
      await wallet.getBalance('default');
      await wallet.getTransactions('default', 50);
    } catch (error) {
      console.error('Failed to refresh wallet data:', error);
    }
  }
}, 50 * 1000);

// Security: Terminate session when service worker is about to be terminated
// This happens when the browser closes or the extension is reloaded
self.addEventListener('beforeunload', async () => {
  console.log('Service worker terminating, cleaning up session');
  if (wallet && wallet.isLoggedIn()) {
    try {
      const sessionInfo = wallet.getSessionInfo();
      if (sessionInfo && sessionInfo.session) {
        const storage = new StorageService();
        const nodeUrl = await storage.getNodeUrl();
        const api = new NexusAPI(nodeUrl);
        await api.terminateSession(sessionInfo.session);
        await storage.clearSession(); // Clear session from storage
        console.log('Nexus session terminated successfully');
      }
    } catch (error) {
      console.error('Failed to terminate Nexus session:', error);
    }
  }
});

// Also handle extension being disabled/uninstalled
chrome.management.onDisabled.addListener(async (info) => {
  if (info.id === chrome.runtime.id) {
    console.log('Extension disabled, terminating session');
    if (wallet && wallet.isLoggedIn()) {
      try {
        await wallet.logout();
      } catch (error) {
        console.error('Failed to terminate session on disable:', error);
      }
    }
  }
});

// Clean up session data when browser window is closed
// Listen for all windows being removed
chrome.windows.onRemoved.addListener(async (windowId) => {
  const windows = await chrome.windows.getAll();
  if (windows.length === 0) {
    // Last window closed, clean up session
    console.log('Last browser window closed, terminating session');
    if (wallet && wallet.isLoggedIn()) {
      try {
        const sessionInfo = wallet.getSessionInfo();
        if (sessionInfo && sessionInfo.session) {
          const storage = new StorageService();
          const nodeUrl = await storage.getNodeUrl();
          const api = new NexusAPI(nodeUrl);
          await api.terminateSession(sessionInfo.session);
          await storage.clearSession();
          console.log('Nexus session terminated on browser close');
        }
      } catch (error) {
        console.error('Failed to terminate session on browser close:', error);
      }
    }
  }
});

console.log('Nexus Wallet background service worker loaded');
