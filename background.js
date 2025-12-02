// Background Service Worker
// Handles background processes, message passing, and dApp connections

// Import services
importScripts('services/nexus-api.js', 'services/storage.js', 'services/wallet.js');

let wallet;
const pendingApprovals = new Map(); // Store pending connection approval requests

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
  // Handle connection approval responses
  if (request.type === 'CONNECTION_RESPONSE') {
    const { requestId, approved, blocked, origin } = request;
    console.log('Connection response received:', { requestId, approved, blocked, origin });
    
    const pending = pendingApprovals.get(requestId);
    if (pending) {
      // Handle blocking if requested
      if (blocked) {
        const storage = new StorageService();
        storage.addBlockedDomain(origin).then(() => {
          console.log('Domain blocked:', origin);
        });
      }
      
      // Resolve the promise
      pending.resolve(approved);
      pendingApprovals.delete(requestId);
      
      // Close the window
      if (pending.windowId) {
        chrome.windows.remove(pending.windowId).catch(() => {});
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle normal messages
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
      await checkDAppPermission(params.origin);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      const address = await wallet.getAccountAddress('default');
      return { result: [address] };
    
    case 'dapp.signTransaction':
      await checkDAppPermission(params.origin);
      return await handleSignTransaction(params);
    
    case 'dapp.sendTransaction':
      await checkDAppPermission(params.origin);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      return { result: await wallet.send(params.from, params.amount, params.to, params.reference) };

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// Check if dApp has permission
async function checkDAppPermission(origin) {
  const storage = new StorageService();
  
  // Check if blocked
  const isBlocked = await storage.isDomainBlocked(origin);
  if (isBlocked) {
    throw new Error('This domain has been blocked from accessing your wallet');
  }
  
  // Check if approved
  const isApproved = await storage.isDomainApproved(origin);
  if (!isApproved) {
    throw new Error('This domain is not approved. Please connect first.');
  }
}

// Handle DApp connection request
async function handleDAppConnection(sender, params) {
  const { origin } = params;
  
  if (!wallet.isLoggedIn()) {
    throw new Error('Wallet not connected. Please log in first.');
  }

  const storage = new StorageService();
  
  // Check if domain is blocked
  const isBlocked = await storage.isDomainBlocked(origin);
  if (isBlocked) {
    throw new Error('This domain has been blocked from connecting to your wallet');
  }

  // Check if already approved
  const isApproved = await storage.isDomainApproved(origin);
  if (isApproved) {
    const address = await wallet.getAccountAddress('default');
    return {
      result: {
        connected: true,
        accounts: [address]
      }
    };
  }

  // Request user approval via notification
  const approved = await requestUserApproval(origin);
  
  if (approved) {
    await storage.addApprovedDomain(origin);
    const address = await wallet.getAccountAddress('default');
    return {
      result: {
        connected: true,
        accounts: [address]
      }
    };
  } else {
    throw new Error('User denied connection request');
  }
}

// Request user approval for dApp connection
async function requestUserApproval(origin) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    console.log('Requesting approval for:', origin, 'requestId:', requestId);
    
    // Store the pending request
    pendingApprovals.set(requestId, { origin, resolve, reject });
    
    // Create popup window for approval (centered on current screen)
    const width = 400;
    const height = 420;
    
    chrome.windows.create({
      url: `approve-connection.html?origin=${encodeURIComponent(origin)}&requestId=${requestId}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create approval window:', chrome.runtime.lastError);
        pendingApprovals.delete(requestId);
        reject(new Error('Unable to show approval dialog'));
        return;
      }
      
      console.log('Approval window created:', window.id);
      
      // Store window ID with the request
      const pending = pendingApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 2 minutes
      setTimeout(() => {
        if (pendingApprovals.has(requestId)) {
          console.log('Approval request timed out for:', origin);
          pendingApprovals.delete(requestId);
          reject(new Error('Connection request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 120000);
    });
  });
}

// Handle connection response from approval popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CONNECTION_RESPONSE') {
    const { requestId, approved, blocked, origin } = request;
    console.log('Connection response received:', { requestId, approved, blocked, origin });
    
    const pending = pendingApprovals.get(requestId);
    if (pending) {
      // Handle blocking if requested
      if (blocked) {
        const storage = new StorageService();
        storage.addBlockedDomain(origin).then(() => {
          console.log('Domain blocked:', origin);
        });
      }
      
      // Resolve the promise
      pending.resolve(approved);
      pendingApprovals.delete(requestId);
      
      // Close the window
      if (pending.windowId) {
        chrome.windows.remove(pending.windowId).catch(() => {});
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle other messages
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('Message handler error:', error);
      sendResponse({ error: error.message });
    });
  
  return true;
});

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
