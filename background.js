// Background Service Worker
// Handles background processes, message passing, and dApp connections

// Import services
importScripts('lib/logger.js', 'services/nexus-api.js', 'services/storage.js', 'services/wallet.js');

let wallet;
const pendingApprovals = new Map(); // Store pending connection approval requests
const pendingTransactionApprovals = new Map(); // Store pending transaction approval requests
const pendingBuyFeeTokens = new Map(); // Store pending buy fee tokens requests
const recentTransactionRequests = new Map(); // Track recent transaction requests to prevent duplicates
const recentConnectionRequests = new Map(); // Track recent connection requests to prevent duplicates

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  Logger.info('Extension installed');
  wallet = new WalletService();
  await wallet.initialize();
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  Logger.info('Extension started');
  wallet = new WalletService();
  await wallet.initialize();
});

// Ensure wallet is properly initialized
async function ensureWalletInitialized() {
  if (!wallet) {
    Logger.debug('Creating new wallet instance');
    wallet = new WalletService();
    await wallet.initialize();
  } else if (!wallet.session) {
    // Wallet exists but session might not be loaded - reinitialize to load from storage
    Logger.debug('Wallet reinitializing to load session');
    await wallet.initialize();
  }
  return wallet;
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  Logger.debug('Message received:', request.method || request.type, 'from', sender.url);
  
  // Handle connection approval responses
  if (request.type === 'CONNECTION_RESPONSE') {
    const { requestId, approved, blocked, origin, paymentAccount, pin } = request;
    Logger.debug('Connection response:', approved ? 'approved' : 'denied', origin);
    
    const pending = pendingApprovals.get(requestId);
    if (pending) {
      // Handle blocking if requested
      if (blocked) {
        const storage = new StorageService();
        storage.addBlockedDomain(origin).then(() => {
          Logger.info('Domain blocked:', origin);
        });
      }
      
      // Resolve the promise with approval, payment account, and PIN info
      pending.resolve({
        approved,
        paymentAccount: paymentAccount || null,
        pin: pin || null
      });
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
    const { requestId, approved, pin, distAccount, nxsFee, transactionData } = request;
    Logger.debug('Transaction approval:', approved ? 'approved' : 'denied');
    
    const pending = pendingTransactionApprovals.get(requestId);
    if (pending) {
      // Resolve the promise with approval status, PIN, and window info
      pending.resolve({ 
        approved, 
        pin,
        distAccount,
        nxsFee,
        transactionData,
        requestId: pending.requestId,
        windowId: pending.windowId
      });
      pendingTransactionApprovals.delete(requestId);
      
      // Don't close the window yet - wait for transaction result to be displayed
    } else {
      Logger.error('No pending approval found for requestId:', requestId);
    }
    
    sendResponse({ success: true });
    return true; // Early return - don't process this message further
  }
  
  // Handle buy fee tokens response
  if (request.type === 'BUY_FEE_TOKENS_RESPONSE') {
    const { requestId, purchased, txid, origin } = request;
    Logger.debug('Buy fee tokens response:', purchased ? 'purchased' : 'cancelled', origin);
    
    const pending = pendingBuyFeeTokens.get(requestId);
    if (pending) {
      pending.resolve({
        purchased,
        txid: txid || null
      });
      pendingBuyFeeTokens.delete(requestId);
      
      // Only close the window if cancelled - if purchased, let user see the result
      if (!purchased && pending.windowId) {
        chrome.windows.remove(pending.windowId).catch(() => {});
      }
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle open buy fee tokens request from connection window
  if (request.type === 'OPEN_BUY_FEE_TOKENS') {
    const { origin, fee, requestId: connectionRequestId } = request;
    Logger.debug('Open buy fee tokens request:', origin, fee);
    
    // Reject the pending connection approval so the promise completes and cleans up
    const pending = pendingApprovals.get(connectionRequestId);
    if (pending) {
      // Reject with a special error that indicates user is buying tokens
      pending.reject(new Error('User redirected to buy fee tokens'));
      pendingApprovals.delete(connectionRequestId);
      
      // Close the connection approval window
      if (pending.windowId) {
        chrome.windows.remove(pending.windowId).catch(() => {});
      }
    }
    
    // Open the buy fee tokens modal
    requestBuyFeeTokens(origin, fee)
      .then(result => {
        if (result.purchased) {
          Logger.info('Fee tokens purchased successfully:', result.txid);
          // User bought tokens - they need to retry connection after confirmation
        } else {
          Logger.debug('Buy fee tokens cancelled');
        }
      })
      .catch(error => {
        Logger.error('Buy fee tokens failed:', error.message);
      });
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle normal messages (only if not already handled above)
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => {
      Logger.error('Message handler error:', error.message);
      sendResponse({ error: error.message });
    });
  
  // Return true to indicate async response
  return true;
});

// Message handler
async function handleMessage(request, sender) {
  const { method, params } = request;
  
  // Guard against messages without method (e.g., internal extension messages)
  if (!method) {
    Logger.warn('Message received without method property');
    return { error: 'No method specified' };
  }

  // Ensure wallet is properly initialized with session data
  await ensureWalletInitialized();

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
      Logger.debug('Login attempt');
      const loginResult = await wallet.login(params.username, params.password, params.pin);
      Logger.info('Login successful');
      return { result: loginResult };
    
    case 'wallet.logout':
      // Re-initialize wallet to load current session from storage before logging out
      await wallet.initialize();
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
    
    case 'account.listAccounts':
      return { result: await wallet.api.listAccounts(wallet.session) };

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

    // Market API
    case 'market.listAsks':
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      return { result: await wallet.api.listMarketAsks(params.market) };
    
    case 'market.executeOrder':
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      return { result: await wallet.api.executeMarketOrder(
        params.txid, 
        params.pin, 
        wallet.session,
        params.from || null,
        params.to || null
      ) };

    // DApp connections (for web3 provider)
    case 'dapp.requestConnection':
      return await handleDAppConnection(sender, params);
    
    case 'dapp.requestConnectionWithFee':
      return await handleDAppConnectionWithFee(sender, params);
    
    case 'dapp.getAccounts':
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      const address = await wallet.getAccountAddress('default');
      return { result: [address] };
    
    case 'dapp.signTransaction':
      await checkDAppPermission(params.origin, sender.url);
      return await handleSignTransaction(params);
    
    case 'dapp.sendTransaction':
      Logger.debug('dApp transaction request from:', params.origin);
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      // Request transaction approval from user with PIN
      return await handleDAppTransaction(params);
    
    case 'dapp.sendBatchTransactions':
      Logger.debug('dApp batch transactions from:', params.origin);
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      // Request batch transaction approval from user with single PIN
      return await handleDAppBatchTransaction(params);

    case 'dapp.executeBatchCalls':
      Logger.debug('dApp batch API calls from:', params.origin);
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      // Request batch API calls approval from user with single PIN
      return await handleDAppBatchCalls(params);

    case 'dapp.disconnect':
      Logger.debug('dApp disconnect:', params.origin);
      // Allow site to disconnect itself without approval
      return await handleDAppDisconnect(params.origin, sender.url);

    case 'dapp.isLoggedIn':
      // Allow any dApp to check login status without permission
      return { result: { isLoggedIn: wallet.isLoggedIn() } };

    case 'dapp.getAllBalances':
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      return { result: await wallet.getAllBalances() };

    case 'dapp.listAccounts':
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      return { result: await wallet.listAccounts() };

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// Handle dApp disconnection (site disconnects itself)
async function handleDAppDisconnect(origin, senderUrl = null) {
  const storage = new StorageService();
  
  // For local files, use full URL instead of origin to distinguish between files
  const identifier = (senderUrl && senderUrl.startsWith('file://')) ? senderUrl : origin;
  
  console.log('Disconnecting dApp:', identifier);
  
  try {
    // Remove from approved domains
    await storage.removeApprovedDomain(identifier);
    console.log('Successfully disconnected:', identifier);
    
    return { result: { success: true, disconnected: true } };
  } catch (error) {
    console.error('Failed to disconnect dApp:', error);
    throw new Error('Failed to disconnect: ' + error.message);
  }
}

// Check if dApp has permission
async function checkDAppPermission(origin, senderUrl = null) {
  const storage = new StorageService();
  
  // For local files, use full URL instead of origin to distinguish between files
  const identifier = (senderUrl && senderUrl.startsWith('file://')) ? senderUrl : origin;
  
  // Check if blocked
  const isBlocked = await storage.isDomainBlocked(identifier);
  if (isBlocked) {
    throw new Error('This domain has been blocked from accessing your wallet');
  }
  
  // Check if approved
  const isApproved = await storage.isDomainApproved(identifier);
  if (!isApproved) {
    throw new Error('This domain is not approved. Please connect first.');
  }

  // Update activity timestamp for this domain
  await storage.updateDomainActivity(identifier);
}

// Handle DApp connection request
async function handleDAppConnection(sender, params) {
  const { origin } = params;
  
  // For local files, use full URL instead of origin to distinguish between files
  const senderUrl = sender.url || origin;
  const identifier = senderUrl.startsWith('file://') ? senderUrl : origin;
  
  Logger.debug('dApp connection request:', identifier);
  
  // Ensure wallet is properly initialized with session data
  await ensureWalletInitialized();
  
  if (!wallet.isLoggedIn()) {
    throw new Error('Wallet not connected. Please log in first.');
  }

  const storage = new StorageService();
  
  // Check if domain is blocked
  const isBlocked = await storage.isDomainBlocked(identifier);
  if (isBlocked) {
    throw new Error('This domain has been blocked from connecting to your wallet');
  }

  // Check if already approved
  const isApproved = await storage.isDomainApproved(identifier);
  if (isApproved) {
    // Update activity timestamp
    await storage.updateDomainActivity(identifier);
    
    const address = await wallet.getAccountAddress('default');
    return {
      result: {
        connected: true,
        accounts: [address]
      }
    };
  }

  // Check if there's already a pending approval for this domain
  const pendingKey = `connection:${identifier}`;
  const existingPending = recentConnectionRequests.get(pendingKey);
  if (existingPending) {
    Logger.debug('Connection request already pending:', identifier);
    // Wait for the existing request to complete instead of throwing error
    return existingPending;
  }
  
  // Create a promise for this connection request
  const connectionPromise = (async () => {
    try {
      // Request user approval via notification
      const approvalResult = await requestUserApproval(identifier);
      const approved = typeof approvalResult === 'boolean' ? approvalResult : approvalResult.approved;
      
      if (approved) {
        await storage.addApprovedDomain(identifier);
        // Set initial activity timestamp
        await storage.updateDomainActivity(identifier);
        
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
    } finally {
      // Clean up pending marker
      recentConnectionRequests.delete(pendingKey);
    }
  })();
  
  // Store the promise so duplicate requests can wait for this one
  recentConnectionRequests.set(pendingKey, connectionPromise);
  
  return connectionPromise;
}

// Handle DApp connection request with fee requirement
async function handleDAppConnectionWithFee(sender, params) {
  const { origin, fee } = params;
  
  // Validate fee parameters
  if (!fee || !fee.tokenName || !fee.amount || !fee.recipientAddress || !fee.validitySeconds) {
    throw new Error('Invalid fee configuration');
  }
  
  // For local files, use full URL instead of origin to distinguish between files
  const senderUrl = sender.url || origin;
  const identifier = senderUrl.startsWith('file://') ? senderUrl : origin;
  
  Logger.debug('dApp connection with fee request:', identifier, fee);
  
  // Ensure wallet is properly initialized with session data
  await ensureWalletInitialized();
  
  if (!wallet.isLoggedIn()) {
    throw new Error('Wallet not connected. Please log in first.');
  }

  const storage = new StorageService();
  
  // Step 1: Check if domain is blocked
  const isBlocked = await storage.isDomainBlocked(identifier);
  if (isBlocked) {
    throw new Error('This domain has been blocked from connecting to your wallet');
  }

  // Step 1b: Check if already approved - connect directly
  const isApproved = await storage.isDomainApproved(identifier);
  if (isApproved) {
    // Update activity timestamp
    await storage.updateDomainActivity(identifier);
    
    const address = await wallet.getAccountAddress('default');
    return {
      result: {
        connected: true,
        accounts: [address]
      }
    };
  }

  // Step 2: Check if user has already paid within the validity window (on-chain verification)
  const paymentCheck = await wallet.api.checkConnectionFeePayment(
    wallet.session,
    fee.recipientAddress,
    fee.tokenName,
    fee.amount,
    fee.validitySeconds
  );
  
  if (paymentCheck.hasPaid) {
    // Step 2a: Found existing payment - redirect to free connection approval
    Logger.debug('Existing fee payment found, redirecting to free approval');
    
    // Store it for tracking
    await storage.addPaidConnection(identifier, {
      tokenName: fee.tokenName,
      amount: fee.amount,
      recipientAddress: fee.recipientAddress,
      accountName: paymentCheck.accountName,
      txid: paymentCheck.txid,
      timestamp: paymentCheck.timestamp,
      validitySeconds: fee.validitySeconds
    });
    
    // Request user approval WITHOUT fee (free connection flow)
    const approved = await requestUserApproval(identifier);
    const approvalResult = typeof approved === 'boolean' ? approved : approved.approved;
    
    if (approvalResult) {
      await storage.addApprovedDomain(identifier);
      await storage.updateDomainActivity(identifier);
      
      const address = await wallet.getAccountAddress('default');
      return {
        result: {
          connected: true,
          accounts: [address],
          paidConnection: true,
          existingPayment: true
        }
      };
    } else {
      throw new Error('User denied connection request');
    }
  }

  // Step 2b: No existing payment - need to request payment
  // Check if there's already a pending approval for this domain
  const pendingKey = `connection:${identifier}`;
  const existingPending = recentConnectionRequests.get(pendingKey);
  if (existingPending) {
    Logger.debug('Connection request already pending:', identifier);
    return existingPending;
  }
  
  // Create a promise for this connection request with fee
  const connectionPromise = (async () => {
    try {
      // Request user approval with fee payment
      const approvalResult = await requestUserApprovalWithFee(identifier, fee);
      
      if (approvalResult.approved) {
        // User approved and selected payment account
        // Execute the fee payment with provided PIN
        if (!approvalResult.pin) {
          throw new Error('PIN is required for fee payment');
        }
        
        const txResult = await wallet.send(
          approvalResult.paymentAccount,
          fee.amount,
          fee.recipientAddress,
          approvalResult.pin,
          '' // Reference must be empty or numeric - empty is safer
        );
        
        // Store paid connection info
        await storage.addPaidConnection(identifier, {
          tokenName: fee.tokenName,
          amount: fee.amount,
          recipientAddress: fee.recipientAddress,
          accountName: approvalResult.paymentAccount,
          txid: txResult.txid,
          timestamp: Math.floor(Date.now() / 1000),
          validitySeconds: fee.validitySeconds
        });
        
        // Approve the connection
        await storage.addApprovedDomain(identifier);
        await storage.updateDomainActivity(identifier);
        
        const address = await wallet.getAccountAddress('default');
        return {
          result: {
            connected: true,
            accounts: [address],
            paidConnection: true,
            paymentTxid: txResult.txid
          }
        };
      } else {
        throw new Error('User denied connection request');
      }
    } finally {
      // Clean up pending marker
      recentConnectionRequests.delete(pendingKey);
    }
  })();
  
  // Store the promise so duplicate requests can wait for this one
  recentConnectionRequests.set(pendingKey, connectionPromise);
  
  return connectionPromise;
}

// Request user approval for dApp connection
async function requestUserApproval(origin) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    Logger.debug('Requesting dApp approval:', origin);
    
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
        Logger.error('Failed to create approval window:', chrome.runtime.lastError.message);
        pendingApprovals.delete(requestId);
        reject(new Error('Unable to show approval dialog'));
        return;
      }
      
      Logger.debug('Approval window created for:', origin);
      
      // Store window ID with the request
      const pending = pendingApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 2 minutes
      setTimeout(() => {
        if (pendingApprovals.has(requestId)) {
          Logger.warn('Approval request timed out:', origin);
          pendingApprovals.delete(requestId);
          reject(new Error('Connection request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 120000);
    });
  });
}

// Request user approval for dApp connection with fee
async function requestUserApprovalWithFee(origin, fee) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    Logger.debug('Requesting dApp approval with fee:', origin, fee);
    
    // Store the pending request
    pendingApprovals.set(requestId, { origin, fee, resolve, reject });
    
    // Create popup window for approval with fee details
    const width = 450;
    const height = 650;
    
    const feeParam = encodeURIComponent(JSON.stringify(fee));
    
    chrome.windows.create({
      url: `approve-connection.html?origin=${encodeURIComponent(origin)}&requestId=${requestId}&fee=${feeParam}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        Logger.error('Failed to create approval window:', chrome.runtime.lastError.message);
        pendingApprovals.delete(requestId);
        reject(new Error('Unable to show approval dialog'));
        return;
      }
      
      Logger.debug('Fee approval window created for:', origin);
      
      // Store window ID with the request
      const pending = pendingApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 3 minutes (longer for fee approval)
      setTimeout(() => {
        if (pendingApprovals.has(requestId)) {
          Logger.warn('Fee approval request timed out:', origin);
          pendingApprovals.delete(requestId);
          reject(new Error('Connection request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 180000);
    });
  });
}

// Request user to buy fee tokens from market
async function requestBuyFeeTokens(origin, fee) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    Logger.debug('Requesting buy fee tokens:', origin, fee);
    
    // Store the pending request
    pendingBuyFeeTokens.set(requestId, { origin, fee, resolve, reject });
    
    // Create popup window for buying tokens
    const width = 450;
    const height = 600;
    
    const feeParam = encodeURIComponent(JSON.stringify(fee));
    
    chrome.windows.create({
      url: `approve-buy-fee-tokens.html?origin=${encodeURIComponent(origin)}&requestId=${requestId}&fee=${feeParam}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        Logger.error('Failed to create buy tokens window:', chrome.runtime.lastError.message);
        pendingBuyFeeTokens.delete(requestId);
        reject(new Error('Unable to show buy tokens dialog'));
        return;
      }
      
      Logger.debug('Buy tokens window created for:', origin);
      
      // Store window ID with the request
      const pending = pendingBuyFeeTokens.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-cancel after 5 minutes
      setTimeout(() => {
        if (pendingBuyFeeTokens.has(requestId)) {
          Logger.warn('Buy fee tokens request timed out:', origin);
          pendingBuyFeeTokens.delete(requestId);
          reject(new Error('Buy tokens request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 300000);
    });
  });
}

// Handle dApp transaction request with user approval
async function handleDAppTransaction(params) {
  const { origin, from, to, amount, reference } = params;
  
  console.log('=== handleDAppTransaction called ===');
  console.log('Params:', { origin, from, to, amount, reference });
  
  // Validate required parameters
  // Note: 'from' is optional and defaults to 'default'
  if (!to) {
    throw new Error('"to" parameter is required');
  }
  if (amount === undefined || amount === null) {
    throw new Error('"amount" parameter is required');
  }
  
  // Default 'from' to 'default' if not provided
  const fromAccount = from || 'default';
  
  // Validate amount is a positive number
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error('"amount" must be a positive number');
  }
  
  // Validate reference if provided
  let validatedReference = undefined;
  if (reference !== undefined && reference !== null && reference !== '') {
    const refString = String(reference).trim();
    if (refString !== '') {
      // Check if it's a valid 64-bit unsigned integer
      try {
        const refNum = BigInt(refString);
        if (refNum < 0n || refNum > 18446744073709551615n) {
          throw new Error('"reference" must be a 64-bit unsigned integer (0 to 18446744073709551615)');
        }
        validatedReference = refString;
      } catch (err) {
        if (err.message.includes('reference')) throw err;
        throw new Error('"reference" must be a valid 64-bit unsigned integer');
      }
    }
  }
  
  // Create a unique key for this transaction request to prevent duplicates
  const requestKey = `${origin}:${fromAccount}:${to}:${amount}:${reference}`;
  const now = Date.now();
  
  // Check if we've seen this exact request in the last 500ms
  if (recentTransactionRequests.has(requestKey)) {
    const lastTime = recentTransactionRequests.get(requestKey);
    if (now - lastTime < 500) {
      Logger.warn('Duplicate transaction request ignored');
      throw new Error('Duplicate request detected');
    }
  }
  
  // Track this request
  recentTransactionRequests.set(requestKey, now);
  
  // Clean up old entries after 1 second
  setTimeout(() => {
    if (recentTransactionRequests.get(requestKey) === now) {
      recentTransactionRequests.delete(requestKey);
    }
  }, 1000);
  
  // Request user approval via popup
  Logger.debug('Requesting transaction approval');
  const approval = await requestTransactionApproval({
    origin,
    from: fromAccount,
    to,
    amount: numAmount,
    reference: validatedReference
  });
  
  if (!approval.approved) {
    throw new Error('Transaction rejected by user');
  }
  
  if (!approval.pin) {
    Logger.error('No PIN provided in approval');
    throw new Error('PIN is required for transaction');
  }
  
  // Verify wallet state
  if (!wallet.session) {
    throw new Error('Wallet session not available. Please log in again.');
  }
  
  // Execute transaction with user-provided PIN
  let result;
  let error;
  
  try {
    result = await wallet.send(
      approval.transactionData.from,
      approval.transactionData.amount,
      approval.transactionData.to,
      approval.pin,
      approval.transactionData.reference || undefined
    );
    Logger.info('Transaction successful:', result.txid || result);
  } catch (err) {
    Logger.error('Transaction failed:', err.message);
    error = err.message;
  }
  
  // Send result back to popup window using runtime.sendMessage (broadcasts to all contexts)
  if (approval.requestId) {
    console.log('Broadcasting transaction result:', { requestId: approval.requestId, success: !error });
    chrome.runtime.sendMessage({
      type: 'TRANSACTION_RESULT',
      requestId: approval.requestId,
      success: !error,
      result: result,
      error: error
    }).catch((err) => {
      Logger.debug('Could not broadcast result:', err.message);
    });
    
    // Give popup time to receive and display the result before potential window close
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (error) {
    throw new Error('Transaction failed: ' + error);
  }
  
  return { result };
}

// Handle dApp batch transaction request with user approval
async function handleDAppBatchTransaction(params) {
  const { origin, transactions } = params;
  
  Logger.debug('Batch transaction request:', transactions?.length, 'transactions');
  
  // Validate input
  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error('Invalid batch: transactions must be a non-empty array');
  }
  
  if (transactions.length > 10) {
    throw new Error('Batch too large: maximum 10 transactions allowed');
  }
  
  // Validate each transaction
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    
    // Validate required parameters (from is optional, defaults to 'default')
    if (!tx.to) {
      throw new Error(`Invalid transaction at index ${i}: "to" is required`);
    }
    if (tx.amount === undefined || tx.amount === null) {
      throw new Error(`Invalid transaction at index ${i}: "amount" is required`);
    }
    
    // Default 'from' to 'default' if not provided
    if (!tx.from) {
      transactions[i].from = 'default';
    }
    
    // Validate amount
    const numAmount = parseFloat(tx.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error(`Invalid transaction at index ${i}: "amount" must be a positive number`);
    }
    transactions[i].amount = numAmount;
    
    // Validate reference if provided
    if (tx.reference !== undefined && tx.reference !== null && tx.reference !== '') {
      const refString = String(tx.reference).trim();
      if (refString !== '') {
        try {
          const refNum = BigInt(refString);
          if (refNum < 0n || refNum > 18446744073709551615n) {
            throw new Error('out of range');
          }
          transactions[i].reference = refString;
        } catch (err) {
          throw new Error(`Invalid transaction at index ${i}: "reference" must be a 64-bit unsigned integer (0 to 18446744073709551615)`);
        }
      } else {
        delete transactions[i].reference; // Remove empty reference
      }
    } else {
      delete transactions[i].reference; // Remove undefined/null reference
    }
  }
  
  // Request user approval via popup
  Logger.debug('Requesting batch transaction approval');
  const approval = await requestBatchTransactionApproval({
    origin,
    transactions
  });
  
  if (!approval.approved) {
    throw new Error('Batch transaction rejected by user');
  }
  
  if (!approval.pin) {
    Logger.error('No PIN provided in batch approval');
    throw new Error('PIN is required for transactions');
  }
  
  // Verify wallet state
  if (!wallet.session) {
    throw new Error('Wallet session not available. Please log in again.');
  }
  
  // Execute all transactions
  Logger.debug('Executing', transactions.length, 'transactions');
  const results = [];
  const errors = [];
  
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    
    try {
      const result = await wallet.send(
        tx.from,
        tx.amount,
        tx.to,
        approval.pin,
        tx.reference || undefined
      );
      Logger.debug(`Transaction ${i + 1}/${transactions.length} successful`);
      results.push({ success: true, result, index: i });
    } catch (err) {
      Logger.error(`Transaction ${i + 1}/${transactions.length} failed:`, err.message);
      errors.push({ success: false, error: err.message, index: i });
      
      // Optionally stop on first error
      // You can change this behavior if you want to continue with remaining transactions
      results.push({ success: false, error: err.message, index: i });
      break; // Stop on first error
    }
  }
  
  // Send result back to popup window
  if (approval.requestId) {
    Logger.debug('Broadcasting batch results:', results.filter(r => r.success).length, '/', transactions.length, 'successful');
    chrome.runtime.sendMessage({
      type: 'BATCH_TRANSACTION_RESULT',
      requestId: approval.requestId,
      success: errors.length === 0,
      results: results,
      totalTransactions: transactions.length,
      successfulTransactions: results.filter(r => r.success).length
    }).catch((err) => {
      Logger.debug('Could not broadcast batch results:', err.message);
    });
    
    // Give popup time to receive and display the result
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (errors.length > 0) {
    throw new Error(`Batch transaction failed: ${errors.length} of ${transactions.length} transactions failed`);
  }
  
  return { 
    result: {
      totalTransactions: transactions.length,
      successfulTransactions: results.filter(r => r.success).length,
      results: results
    }
  };
}

// Handle dApp batch API calls request
async function handleDAppBatchCalls(params) {
  const { origin, calls } = params;
  
  Logger.debug('Batch API calls request:', calls?.length, 'calls');
  
  // Validate input
  if (!Array.isArray(calls) || calls.length === 0) {
    throw new Error('Invalid batch: calls must be a non-empty array');
  }
  
  if (calls.length > 12) {
    throw new Error('Batch too large: maximum 12 API calls allowed');
  }
  
  // Validate each call
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    if (!call.endpoint || typeof call.endpoint !== 'string') {
      throw new Error(`Invalid call at index ${i}: 'endpoint' is required and must be a string`);
    }
    if (!call.params || typeof call.params !== 'object') {
      throw new Error(`Invalid call at index ${i}: 'params' is required and must be an object`);
    }
  }
  
  // No service fee for batch API calls
  const nxsFee = 0;
  
  // Request user approval via popup
  Logger.debug('Requesting batch API calls approval');
  const approval = await requestBatchCallsApproval({
    origin,
    calls,
    nxsFee
  });
  
  if (!approval.approved) {
    throw new Error('Batch API calls rejected by user');
  }
  
  if (!approval.pin) {
    Logger.error('No PIN provided in batch calls approval');
    throw new Error('PIN is required for API calls');
  }
  
  // Verify wallet state
  if (!wallet.session) {
    throw new Error('Wallet session not available. Please log in again.');
  }
  
  // Execute all API calls
  Logger.debug('Executing', calls.length, 'API calls');
  const results = [];
  const errors = [];
  
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    
    try {
      // Add session and pin to params
      const callParams = {
        ...call.params,
        session: wallet.session,
        pin: approval.pin
      };
      
      // Execute the API call
      const result = await wallet.api.request(call.endpoint, callParams);
      Logger.debug(`Call ${i + 1}/${calls.length} successful:`, call.endpoint);
      results.push({ success: true, result, index: i, endpoint: call.endpoint });
    } catch (err) {
      Logger.error(`Call ${i + 1}/${calls.length} failed:`, call.endpoint, err.message);
      errors.push({ success: false, error: err.message, index: i, endpoint: call.endpoint });
      results.push({ success: false, error: err.message, index: i, endpoint: call.endpoint });
      break; // Stop on first error
    }
  }
  
  // Send result back to popup window
  if (approval.requestId) {
    Logger.debug('Broadcasting batch calls results:', results.filter(r => r.success).length, '/', calls.length, 'successful');
    chrome.runtime.sendMessage({
      type: 'BATCH_CALLS_RESULT',
      requestId: approval.requestId,
      success: errors.length === 0,
      results: results,
      totalCalls: calls.length,
      successfulCalls: results.filter(r => r.success).length
    }).catch((err) => {
      Logger.debug('Could not broadcast batch calls results:', err.message);
    });
    
    // Give popup time to receive and display the result
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (errors.length > 0) {
    throw new Error(`Batch calls failed: ${errors.length} of ${calls.length} calls failed`);
  }
  
  return { 
    result: {
      totalCalls: calls.length,
      successfulCalls: results.filter(r => r.success).length,
      results: results,
      nxsFee: nxsFee
    }
  };
}

// Request user approval for dApp batch transaction
async function requestBatchTransactionApproval(batchData) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    console.log('Requesting batch transaction approval:', batchData, 'requestId:', requestId);
    
    // Store the pending request
    pendingTransactionApprovals.set(requestId, { 
      batchData, 
      resolve, 
      reject,
      requestId
    });
    
    // Create popup window for batch approval
    const width = 500;
    const height = 650;
    
    // Build URL with batch parameters (encode as JSON)
    const params = new URLSearchParams({
      requestId,
      origin: batchData.origin,
      batch: JSON.stringify(batchData.transactions)
    });
    
    chrome.windows.create({
      url: `approve-batch-transaction.html?${params.toString()}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        Logger.error('Failed to create batch approval window:', chrome.runtime.lastError.message);
        pendingTransactionApprovals.delete(requestId);
        reject(new Error('Unable to show batch approval dialog'));
        return;
      }
      
      Logger.debug('Batch transaction approval window created');
      
      // Store window ID with the request
      const pending = pendingTransactionApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 3 minutes
      setTimeout(() => {
        if (pendingTransactionApprovals.has(requestId)) {
          Logger.warn('Batch transaction approval timed out');
          pendingTransactionApprovals.delete(requestId);
          reject(new Error('Batch approval request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 180000);
    });
  });
}

// Request user approval for dApp batch API calls
async function requestBatchCallsApproval(batchData) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    Logger.debug('Requesting batch API calls approval');
    
    // Store the pending request
    pendingTransactionApprovals.set(requestId, { 
      batchData, 
      resolve, 
      reject,
      requestId
    });
    
    // Create popup window for batch approval
    const width = 520;
    const height = 700;
    
    // Build URL with batch parameters (encode as JSON)
    const params = new URLSearchParams({
      requestId,
      origin: batchData.origin,
      calls: JSON.stringify(batchData.calls),
      nxsFee: batchData.nxsFee
    });
    
    chrome.windows.create({
      url: `approve-batch-calls.html?${params.toString()}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        Logger.error('Failed to create batch calls approval window:', chrome.runtime.lastError.message);
        pendingTransactionApprovals.delete(requestId);
        reject(new Error('Unable to show batch calls approval dialog'));
        return;
      }
      
      Logger.debug('Batch calls approval window created');
      
      // Store window ID with the request
      const pending = pendingTransactionApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 3 minutes
      setTimeout(() => {
        if (pendingTransactionApprovals.has(requestId)) {
          Logger.warn('Batch calls approval timed out');
          pendingTransactionApprovals.delete(requestId);
          reject(new Error('Batch calls approval request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 180000);
    });
  });
}

// Request user approval for dApp transaction
async function requestTransactionApproval(transactionData) {
  return new Promise((resolve, reject) => {
    const requestId = Date.now().toString();
    Logger.debug('Requesting transaction approval');
    
    // Check if there's already a pending request (prevent duplicates)
    if (pendingTransactionApprovals.has(requestId)) {
      Logger.warn('Duplicate transaction approval request ignored');
      return pendingTransactionApprovals.get(requestId);
    }
    
    // Store the pending request
    pendingTransactionApprovals.set(requestId, { 
      transactionData, 
      resolve, 
      reject,
      requestId  // Store requestId for later reference
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
      amount: transactionData.amount
    });
    
    // Only add reference if it's defined
    if (transactionData.reference !== undefined && transactionData.reference !== null) {
      params.set('reference', transactionData.reference);
    }
    
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
          Logger.warn('Transaction approval timed out');
          pendingTransactionApprovals.delete(requestId);
          reject(new Error('Transaction approval request timed out'));
          
          // Close the window if still open
          chrome.windows.remove(window.id).catch(() => {});
        }
      }, 180000);
    });
  });
}

// ============================================================================
// NOTE: Message listener is defined at the top of this file (line ~28)
// This duplicate has been removed to prevent double-execution of messages
// ============================================================================

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
  Logger.debug('External connection established:', port.name);
  
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
      Logger.error('Failed to refresh wallet data:', error.message);
    }
  }
}, 50 * 1000);

// Security: Terminate session when service worker is about to be terminated
// This happens when the browser closes or the extension is reloaded
self.addEventListener('beforeunload', async () => {
  Logger.info('Service worker terminating, cleaning up session');
  await cleanupSession('service worker termination');
});

// Also handle extension being disabled/uninstalled
chrome.management.onDisabled.addListener(async (info) => {
  if (info.id === chrome.runtime.id) {
    Logger.info('Extension disabled, terminating session');
    await cleanupSession('extension disabled');
  }
});

// Handle service worker lifecycle - cleanup on suspend
chrome.runtime.onSuspend.addListener(async () => {
  Logger.info('Service worker suspending, cleaning up session');
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
          Logger.warn('Session mismatch detected, cleaning up');
          await cleanupSession('session validation failure');
        }
      }
    } catch (error) {
      Logger.error('Session validation error:', error.message);
    }
  }
}, 30000);

// Clean up session data when browser window is closed
// Listen for all windows being removed
chrome.windows.onRemoved.addListener(async (windowId) => {
  const windows = await chrome.windows.getAll();
  if (windows.length === 0) {
    // Last window closed, clean up session
    Logger.info('Last browser window closed, terminating session');
    await cleanupSession('browser close');
  }
});

// Centralized session cleanup function (defense in depth)
async function cleanupSession(reason = 'unknown') {
  Logger.info('Cleaning up session:', reason);
  
  try {
    const storage = new StorageService();
    
    // Step 1: Revoke all dApp connections
    try {
      const approvedDomains = await storage.getApprovedDomains();
      if (approvedDomains && approvedDomains.length > 0) {
        Logger.debug(`Revoking ${approvedDomains.length} dApp connection(s)`);
        for (const domain of approvedDomains) {
          await storage.removeApprovedDomain(domain);
        }
        Logger.debug('All dApp connections revoked');
      }
    } catch (error) {
      Logger.error('Failed to revoke dApp connections:', error.message);
      // Continue with other cleanup steps
    }
    
    // Step 2: Terminate session on blockchain node (if logged in)
    // Load session from storage since wallet object might not have it
    let sessionToTerminate = wallet?.session;
    
    if (!sessionToTerminate) {
      try {
        const sessionData = await storage.getSession();
        sessionToTerminate = sessionData?.session;
        Logger.debug('Session loaded from storage for termination');
      } catch (error) {
        Logger.debug('Could not load session from storage:', error.message);
      }
    }
    
    if (sessionToTerminate) {
      try {
        // Get PIN from session storage for authentication
        const pin = await storage.getPin();
        if (!pin) {
          Logger.debug('No PIN available for session termination');
        } else {
          const nodeUrl = await storage.getNodeUrl();
          const api = new NexusAPI(nodeUrl);
          const response = await api.request('sessions/terminate/local', { 
            pin: pin,
            session: sessionToTerminate 
          });
          Logger.info('Nexus session terminated:', reason);
        }
      } catch (error) {
        Logger.error('Failed to terminate Nexus session:', error.message);
        Logger.warn('Local storage will be cleared anyway for security');
        // Continue with storage cleanup below
      }
    } else {
      Logger.debug('Skipping session termination: no active session');
    }
    
    // Step 3: SECURITY - Always clear session from local storage
    // This happens regardless of blockchain termination success
    // Local machine security takes priority over remote session cleanup
    await storage.clearSession();
    
    // Step 4: Clear any remaining session-prefixed data (fallback mode)
    if (!storage.useSessionAPI) {
      await storage.clearAllSessionData();
    }
    
    // Step 4: Reset wallet state
    if (wallet) {
      wallet.session = null;
      wallet.genesis = null;
      wallet.isLocked = true;
    }
    
    Logger.info('Session cleanup completed:', reason);
  } catch (error) {
    Logger.error('Session cleanup error:', reason, error.message);
  }
}

// Periodic cleanup of inactive dApp connections (every 5 minutes)
setInterval(async () => {
  try {
    const storage = new StorageService();
    const inactiveDomains = await storage.cleanupInactiveDomains(30 * 60 * 1000); // 30 minutes
    
    if (inactiveDomains.length > 0) {
      Logger.debug('Disconnected inactive dApps:', inactiveDomains.length);
    }
  } catch (error) {
    Logger.error('Failed to cleanup inactive dApps:', error.message);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

Logger.info('Background service worker loaded');
