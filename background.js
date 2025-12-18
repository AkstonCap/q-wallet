// Background Service Worker
// Handles background processes, message passing, and dApp connections

// Import services
importScripts('services/nexus-api.js', 'services/storage.js', 'services/wallet.js');

let wallet;
const pendingApprovals = new Map(); // Store pending connection approval requests
const pendingTransactionApprovals = new Map(); // Store pending transaction approval requests
const recentTransactionRequests = new Map(); // Track recent transaction requests to prevent duplicates
const recentConnectionRequests = new Map(); // Track recent connection requests to prevent duplicates

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

// Ensure wallet is properly initialized
async function ensureWalletInitialized() {
  if (!wallet) {
    console.log('Creating new wallet instance');
    wallet = new WalletService();
    await wallet.initialize();
  } else if (!wallet.session) {
    // Wallet exists but session might not be loaded - reinitialize to load from storage
    console.log('Wallet exists but no session - reinitializing');
    await wallet.initialize();
  }
  return wallet;
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('=== Message received in background ===');
  console.log('Message type:', request.type);
  console.log('Message method:', request.method);
  console.log('Sender tab:', sender.tab?.id);
  console.log('Sender URL:', sender.url);
  console.log('Full request:', request);
  
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
    console.log('=== TRANSACTION_APPROVAL_RESPONSE received ===');
    console.log('RequestId:', requestId);
    console.log('Approved:', approved);
    console.log('Has PIN:', !!pin);
    console.log('TransactionData:', transactionData);
    console.log('Pending approvals map size:', pendingTransactionApprovals.size);
    console.log('Pending approvals has this requestId:', pendingTransactionApprovals.has(requestId));
    
    const pending = pendingTransactionApprovals.get(requestId);
    if (pending) {
      console.log('Found pending approval, resolving...');
      // Resolve the promise with approval status, PIN, and window info
      pending.resolve({ 
        approved, 
        pin, 
        transactionData,
        requestId: pending.requestId,
        windowId: pending.windowId
      });
      pendingTransactionApprovals.delete(requestId);
      console.log('Pending approval resolved and deleted');
      
      // Don't close the window yet - wait for transaction result to be displayed
    } else {
      console.error('No pending approval found for requestId:', requestId);
    }
    
    sendResponse({ success: true });
    return true; // Early return - don't process this message further
  }
  
  // Handle normal messages (only if not already handled above)
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
  
  // Guard against messages without method (e.g., internal extension messages)
  if (!method) {
    console.warn('Message received without method property:', request);
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
      console.log('=== wallet.login received in background ===');
      console.log('Username:', params.username);
      console.log('Attempting login...');
      const loginResult = await wallet.login(params.username, params.password, params.pin);
      console.log('Login successful!');
      console.log('Session established:', !!wallet.session);
      console.log('Username:', wallet.username);
      console.log('Is locked:', wallet.isLocked);
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
      console.log('=== dapp.sendTransaction case triggered ===');
      console.log('Sender:', sender);
      console.log('Params:', params);
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      // Request transaction approval from user with PIN
      return await handleDAppTransaction(params);
    
    case 'dapp.sendBatchTransactions':
      console.log('=== dapp.sendBatchTransactions case triggered ===');
      console.log('Sender:', sender);
      console.log('Params:', params);
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      // Request batch transaction approval from user with single PIN
      return await handleDAppBatchTransaction(params);

    case 'dapp.executeBatchCalls':
      console.log('=== dapp.executeBatchCalls case triggered ===');
      console.log('Sender:', sender);
      console.log('Params:', params);
      await checkDAppPermission(params.origin, sender.url);
      if (!wallet.isLoggedIn()) {
        throw new Error('Wallet not connected');
      }
      // Request batch API calls approval from user with single PIN
      return await handleDAppBatchCalls(params);

    case 'dapp.disconnect':
      console.log('=== dapp.disconnect case triggered ===');
      console.log('Sender:', sender);
      console.log('Origin:', params.origin);
      // Allow site to disconnect itself without approval
      return await handleDAppDisconnect(params.origin, sender.url);

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
  
  console.log('=== handleDAppConnection called ===');
  console.log('Origin:', origin);
  console.log('Sender URL:', senderUrl);
  console.log('Identifier:', identifier);
  console.log('Wallet exists before init:', !!wallet);
  
  // Ensure wallet is properly initialized with session data
  await ensureWalletInitialized();
  
  console.log('After ensureWalletInitialized:');
  console.log('  - Wallet isLoggedIn:', wallet.isLoggedIn());
  console.log('  - Wallet session:', wallet.session ? '[EXISTS]' : 'null');
  console.log('  - Wallet username:', wallet.username);
  
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
    console.log('Connection request already pending for:', identifier, 'waiting for result...');
    // Wait for the existing request to complete instead of throwing error
    return existingPending;
  }
  
  // Create a promise for this connection request
  const connectionPromise = (async () => {
    try {
      // Request user approval via notification
      const approved = await requestUserApproval(identifier);
      
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
      console.warn('Duplicate transaction request detected and ignored:', requestKey);
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
  console.log('Requesting transaction approval...');
  const approval = await requestTransactionApproval({
    origin,
    from: fromAccount,
    to,
    amount: numAmount,
    reference: validatedReference
  });
  
  console.log('=== Approval received ===');
  console.log('Approval:', approval);
  
  if (!approval.approved) {
    console.log('Transaction was rejected by user');
    throw new Error('Transaction rejected by user');
  }
  
  if (!approval.pin) {
    console.log('ERROR: No PIN in approval');
    throw new Error('PIN is required for transaction');
  }
  
  console.log('=== Executing transaction ===');
  console.log('From:', approval.transactionData.from);
  console.log('Amount:', approval.transactionData.amount);
  console.log('To:', approval.transactionData.to);
  console.log('Reference:', approval.transactionData.reference);
  console.log('Wallet session:', wallet.session);
  console.log('Wallet isLocked:', wallet.isLocked);
  
  // Verify wallet state
  if (!wallet.session) {
    throw new Error('Wallet session not available. Please log in again.');
  }
  
  // Execute transaction with user-provided PIN
  let result;
  let error;
  
  try {
    console.log('Calling wallet.send()...');
    result = await wallet.send(
      approval.transactionData.from,
      approval.transactionData.amount,
      approval.transactionData.to,
      approval.pin,
      approval.transactionData.reference || undefined
    );
    console.log('=== Transaction successful ===');
    console.log('Result:', result);
  } catch (err) {
    console.error('=== Transaction failed ===');
    console.error('Error:', err);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
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
      console.log('Could not broadcast result:', err.message);
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
  
  console.log('=== handleDAppBatchTransaction called ===');
  console.log('Origin:', origin);
  console.log('Number of transactions:', transactions?.length);
  console.log('Transactions:', transactions);
  
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
  console.log('Requesting batch transaction approval...');
  const approval = await requestBatchTransactionApproval({
    origin,
    transactions
  });
  
  console.log('=== Batch approval received ===');
  console.log('Approval:', approval);
  
  if (!approval.approved) {
    console.log('Batch transaction was rejected by user');
    throw new Error('Batch transaction rejected by user');
  }
  
  if (!approval.pin) {
    console.log('ERROR: No PIN in approval');
    throw new Error('PIN is required for transactions');
  }
  
  // Verify wallet state
  if (!wallet.session) {
    throw new Error('Wallet session not available. Please log in again.');
  }
  
  // Execute all transactions
  console.log('=== Executing batch transactions ===');
  const results = [];
  const errors = [];
  
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    console.log(`Executing transaction ${i + 1}/${transactions.length}:`, tx);
    
    try {
      const result = await wallet.send(
        tx.from,
        tx.amount,
        tx.to,
        approval.pin,
        tx.reference || undefined
      );
      console.log(`Transaction ${i + 1} successful:`, result);
      results.push({ success: true, result, index: i });
    } catch (err) {
      console.error(`Transaction ${i + 1} failed:`, err.message);
      errors.push({ success: false, error: err.message, index: i });
      
      // Optionally stop on first error
      // You can change this behavior if you want to continue with remaining transactions
      results.push({ success: false, error: err.message, index: i });
      break; // Stop on first error
    }
  }
  
  // Send result back to popup window
  if (approval.requestId) {
    console.log('Broadcasting batch transaction results:', { 
      requestId: approval.requestId, 
      totalSuccessful: results.filter(r => r.success).length,
      totalFailed: errors.length
    });
    chrome.runtime.sendMessage({
      type: 'BATCH_TRANSACTION_RESULT',
      requestId: approval.requestId,
      success: errors.length === 0,
      results: results,
      totalTransactions: transactions.length,
      successfulTransactions: results.filter(r => r.success).length
    }).catch((err) => {
      console.log('Could not broadcast batch results:', err.message);
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
  
  console.log('=== handleDAppBatchCalls called ===');
  console.log('Origin:', origin);
  console.log('Number of calls:', calls?.length);
  console.log('Calls:', calls);
  
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
  
  // Calculate DIST service fee based on number of calls
  const distFee = 1;
  
  // Request user approval via popup
  console.log('Requesting batch API calls approval...');
  const approval = await requestBatchCallsApproval({
    origin,
    calls,
    distFee
  });
  
  console.log('=== Batch calls approval received ===');
  console.log('Approval:', approval);
  
  if (!approval.approved) {
    console.log('Batch calls rejected by user');
    throw new Error('Batch API calls rejected by user');
  }
  
  if (!approval.pin) {
    console.log('ERROR: No PIN in approval');
    throw new Error('PIN is required for API calls');
  }
  
  // Verify wallet state
  if (!wallet.session) {
    throw new Error('Wallet session not available. Please log in again.');
  }
  
  // Execute all API calls
  console.log('=== Executing batch API calls ===');
  const results = [];
  const errors = [];
  
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    console.log(`Executing call ${i + 1}/${calls.length}: ${call.endpoint}`, call.params);
    
    try {
      // Add session and pin to params
      const callParams = {
        ...call.params,
        session: wallet.session,
        pin: approval.pin
      };
      
      // Execute the API call
      const result = await wallet.api.request(call.endpoint, callParams);
      console.log(`Call ${i + 1} successful:`, result);
      results.push({ success: true, result, index: i, endpoint: call.endpoint });
    } catch (err) {
      console.error(`Call ${i + 1} failed:`, err.message);
      errors.push({ success: false, error: err.message, index: i, endpoint: call.endpoint });
      results.push({ success: false, error: err.message, index: i, endpoint: call.endpoint });
      break; // Stop on first error
    }
  }
  
  // Charge DIST service fee if any calls succeeded
  if (results.some(r => r.success)) {
    const DISTORDIA_PAYMENT_ADDRESS = ''
    try {
      await wallet.api.debit(
        DISTORDIA_PAYMENT_ADDRESS,
        distFee,
        'DIST',
        approval.pin,
        '',
        wallet.session
      );
      console.log(`DIST service fee charged: ${distFee} DIST for ${calls.length} API calls`);
    } catch (feeError) {
      console.error('Failed to charge DIST service fee:', feeError);
      // Don't fail the batch if fee payment fails
    }
  }
  
  // Send result back to popup window
  if (approval.requestId) {
    console.log('Broadcasting batch calls results:', { 
      requestId: approval.requestId, 
      totalSuccessful: results.filter(r => r.success).length,
      totalFailed: errors.length
    });
    chrome.runtime.sendMessage({
      type: 'BATCH_CALLS_RESULT',
      requestId: approval.requestId,
      success: errors.length === 0,
      results: results,
      totalCalls: calls.length,
      successfulCalls: results.filter(r => r.success).length
    }).catch((err) => {
      console.log('Could not broadcast batch calls results:', err.message);
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
      distFee: distFee
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
        console.error('Failed to create batch approval window:', chrome.runtime.lastError);
        pendingTransactionApprovals.delete(requestId);
        reject(new Error('Unable to show batch approval dialog'));
        return;
      }
      
      console.log('Batch transaction approval window created:', window.id);
      
      // Store window ID with the request
      const pending = pendingTransactionApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 3 minutes
      setTimeout(() => {
        if (pendingTransactionApprovals.has(requestId)) {
          console.warn('Batch transaction approval timed out');
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
    console.log('Requesting batch API calls approval:', batchData, 'requestId:', requestId);
    
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
      distFee: batchData.distFee
    });
    
    chrome.windows.create({
      url: `approve-batch-calls.html?${params.toString()}`,
      type: 'popup',
      width: width,
      height: height,
      focused: true
    }, (window) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to create batch calls approval window:', chrome.runtime.lastError);
        pendingTransactionApprovals.delete(requestId);
        reject(new Error('Unable to show batch calls approval dialog'));
        return;
      }
      
      console.log('Batch calls approval window created:', window.id);
      
      // Store window ID with the request
      const pending = pendingTransactionApprovals.get(requestId);
      if (pending) {
        pending.windowId = window.id;
      }
      
      // Add timeout - auto-deny after 3 minutes
      setTimeout(() => {
        if (pendingTransactionApprovals.has(requestId)) {
          console.warn('Batch calls approval timed out');
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
    console.log('Requesting transaction approval:', transactionData, 'requestId:', requestId);
    
    // Check if there's already a pending request (prevent duplicates)
    if (pendingTransactionApprovals.has(requestId)) {
      console.warn('Duplicate transaction approval request ignored:', requestId);
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
    
    // Step 1: Revoke all dApp connections
    try {
      const approvedDomains = await storage.getApprovedDomains();
      if (approvedDomains && approvedDomains.length > 0) {
        console.log(`Revoking ${approvedDomains.length} dApp connection(s) on ${reason}...`);
        for (const domain of approvedDomains) {
          await storage.removeApprovedDomain(domain);
        }
        console.log('All dApp connections revoked');
      }
    } catch (error) {
      console.error('Failed to revoke dApp connections:', error);
      // Continue with other cleanup steps
    }
    
    // Step 2: Terminate session on blockchain node (if logged in)
    // Load session from storage since wallet object might not have it
    let sessionToTerminate = wallet?.session;
    
    if (!sessionToTerminate) {
      try {
        const sessionData = await storage.getSession();
        sessionToTerminate = sessionData?.session;
        console.log('Session loaded from storage for termination:', {
          hasSessionData: !!sessionData,
          hasSession: !!sessionToTerminate
        });
      } catch (error) {
        console.log('Could not load session from storage:', error.message);
      }
    }
    
    console.log('Checking wallet state for session termination:', {
      walletExists: !!wallet,
      hasSession: !!sessionToTerminate,
      sessionValue: sessionToTerminate ? '[PRESENT]' : '[NULL]'
    });
    
    if (sessionToTerminate) {
      try {
        // Get PIN from session storage for authentication
        const pin = await storage.getPin();
        if (!pin) {
          console.log('No PIN available for session termination - session likely already terminated via logout');
        } else {
          const nodeUrl = await storage.getNodeUrl();
          const api = new NexusAPI(nodeUrl);
          console.log('Attempting to terminate Nexus session with PIN authentication...');
          // Terminate session with PIN for multi-user nodes
          const response = await api.request('sessions/terminate/local', { 
            pin: pin,
            session: sessionToTerminate 
          });
          console.log(`Session termination API response:`, response);
          console.log(`Nexus session terminated on ${reason}`);
        }
      } catch (error) {
        // SECURITY: Log error but continue with cleanup
        // Local storage must be cleared even if blockchain termination fails
        // This is critical for public computers and offline node scenarios
        console.error('Failed to terminate Nexus session:', error);
        console.warn('Local storage will be cleared anyway for security');
        console.warn('Blockchain session may remain active until it expires naturally');
        // Continue with storage cleanup below
      }
    } else {
      console.log('Skipping session termination: no active session found');
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
