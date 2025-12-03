// Background Service Worker
// Handles background processes, message passing, and dApp connections

// Import services
importScripts('services/nexus-api.js', 'services/storage.js', 'services/wallet.js');

let wallet;
const pendingApprovals = new Map(); // Store pending connection approval requests
const pendingTransactionApprovals = new Map(); // Store pending transaction approval requests

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
  
  // Handle transaction approval responses
  if (request.type === 'TRANSACTION_APPROVAL_RESPONSE') {
    const { requestId, approved, pin, transactionData } = request;
    console.log('Transaction approval response received:', { requestId, approved });
    
    const pending = pendingTransactionApprovals.get(requestId);
    if (pending) {
      // Resolve the promise with approval status and PIN
      pending.resolve({ approved, pin, transactionData });
      pendingTransactionApprovals.delete(requestId);
      
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
      // Request transaction approval from user with PIN
      return await handleDAppTransaction(params);

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

  // Update activity timestamp for this domain
  await storage.updateDomainActivity(origin);
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
    // Update activity timestamp
    await storage.updateDomainActivity(origin);
    
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
    // Set initial activity timestamp
    await storage.updateDomainActivity(origin);
    
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

// Handle dApp transaction request with user approval
async function handleDAppTransaction(params) {
  const { origin, from, to, amount, reference } = params;
  
  // Request user approval via popup
  const approval = await requestTransactionApproval({
    origin,
    from: from || 'default',
    to,
    amount,
    reference: reference || ''
  });
  
  if (!approval.approved) {
    throw new Error('Transaction rejected by user');
  }
  
  if (!approval.pin) {
    throw new Error('PIN is required for transaction');
  }
  
  // Execute transaction with user-provided PIN
  try {
    const result = await wallet.send(
      approval.transactionData.from,
      approval.transactionData.amount,
      approval.transactionData.to,
      approval.pin,
      approval.transactionData.reference
    );
    
    return { result };
  } catch (error) {
    console.error('Transaction failed:', error);
    throw new Error('Transaction failed: ' + error.message);
  }
}

// Request user approval for dApp transaction
async function requestTransactionApproval(transactionData) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    console.log('Requesting transaction approval:', transactionData, 'requestId:', requestId);
    
    // Store the pending request
    pendingTransactionApprovals.set(requestId, { 
      transactionData, 
      resolve, 
      reject 
    });
    
    // Create popup window for approval
    const width = 420;
    const height = 580;
    
    // Build URL with transaction parameters
    const params = new URLSearchParams({
      requestId,
      origin: transactionData.origin,
      from: transactionData.from,
      to: transactionData.to,
      amount: transactionData.amount,
      reference: transactionData.reference
    });
    
    chrome.windows.create({
      url: `approve-transaction.html?${params.toString()}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create approval window:', chrome.runtime.lastError);
        pendingTransactionApprovals.delete(requestId);
        reject(new Error('Unable to show approval dialog'));
        return;
      }
      
      console.log('Transaction approval window created:', window.id);
      
      // Store window ID with the request
      const pending = pendingTransactionApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 3 minutes
      setTimeout(() => {
        if (pendingTransactionApprovals.has(requestId)) {
          console.log('Transaction approval request timed out');
          pendingTransactionApprovals.delete(requestId);
          reject(new Error('Transaction approval request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 180000);
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
  await cleanupSession('service worker termination');
});

// Also handle extension being disabled/uninstalled
chrome.management.onDisabled.addListener(async (info) => {
  if (info.id === chrome.runtime.id) {
    console.log('Extension disabled, terminating session');
    await cleanupSession('extension disabled');
  }
});

// Handle service worker lifecycle - cleanup on suspend
chrome.runtime.onSuspend.addListener(async () => {
  console.log('Service worker suspending, cleaning up session');
  await cleanupSession('service worker suspend');
});

// Periodic session validation (every 30 seconds)
// Ensures session is still valid and cleans up if not
setInterval(async () => {
  if (wallet && wallet.isLoggedIn()) {
    try {
      const sessionInfo = wallet.getSessionInfo();
      if (sessionInfo && sessionInfo.session) {
        // Verify session is still in storage
        const storage = new StorageService();
        const storedSession = await storage.getSession();
        
        if (!storedSession || storedSession.session !== sessionInfo.session) {
          console.warn('Session mismatch detected, cleaning up');
          await cleanupSession('session validation failure');
        }
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }
}, 30000);

// Clean up session data when browser window is closed
// Listen for all windows being removed
chrome.windows.onRemoved.addListener(async (windowId) => {
  const windows = await chrome.windows.getAll();
  if (windows.length === 0) {
    // Last window closed, clean up session
    console.log('Last browser window closed, terminating session');
    await cleanupSession('browser close');
  }
});

// Centralized session cleanup function (defense in depth)
async function cleanupSession(reason = 'unknown') {
  console.log(`Cleaning up session (reason: ${reason})`);
  
  try {
    const storage = new StorageService();
    
    // Step 1: Terminate session on blockchain node (if logged in)
    if (wallet && wallet.isLoggedIn()) {
      try {
        const sessionInfo = wallet.getSessionInfo();
        if (sessionInfo && sessionInfo.session) {
          const nodeUrl = await storage.getNodeUrl();
          const api = new NexusAPI(nodeUrl);
          await api.terminateSession(sessionInfo.session);
          console.log(`Nexus session terminated on ${reason}`);
        }
      } catch (error) {
        console.error('Failed to terminate Nexus session:', error);
        // Continue with storage cleanup even if termination fails
      }
    }
    
    // Step 2: Securely clear session from storage
    await storage.clearSession();
    
    // Step 3: Clear any remaining session-prefixed data (fallback mode)
    if (!storage.useSessionAPI) {
      await storage.clearAllSessionData();
    }
    
    // Step 4: Reset wallet state
    if (wallet) {
      wallet.session = null;
      wallet.genesis = null;
      wallet.isLocked = true;
    }
    
    console.log(`Session cleanup completed (${reason})`);
  } catch (error) {
    console.error(`Session cleanup error (${reason}):`, error);
  }
}

// Periodic cleanup of inactive dApp connections (every 5 minutes)
setInterval(async () => {
  try {
    const storage = new StorageService();
    const inactiveDomains = await storage.cleanupInactiveDomains(30 * 60 * 1000); // 30 minutes
    
    if (inactiveDomains.length > 0) {
      console.log('Disconnected inactive dApps:', inactiveDomains);
    }
  } catch (error) {
    console.error('Failed to cleanup inactive dApps:', error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

console.log('Nexus Wallet background service worker loaded');
