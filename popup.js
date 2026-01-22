// Popup UI Controller
// Handles all UI interactions and state management

let wallet;
let currentScreen = 'login';
let autoRefreshInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize wallet service
  wallet = new WalletService();
  const isLoggedIn = await wallet.initialize();

  // Load and set saved API URL
  await loadSavedApiUrl();

  // Check if user is logged in
  if (wallet.isLoggedIn()) {
    showScreen('wallet');
    
    // Always load wallet data (balance, accounts, etc. are visible even when locked)
    await loadWalletData();
    
    if (wallet.isLocked) {
      showLockedState();
    } else {
      hideLockedState(); // Ensure locked state is hidden
      startAutoRefresh();
    }
  } else {
    showScreen('login');
    // Show and check node status on login screen initialization
    const statusContainer = document.getElementById('login-node-status');
    statusContainer.style.display = 'block';
    await checkNodeStatus('login');
  }

  // Setup event listeners
  setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
  // API service selectors
  document.getElementById('login-api-service').addEventListener('change', handleLoginApiChange);
  
  // Custom API input - check node status when user changes URL
  const customApiInput = document.getElementById('login-custom-api');
  let customApiTimeout;
  customApiInput.addEventListener('input', () => {
    clearTimeout(customApiTimeout);
    customApiTimeout = setTimeout(async () => {
      const statusContainer = document.getElementById('login-node-status');
      statusContainer.style.display = 'block';
      await checkNodeStatus('login');
    }, 500); // Debounce for 500ms
  });
  
  // Login form
  document.getElementById('login-btn').addEventListener('click', handleLogin);

  // Wallet screen
  document.getElementById('unlock-wallet-btn').addEventListener('click', showUnlockModal);
  document.getElementById('send-btn').addEventListener('click', async () => {
    showScreen('send');
    await populateSendAccounts();
  });
  document.getElementById('receive-btn').addEventListener('click', () => {
    showScreen('receive');
    showReceiveAddress();
  });
  document.getElementById('settings-btn').addEventListener('click', () => {
    showScreen('settings');
    loadSettings();
  });
  document.getElementById('refresh-btn').addEventListener('click', handleRefresh);

  // Account address copy
  document.getElementById('account-address').addEventListener('click', copyAddress);

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Send screen
  document.getElementById('back-from-send-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('confirm-send-btn').addEventListener('click', handleSend);
  document.getElementById('send-amount').addEventListener('input', updateTransactionSummary);
  document.getElementById('send-from-account').addEventListener('change', handleAccountChange);
  document.getElementById('send-to').addEventListener('input', debounce(validateRecipient, 500));

  // PIN confirmation modal
  document.getElementById('cancel-transaction-btn').addEventListener('click', closePinModal);
  document.getElementById('confirm-transaction-btn').addEventListener('click', handleConfirmTransaction);
  document.getElementById('confirm-pin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleConfirmTransaction();
    }
  });

  // Receive screen
  document.getElementById('back-from-receive-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('copy-address-btn').addEventListener('click', copyReceiveAddress);
  document.getElementById('receive-account-select').addEventListener('change', handleReceiveAccountChange);
  document.getElementById('create-account-btn').addEventListener('click', () => showScreen('create-account'));

  // Create account screen
  document.getElementById('back-from-create-account-btn').addEventListener('click', () => showScreen('receive'));
  document.getElementById('new-account-token-select').addEventListener('change', handleTokenSelectChange);
  document.getElementById('confirm-create-account-btn').addEventListener('click', handleCreateAccount);

  // Settings screen
  document.getElementById('back-from-settings-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('save-node-btn').addEventListener('click', handleSaveNode);
  document.getElementById('revoke-all-btn').addEventListener('click', handleRevokeAllConnections);
  // Lock wallet button is commented out in HTML
  // document.getElementById('lock-wallet-btn').addEventListener('click', handleLockWallet);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  
  // Node URL input in settings - check status when user changes URL
  const nodeUrlInput = document.getElementById('node-url');
  let nodeUrlTimeout;
  nodeUrlInput.addEventListener('input', () => {
    clearTimeout(nodeUrlTimeout);
    nodeUrlTimeout = setTimeout(async () => {
      await checkNodeStatus('settings');
    }, 500); // Debounce for 500ms
  });
}

// Load saved API URL and set it in the selects
async function loadSavedApiUrl() {
  const savedUrl = await wallet.getNodeUrl();
  const loginSelect = document.getElementById('login-api-service');
  
  // Check if saved URL matches one of the preset options
  const loginOptions = Array.from(loginSelect.options).map(opt => opt.value);
  
  if (loginOptions.includes(savedUrl)) {
    loginSelect.value = savedUrl;
  } else if (savedUrl && savedUrl !== 'http://localhost:8080') {
    // Custom URL
    loginSelect.value = 'custom';
    document.getElementById('login-custom-api-group').classList.remove('hidden');
    document.getElementById('login-custom-api').value = savedUrl;
  }
}

// Handle API service selection for login
async function handleLoginApiChange() {
  const select = document.getElementById('login-api-service');
  const customGroup = document.getElementById('login-custom-api-group');
  const statusContainer = document.getElementById('login-node-status');
  
  if (select.value === 'custom') {
    customGroup.classList.remove('hidden');
  } else {
    customGroup.classList.add('hidden');
  }
  
  // Show status container and check node status
  statusContainer.style.display = 'block';
  await checkNodeStatus('login');
}

// Validate node URL for security (HTTPS enforcement)
function validateNodeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a remote connection (not localhost or local network)
    const isRemote = urlObj.hostname !== 'localhost' &&
                     urlObj.hostname !== '127.0.0.1' &&
                     !urlObj.hostname.startsWith('192.168.') &&
                     !urlObj.hostname.startsWith('10.') &&
                     !urlObj.hostname.startsWith('172.16.');
    
    // SECURITY: Enforce HTTPS for remote connections
    if (isRemote && urlObj.protocol === 'http:') {
      const httpsUrl = url.replace('http://', 'https://');
      const message = `⚠️ SECURITY WARNING\n\nHTTP connections to remote servers are not secure.\n\nYour credentials and transactions could be intercepted.\n\nWould you like to use HTTPS instead?\n\nHTTP: ${url}\nHTTPS: ${httpsUrl}`;
      
      if (confirm(message)) {
        return httpsUrl;
      } else {
        throw new Error('HTTP is not allowed for remote connections. Please use HTTPS.');
      }
    }
    
    return url;
  } catch (error) {
    if (error.message.includes('HTTP is not allowed')) {
      throw error;
    }
    throw new Error('Invalid URL format. Please enter a valid URL.');
  }
}

// Get selected API URL from login form
function getLoginApiUrl() {
  const select = document.getElementById('login-api-service');
  if (select.value === 'custom') {
    const customUrl = document.getElementById('login-custom-api').value.trim();
    if (!customUrl) {
      throw new Error('Please enter a custom API URL');
    }
    return validateNodeUrl(customUrl);
  }
  return select.value;
}

// Handle login
async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const pin = document.getElementById('login-pin').value;

  if (!username || !password || !pin) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  showLoading('Logging in...');

  try {
    // Set the selected API URL before login
    const apiUrl = getLoginApiUrl();
    await wallet.updateNodeUrl(apiUrl);
    
    // Create session and unlock it (login attempts to unlock automatically)
    const loginResult = await wallet.login(username, password, pin);
    
    // Move to wallet UI and load data
    showScreen('wallet');
    hideLoading();
    showNotification('Login successful!', 'success');
    
    await loadWalletData();
    
    if (wallet.isLocked) {
      showLockedState();
    } else {
      hideLockedState(); // Ensure locked state is hidden
      startAutoRefresh();
    }
    
    // SECURITY: Clear sensitive data
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-pin').value = '';
  } catch (error) {
    console.error('Login failed:', error);
    showNotification('Login failed: ' + error.message, 'error');
    hideLoading();
    
    // SECURITY: Rate limiting - disable login button for 2 seconds after failed attempt
    const loginBtn = document.getElementById('login-btn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Wait 2s...';
    
    setTimeout(() => {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }, 2000);
    
    // Clear password and PIN on error too
    document.getElementById('login-password').value = '';
    document.getElementById('login-pin').value = '';
  }
}

// Handle create wallet
async function handleCreateWallet() {
  const username = document.getElementById('create-username').value.trim();
  const password = document.getElementById('create-password').value;
  const passwordConfirm = document.getElementById('create-password-confirm').value;
  const pin = document.getElementById('create-pin').value;
  const pinConfirm = document.getElementById('create-pin-confirm').value;

  // Validation
  if (!username || !password || !pin) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  if (password.length < 8) {
    showNotification('Password must be at least 8 characters', 'error');
    return;
  }

  if (password !== passwordConfirm) {
    showNotification('Passwords do not match', 'error');
    return;
  }

  if (pin !== pinConfirm) {
    showNotification('PINs do not match', 'error');
    return;
  }

  if (!/^\d{4,8}$/.test(pin)) {
    showNotification('PIN must be 4-8 digits', 'error');
    return;
  }

  showLoading('Creating wallet...');

  try {
    // Set the selected API URL before creating wallet
    const apiUrl = getCreateApiUrl();
    await wallet.updateNodeUrl(apiUrl);
    
    // Create wallet and save session (locked)
    await wallet.createWallet(username, password, pin);
    
    // SECURITY: Clear sensitive data immediately after wallet creation
    document.getElementById('create-username').value = '';
    document.getElementById('create-password').value = '';
    document.getElementById('create-password-confirm').value = '';
    document.getElementById('create-pin').value = '';
    document.getElementById('create-pin-confirm').value = '';
    
    // Move to wallet UI immediately
    showScreen('wallet');
    hideLoading();
    showNotification('Wallet created successfully!', 'success');
    
    // Unlock session and load data in background
    try {
      await wallet.unlock(pin);
      await loadWalletData();
    } catch (unlockError) {
      console.error('Failed to unlock session or load data:', unlockError);
      showNotification('Warning: Some features may be unavailable.', 'warning');
    }
  } catch (error) {
    showNotification('Failed to create wallet: ' + error.message, 'error');
    hideLoading();
    // Clear passwords and PINs on error too
    document.getElementById('create-password').value = '';
    document.getElementById('create-password-confirm').value = '';
    document.getElementById('create-pin').value = '';
    document.getElementById('create-pin-confirm').value = '';
  }
}

// Load wallet data
async function loadWalletData() {
  try {
    const walletInfo = wallet.getWalletInfo();
    
    // Update account info
    document.getElementById('account-name').textContent = walletInfo.username || 'Default Account';
    
    // Show quantum security badge when logged in
    const quantumBadge = document.getElementById('quantum-badge');
    if (quantumBadge) {
      quantumBadge.style.display = 'flex';
    }
    
    // Get all accounts (each token has its own account with unique address)
    const accounts = await wallet.listAccounts();
    
    // Check if accounts is an array
    if (!Array.isArray(accounts)) {
      console.error('Expected accounts to be an array, got:', typeof accounts, accounts);
      throw new Error('Invalid accounts response from API');
    }
    
    // Find the default NXS account for main display (for address)
    const defaultAccount = accounts.find(acc => acc.name === 'default' && (acc.token === '0' || acc.ticker === 'NXS'));
    
    if (defaultAccount) {
      const truncatedAddress = truncateAddress(defaultAccount.address);
      document.getElementById('address-text').textContent = truncatedAddress;
      document.getElementById('address-text').setAttribute('data-full-address', defaultAccount.address);
    } else {
      console.warn('No default NXS account found in accounts:', accounts);
      // Show first account if available
      if (accounts.length > 0) {
        const firstAccount = accounts[0];
        const truncatedAddress = truncateAddress(firstAccount.address);
        document.getElementById('address-text').textContent = truncatedAddress;
        document.getElementById('address-text').setAttribute('data-full-address', firstAccount.address);
      }
    }

    // Get total NXS balance across all accounts
    try {
      const totalBalance = await wallet.getTotalNXSBalance();
      document.getElementById('balance-amount').textContent = formatAmount(totalBalance);
    } catch (error) {
      console.error('Failed to get total NXS balance:', error);
      // Fallback to default account balance if total query fails
      if (defaultAccount) {
        document.getElementById('balance-amount').textContent = formatAmount(defaultAccount.balance);
      } else {
        document.getElementById('balance-amount').textContent = formatAmount(0);
      }
    }

    // Load tokens list using balances API
    await loadTokensList();

    // Load transactions
    await loadTransactions();
  } catch (error) {
    console.error('Failed to load wallet data:', error);
    console.error('Error details:', error.message, error.stack);
    showNotification('Failed to load wallet data: ' + error.message, 'error');
  }
}

// Load transactions
async function loadTransactions() {
  try {
    // Fetch transactions from all accounts (pass null to get all)
    const transactions = await wallet.getTransactions(null, 50);
    const container = document.getElementById('transactions-list');

    if (!transactions || transactions.length === 0) {
      container.textContent = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.textContent = 'No transactions yet';
      container.appendChild(emptyDiv);
      return;
    }

    container.textContent = '';
    
    // Only show the last 12 transactions
    const limitedTransactions = transactions.slice(0, 12);
    
    limitedTransactions.forEach(tx => {
      const item = createTransactionItem(tx);
      container.appendChild(item);
    });
    
    // Show indicator if there are more transactions
    if (transactions.length > 12) {
      const moreIndicator = document.createElement('div');
      moreIndicator.className = 'more-transactions-indicator';
      moreIndicator.textContent = `+${transactions.length - 12} more transactions`;
      container.appendChild(moreIndicator);
    }
  } catch (error) {
    console.error('Failed to load transactions:', error);
  }
}

// Check node status
async function checkNodeStatus(context = 'login') {
  // Determine which elements to use based on context
  const prefix = context === 'settings' ? 'settings-' : 'login-';
  const indicator = document.getElementById(`${prefix}status-indicator`);
  const statusText = document.getElementById(`${prefix}status-text`);
  const statusDetails = document.getElementById(`${prefix}status-details`);
  
  if (!indicator || !statusText || !statusDetails) {
    console.error('Node status elements not found for context:', context);
    return;
  }

  try {
    let nodeUrl = context === 'settings' 
      ? document.getElementById('node-url').value.trim()
      : (document.getElementById('login-api-service').value === 'custom' 
          ? document.getElementById('login-custom-api').value.trim()
          : document.getElementById('login-api-service').value);
    
    if (!nodeUrl) {
      indicator.textContent = '🔴';
      indicator.title = 'No node URL specified';
      statusText.textContent = 'No URL';
      statusText.style.color = '#f44336';
      statusDetails.textContent = '';
      return;
    }

    // Add protocol if missing (default to http)
    if (!nodeUrl.startsWith('http://') && !nodeUrl.startsWith('https://')) {
      nodeUrl = 'http://' + nodeUrl;
    }

    // Check if this is a blocked HTTP remote connection
    const urlObj = new URL(nodeUrl);
    const isRemote = urlObj.hostname !== 'localhost' &&
                     urlObj.hostname !== '127.0.0.1' &&
                     !urlObj.hostname.startsWith('192.168.') &&
                     !urlObj.hostname.startsWith('10.') &&
                     !urlObj.hostname.startsWith('172.16.');
    const isHttp = urlObj.protocol === 'http:';
    
    // Test node connectivity with direct fetch (bypassing NexusAPI validation)
    const response = await fetch(`${nodeUrl}/system/get/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const info = await response.json();
    
    if (info.error) {
      throw new Error(info.error.message || 'API Error');
    }

    // If it's a remote HTTP node, show warning
    if (isRemote && isHttp) {
      indicator.textContent = '🔴';
      indicator.title = 'HTTP connections to remote nodes are blocked for security';
      statusText.textContent = 'HTTP blocked';
      statusText.style.color = '#f44336';
      statusDetails.textContent = 'Not secure';
      return;
    }
    
    // Get sync status flags
    const synchronized = info.result?.synchronized || false;
    const syncing = info.result?.syncing || false;
    const blocks = info.result?.blocks || 0;
    
    // Determine status based on synchronized and syncing flags
    // Green: synchronized is true
    // Yellow: synchronized is false and syncing is true
    // Red: error or neither condition met
    
    if (synchronized) {
      indicator.textContent = '🟢';
      indicator.title = 'Node is synchronized';
      statusText.textContent = 'Synced';
      statusText.style.color = '#4caf50';
      statusDetails.textContent = `Block ${blocks.toLocaleString()}`;
    } else if (syncing) {
      indicator.textContent = '🟡';
      indicator.title = 'Node is syncing';
      statusText.textContent = 'Syncing';
      statusText.style.color = '#ff9800';
      statusDetails.textContent = `Block ${blocks.toLocaleString()}`;
    } else {
      indicator.textContent = '🔴';
      indicator.title = 'Node is not synchronized';
      statusText.textContent = 'Out of sync';
      statusText.style.color = '#f44336';
      statusDetails.textContent = '';
    }
    
  } catch (error) {
    console.error('Failed to check node status:', error);
    indicator.textContent = '🔴';
    indicator.title = 'Unable to connect to node';
    statusText.textContent = 'Offline';
    statusText.style.color = '#f44336';
    statusDetails.textContent = '';
  }
}

// Manual refresh handler
async function handleRefresh() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.classList.add('spinning');
  
  try {
    await loadWalletData();
    showNotification('Wallet refreshed', 'success');
  } catch (error) {
    console.error('Failed to refresh:', error);
    showNotification('Failed to refresh wallet', 'error');
  } finally {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
  }
}

// Start auto-refresh (every 30 seconds)
function startAutoRefresh() {
  stopAutoRefresh(); // Clear any existing interval
  autoRefreshInterval = setInterval(async () => {
    if (currentScreen === 'wallet' && wallet.isLoggedIn() && !wallet.isLocked) {
      try {
        await loadWalletData();
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }
  }, 30 * 1000); // 30 seconds
}

// Stop auto-refresh
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Load tokens list with balances
async function loadTokensList() {
  const container = document.getElementById('tokens-list');
  
  try {
    // Get balances using finance/get/balances
    const balances = await wallet.getAllBalances();
    console.log('Tokens list - balances response:', balances);
    
    const balanceArray = balances.result || balances;
    console.log('Tokens list - balance array:', balanceArray);
    
    if (!balanceArray || (Array.isArray(balanceArray) && balanceArray.length === 0)) {
      container.textContent = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.textContent = 'No tokens found';
      container.appendChild(emptyDiv);
      return;
    }
    
    // Filter out NXS (ticker === 'NXS')
    const tokens = Array.isArray(balanceArray) 
      ? balanceArray.filter(b => b.ticker !== 'NXS')
      : (balanceArray.ticker !== 'NXS' ? [balanceArray] : []);
    
    console.log('Tokens list - filtered tokens:', tokens);
    
    if (tokens.length === 0) {
      container.textContent = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.textContent = 'No tokens found';
      container.appendChild(emptyDiv);
      return;
    }

    container.textContent = '';
    
    // Display each token with total balance
    tokens.forEach(token => {
      const item = document.createElement('div');
      item.className = 'token-item';
      
      const tokenInfo = document.createElement('div');
      tokenInfo.className = 'token-info';
      
      const tokenName = document.createElement('div');
      tokenName.className = 'token-name';
      tokenName.textContent = token.ticker || 'Unknown';
      
      const tokenDesc = document.createElement('div');
      tokenDesc.className = 'token-desc';
      tokenDesc.textContent = token.token ? truncateAddress(token.token) : 'Token';
      
      tokenInfo.appendChild(tokenName);
      tokenInfo.appendChild(tokenDesc);
      
      // Calculate total balance: confirmed + unconfirmed + unclaimed + stake
      const confirmed = token.confirmed || 0;
      const unconfirmed = token.unconfirmed || 0;
      const unclaimed = token.unclaimed || 0;
      const stake = token.stake || 0;
      const totalBalance = confirmed + unconfirmed + unclaimed + stake;
      
      const tokenBalance = document.createElement('div');
      tokenBalance.className = 'token-balance';
      tokenBalance.textContent = formatAmount(totalBalance);
      
      item.appendChild(tokenInfo);
      item.appendChild(tokenBalance);
      container.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to load tokens list:', error);
    container.textContent = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'empty-state';
    errorDiv.textContent = 'Failed to load tokens';
    container.appendChild(errorDiv);
  }
}

// Create transaction item element
function createTransactionItem(tx) {
  const div = document.createElement('div');
  div.className = 'transaction-item';
  
  // Nexus transactions can have multiple contracts
  // We need to analyze the contracts to determine the transaction type
  let txType = 'unknown';
  let amount = 0;
  let ticker = 'NXS';
  let isIncoming = false;
  
  if (tx.contracts && tx.contracts.length > 0) {
    const contract = tx.contracts[0]; // Use first contract for display
    const op = contract.OP;
    
    // Get amount and ticker from contract
    amount = contract.amount || 0;
    ticker = contract.ticker || 'NXS';
    
    // Determine transaction type based on OP code
    switch (op) {
      case 'CREATE':
        txType = 'Account Created';
        break;
      case 'DEBIT':
        // DEBIT means we sent funds
        txType = 'Sent';
        isIncoming = false;
        break;
      case 'CREDIT':
        // CREDIT means we received/claimed funds
        txType = 'Received';
        isIncoming = true;
        break;
      case 'COINBASE':
        txType = 'Mining Reward';
        isIncoming = true;
        break;
      case 'GENESIS':
        txType = 'Genesis';
        isIncoming = true;
        break;
      case 'TRUST':
        txType = 'Trust';
        break;
      case 'STAKE':
        txType = 'Stake';
        break;
      case 'UNSTAKE':
        txType = 'Unstake';
        isIncoming = true;
        break;
      case 'LEGACY':
        txType = 'Legacy';
        break;
      default:
        txType = op;
    }
  } else {
    // Fallback to old logic if no contracts
    const type = tx.type || (tx.OP === 'DEBIT' ? 'send' : 'receive');
    isIncoming = type === 'receive' || tx.OP === 'CREDIT';
    amount = tx.amount || 0;
    txType = isIncoming ? 'Received' : 'Sent';
  }
  
  // Special handling for CREATE operations (no amount display)
  const showAmount = amount > 0;
  
  // Build transaction item safely using DOM nodes
  const icon = document.createElement('div');
  icon.className = `transaction-icon ${isIncoming ? 'receive' : 'send'}`;
  icon.textContent = isIncoming ? '↓' : '↑';
  
  const details = document.createElement('div');
  details.className = 'transaction-details';
  
  const type = document.createElement('div');
  type.className = 'transaction-type';
  type.textContent = txType;
  
  const date = document.createElement('div');
  date.className = 'transaction-date';
  date.textContent = formatDate(tx.timestamp || Date.now());
  
  details.appendChild(type);
  details.appendChild(date);
  
  const amountDiv = document.createElement('div');
  amountDiv.className = `transaction-amount ${isIncoming ? 'positive' : 'negative'}`;
  amountDiv.textContent = showAmount ? (isIncoming ? '+' : '-') + formatAmount(amount) + ' ' + ticker : '—';
  
  div.appendChild(icon);
  div.appendChild(details);
  div.appendChild(amountDiv);
  
  return div;
}

// Validate recipient address or username
async function validateRecipient() {
  const recipientInput = document.getElementById('send-to').value.trim();
  const validationMessage = document.getElementById('recipient-validation');
  const fromAccountSelect = document.getElementById('send-from-account');
  
  // Clear validation if input is empty
  if (!recipientInput) {
    validationMessage.textContent = '';
    validationMessage.className = 'validation-message';
    return;
  }
  
  // Get sender's token type
  const selectedOption = fromAccountSelect.options[fromAccountSelect.selectedIndex];
  const senderToken = selectedOption?.dataset.token || '0';
  
  validationMessage.textContent = 'Checking...';
  validationMessage.className = 'validation-message checking';
  
  try {
    // Try to get account by address/name
    const recipientAccount = await wallet.api.getAccountByAddress(recipientInput);
    
    if (!recipientAccount) {
      validationMessage.textContent = '⚠ Account not found';
      validationMessage.className = 'validation-message error';
      return;
    }
    
    // Check if token types match
    const recipientToken = recipientAccount.token || '0';
    
    if (senderToken !== recipientToken) {
      const senderTokenName = senderToken === '0' ? 'NXS' : senderToken;
      const recipientTokenName = recipientToken === '0' ? 'NXS' : recipientToken;
      validationMessage.textContent = `✗ Token mismatch: sending ${senderTokenName} to ${recipientTokenName} account`;
      validationMessage.className = 'validation-message error';
      return;
    }
    
    // Valid recipient
    const tokenName = recipientToken === '0' ? 'NXS' : (recipientAccount.ticker || 'token');
    validationMessage.textContent = `✓ Valid ${tokenName} account`;
    validationMessage.className = 'validation-message success';
    
  } catch (error) {
    console.error('Recipient validation error:', error);
    validationMessage.textContent = '⚠ Unable to validate';
    validationMessage.className = 'validation-message warning';
  }
}

// Handle send transaction
async function handleSend() {
  const accountName = document.getElementById('send-from-account').value;
  const recipient = document.getElementById('send-to').value.trim();
  const amount = document.getElementById('send-amount').value;
  const reference = document.getElementById('send-reference').value.trim();

  if (!accountName) {
    showNotification('Please select an account to send from', 'error');
    return;
  }

  if (!recipient || !amount) {
    showNotification('Please enter recipient and amount', 'error');
    return;
  }

  if (parseFloat(amount) <= 0) {
    showNotification('Amount must be greater than 0', 'error');
    return;
  }

  // Validate recipient account before proceeding
  const validationMessage = document.getElementById('recipient-validation');
  const validationClass = validationMessage.className;
  
  // Check if validation has run and was successful
  if (!validationClass.includes('success')) {
    if (validationClass.includes('error')) {
      showNotification('Invalid recipient account. Please check the address or name.', 'error');
    } else if (validationClass.includes('warning')) {
      showNotification('Unable to validate recipient account. Please verify and try again.', 'error');
    } else {
      // Validation hasn't run yet, trigger it and wait
      showNotification('Validating recipient account...', 'info');
      await validateRecipient();
      
      // Re-check validation result
      const newValidationClass = document.getElementById('recipient-validation').className;
      if (!newValidationClass.includes('success')) {
        showNotification('Invalid recipient account. Please check the address or name.', 'error');
        return;
      }
    }
    return;
  }

  // Show PIN confirmation modal with transaction details
  showPinModal(accountName, recipient, amount, reference);
}

// Show PIN confirmation modal
function showPinModal(fromAccount, toAddress, amount, reference) {
  const select = document.getElementById('send-from-account');
  const selectedOption = select.options[select.selectedIndex];
  const ticker = selectedOption.dataset.ticker || 'Unknown';
  const isNXS = ticker === 'NXS';
  const isUSDD = ticker === 'USDD';
  
  // Calculate Distordia service fee (only for NXS/USDD amounts > 1)
  const parsedAmount = parseFloat(amount);
  let distordiaFee = 0;
  let feeInToken = false;
  
  if (isNXS && parsedAmount > 1) {
    // NXS: 0.1% of amount (only for amounts > 1 NXS), minimum 0.000001 NXS
    distordiaFee = Math.max(parsedAmount * 0.001, 0.000001);
    feeInToken = false;
  } else if (isUSDD && parsedAmount > 1) {
    // USDD: 0.1% of amount in USDD (only for amounts > 1 USDD), minimum 0.0001 USDD
    distordiaFee = Math.max(parsedAmount * 0.001, 0.0001);
    feeInToken = true;
  } else {
    // Other tokens or small amounts: No Distordia fee
    distordiaFee = 0;
  }
  
  // Nexus transaction fee (for multiple transactions within 10 seconds)
  const nexusFee = 0.01;
  const totalNXSFees = feeInToken ? nexusFee : (distordiaFee + nexusFee);
  
  let total;
  if (isNXS) {
    total = parsedAmount + distordiaFee + nexusFee;
  } else if (isUSDD) {
    total = parsedAmount + distordiaFee;
  } else {
    total = parsedAmount;
  }
  
  // Populate modal with transaction details
  document.getElementById('modal-from-account').textContent = `${fromAccount} (${ticker})`;
  document.getElementById('modal-to-address').textContent = toAddress;
  document.getElementById('modal-to-address').title = toAddress; // Full address on hover
  document.getElementById('modal-amount').textContent = `${formatAmount(amount)} ${ticker}`;
  
  // Update fee row based on token type and amount
  if (isNXS && distordiaFee > 0) {
    document.getElementById('modal-fee').textContent = `${formatAmount(totalNXSFees)} NXS`;
    document.getElementById('modal-fee-details').textContent = `Nexus: ${formatAmount(nexusFee)} + Service: ${formatAmount(distordiaFee)}`;
  } else if (isNXS) {
    // NXS but amount <= 1, no service fee, congestion fee might apply
    document.getElementById('modal-fee').textContent = 'None';
    document.getElementById('modal-fee-details').textContent = '(0.01 NXS congestion fee might apply)';
  } else if (isUSDD && distordiaFee > 0) {
    document.getElementById('modal-fee').textContent = `${formatAmount(distordiaFee)} ${ticker} + ${formatAmount(nexusFee)} NXS`;
    document.getElementById('modal-fee-details').textContent = `Service: ${formatAmount(distordiaFee)} ${ticker} + Nexus: ${formatAmount(nexusFee)} NXS`;
  } else if (isUSDD) {
    // USDD but amount <= 1, no service fee, congestion fee might apply
    document.getElementById('modal-fee').textContent = 'None';
    document.getElementById('modal-fee-details').textContent = '(0.01 NXS congestion fee might apply)';
  } else {
    // Other tokens: no fees
    document.getElementById('modal-fee').textContent = 'None';
    document.getElementById('modal-fee-details').textContent = '(No service fee for this token)';
  }
  
  // Update total
  if (isNXS && distordiaFee > 0) {
    document.getElementById('modal-total').textContent = `${formatAmount(total)} NXS`;
  } else if (isNXS) {
    // NXS amount <= 1, show just the amount (congestion fee might not apply)
    document.getElementById('modal-total').textContent = `${formatAmount(parsedAmount)} NXS`;
  } else if (isUSDD && distordiaFee > 0) {
    document.getElementById('modal-total').textContent = `${formatAmount(total)} USDD + ${formatAmount(nexusFee)} NXS`;
  } else if (isUSDD) {
    // USDD amount <= 1, show just the amount (congestion fee might not apply)
    document.getElementById('modal-total').textContent = `${formatAmount(parsedAmount)} USDD`;
  } else {
    document.getElementById('modal-total').textContent = `${formatAmount(amount)} ${ticker}`;
  }
  
  // Show/hide reference row
  const referenceRow = document.getElementById('modal-reference-row');
  if (reference) {
    document.getElementById('modal-reference').textContent = reference;
    referenceRow.style.display = 'flex';
  } else {
    referenceRow.style.display = 'none';
  }
  
  // Clear PIN input
  document.getElementById('confirm-pin').value = '';
  
  // Store transaction data for confirmation
  window.pendingTransaction = {
    fromAccount,
    toAddress,
    amount,
    reference
  };
  
  // Show modal
  document.getElementById('pin-modal').classList.remove('hidden');
  document.getElementById('confirm-pin').focus();
}

// Close PIN modal
function closePinModal() {
  document.getElementById('pin-modal').classList.add('hidden');
  document.getElementById('confirm-pin').value = '';
  window.pendingTransaction = null;
}

// Handle transaction confirmation with PIN
async function handleConfirmTransaction() {
  const pin = document.getElementById('confirm-pin').value;
  
  if (!pin || pin.length < 4) {
    showNotification('Please enter a valid PIN (at least 4 digits)', 'error');
    return;
  }
  
  if (!window.pendingTransaction) {
    showNotification('No pending transaction', 'error');
    closePinModal();
    return;
  }
  
  const { fromAccount, toAddress, amount, reference } = window.pendingTransaction;
  
  // Close modal and show loading
  closePinModal();
  showLoading('Sending transaction...');

  try {
    // Send transaction with PIN
    await wallet.send(fromAccount, amount, toAddress, pin, reference);
    
    // Clear PIN from memory
    document.getElementById('confirm-pin').value = '';
    
    showNotification('Transaction sent successfully!', 'success');
    
    // Clear form
    document.getElementById('send-to').value = '';
    document.getElementById('send-amount').value = '';
    document.getElementById('send-reference').value = '';
    
    // Return to wallet screen and refresh
    showScreen('wallet');
    await loadWalletData();
  } catch (error) {
    // Clear PIN on error too
    document.getElementById('confirm-pin').value = '';
    
    showNotification('Failed to send: ' + error.message, 'error');
  } finally {
    hideLoading();
    window.pendingTransaction = null;
  }
}

// Update send available balance
// Populate send accounts dropdown
async function populateSendAccounts() {
  try {
    const accounts = await wallet.listAccounts();
    const select = document.getElementById('send-from-account');
    
    // Clear existing options except the first one
    select.textContent = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select account...';
    select.appendChild(placeholderOption);
    
    // Add each account as an option
    accounts.forEach(account => {
      const option = document.createElement('option');
      option.value = account.name;
      option.textContent = `${account.ticker || 'Unknown'} - ${account.name} (${formatAmount(account.balance || 0)})`;
      option.dataset.balance = account.balance || 0;
      option.dataset.ticker = account.ticker || 'Unknown';
      option.dataset.decimals = account.decimals || 6;
      option.dataset.token = account.token || '0'; // Store token address for validation
      select.appendChild(option);
    });
    
    // Select default account if available
    const defaultOption = Array.from(select.options).find(opt => opt.value === 'default');
    if (defaultOption) {
      select.value = 'default';
      handleAccountChange();
    }
  } catch (error) {
    console.error('Failed to populate accounts:', error);
    showNotification('Failed to load accounts', 'error');
  }
}

// Handle account selection change
function handleAccountChange() {
  const select = document.getElementById('send-from-account');
  const selectedOption = select.options[select.selectedIndex];
  
  if (!selectedOption || !selectedOption.value) {
    return;
  }
  
  const balance = parseFloat(selectedOption.dataset.balance) || 0;
  const ticker = selectedOption.dataset.ticker || 'NXS';
  const decimals = parseInt(selectedOption.dataset.decimals) || 6;
  
  // Update available balance display
  document.getElementById('send-available').textContent = formatAmount(balance);
  document.getElementById('send-available-ticker').textContent = ticker;
  document.getElementById('send-currency').textContent = ticker;
  
  // Update amount input step based on decimals
  const step = 1 / Math.pow(10, decimals);
  document.getElementById('send-amount').step = step.toString();
  
  // Update transaction summary
  updateTransactionSummary();
}

// Update transaction summary
function updateTransactionSummary() {
  const amount = parseFloat(document.getElementById('send-amount').value) || 0;
  const select = document.getElementById('send-from-account');
  const selectedOption = select.options[select.selectedIndex];
  const ticker = selectedOption.dataset.ticker || 'NXS';
  const isNXS = ticker === 'NXS';
  const isUSDD = ticker === 'USDD';
  
  // Calculate Distordia service fee (only for NXS/USDD amounts > 1)
  let distordiaFee = 0;
  let feeInToken = false;
  
  if (isNXS && amount > 1) {
    // NXS: 0.1% of amount (only for amounts > 1 NXS), minimum 0.000001 NXS
    distordiaFee = Math.max(amount * 0.001, 0.000001);
    feeInToken = false;
  } else if (isUSDD && amount > 1) {
    // USDD: 0.1% of amount in USDD (only for amounts > 1 USDD), minimum 0.0001 USDD
    distordiaFee = Math.max(amount * 0.001, 0.0001);
    feeInToken = true;
  } else {
    // Other tokens or small amounts: No Distordia fee
    distordiaFee = 0;
  }
  
  // Nexus transaction fee (for multiple transactions within 10 seconds)
  const nexusFee = 0.01;
  
  // Calculate totals based on token type
  let total;
  let feeDisplay;
  let feeDetails;
  let totalDisplay;
  
  if (isNXS && distordiaFee > 0) {
    const totalNXSFees = distordiaFee + nexusFee;
    total = amount + totalNXSFees;
    feeDisplay = formatAmount(totalNXSFees) + ' NXS';
    feeDetails = '(Nexus: ' + formatAmount(nexusFee) + ' + Service: ' + formatAmount(distordiaFee) + ')';
    totalDisplay = formatAmount(total) + ' NXS';
  } else if (isNXS) {
    // NXS but amount <= 1, no service fee, congestion fee might apply
    total = amount; // Don't assume congestion fee
    feeDisplay = 'None';
    feeDetails = '(0.01 NXS congestion fee might apply)';
    totalDisplay = formatAmount(amount) + ' NXS';
  } else if (isUSDD && distordiaFee > 0) {
    feeDisplay = formatAmount(distordiaFee) + ' USDD + ' + formatAmount(nexusFee) + ' NXS';
    feeDetails = '(Service: ' + formatAmount(distordiaFee) + ' USDD + Nexus: ' + formatAmount(nexusFee) + ' NXS)';
    totalDisplay = formatAmount(amount + distordiaFee) + ' USDD + ' + formatAmount(nexusFee) + ' NXS';
  } else if (isUSDD) {
    // USDD but amount <= 1, no service fee, congestion fee might apply
    feeDisplay = 'None';
    feeDetails = '(0.01 NXS congestion fee might apply)';
    totalDisplay = formatAmount(amount) + ' USDD';
  } else {
    // Other tokens: no fees at all for single transactions
    feeDisplay = 'None';
    feeDetails = '(No service fee for this token)';
    totalDisplay = formatAmount(amount) + ' ' + ticker;
  }

  document.getElementById('summary-amount').textContent = formatAmount(amount) + ' ' + ticker;
  document.getElementById('summary-fee').textContent = feeDisplay;
  document.getElementById('summary-fee-details').textContent = feeDetails;
  document.getElementById('summary-total').textContent = totalDisplay;
}

// Show receive address
async function showReceiveAddress() {
  try {
    // Load all accounts
    const accounts = await wallet.listAccounts();
    
    // Populate account selector
    const select = document.getElementById('receive-account-select');
    select.textContent = '';
    
    accounts.forEach(account => {
      const option = document.createElement('option');
      option.value = account.address;
      option.textContent = `${account.name || 'Unnamed'} (${account.ticker || 'Token'}) - ${formatAmount(account.balance || 0)}`;
      option.dataset.name = account.name;
      option.dataset.ticker = account.ticker;
      select.appendChild(option);
    });
    
    // Select default account if available
    const defaultAccount = accounts.find(acc => acc.name === 'default');
    if (defaultAccount) {
      select.value = defaultAccount.address;
    }
    
    // Display selected account
    if (accounts.length > 0) {
      await updateReceiveDisplay(select.value);
    } else {
      showNotification('No accounts found', 'warning');
    }
  } catch (error) {
    console.error('Failed to load accounts for receive:', error);
    showNotification('Failed to load accounts', 'error');
  }
}

// Handle account selection change on receive screen
async function handleReceiveAccountChange() {
  const select = document.getElementById('receive-account-select');
  await updateReceiveDisplay(select.value);
}

// Update receive display with selected account address
async function updateReceiveDisplay(address) {
  try {
    document.getElementById('receive-address-text').textContent = address;
    
    // Generate QR code
    await generateQRCode(address);
  } catch (error) {
    console.error('Failed to update receive display:', error);
    showNotification('Failed to display address', 'error');
  }
}

// Generate QR code
async function generateQRCode(text) {
  const canvas = document.getElementById('qr-code');
  
  try {
    // Check if SimpleQRCode library is loaded
    if (typeof SimpleQRCode !== 'undefined') {
      // Generate QR code using our library
      await SimpleQRCode.toCanvas(canvas, text, {
        width: 200,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } else {
      // Fallback to simple pattern
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('QR library loading...', size / 2, size / 2);
    }
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Draw error message
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ff0000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR Error', size / 2, size / 2);
  }
}

// Copy address
function copyAddress() {
  const address = document.getElementById('address-text').getAttribute('data-full-address');
  navigator.clipboard.writeText(address);
  showNotification('Address copied to clipboard!', 'success');
}

// Copy receive address
function copyReceiveAddress() {
  const address = document.getElementById('receive-address-text').textContent;
  navigator.clipboard.writeText(address);
  showNotification('Address copied to clipboard!', 'success');
}

// Handle token select change (show/hide custom token input)
function handleTokenSelectChange() {
  const select = document.getElementById('new-account-token-select');
  const customGroup = document.getElementById('custom-token-group');
  
  if (select.value === 'custom') {
    customGroup.classList.remove('hidden');
  } else {
    customGroup.classList.add('hidden');
  }
}

// Handle create account
async function handleCreateAccount() {
  const accountName = document.getElementById('new-account-name').value.trim();
  const tokenSelect = document.getElementById('new-account-token-select');
  const customToken = document.getElementById('new-account-token-name').value.trim();
  const pin = document.getElementById('create-account-pin').value;

  if (!pin) {
    showNotification('Please enter your PIN', 'error');
    return;
  }

  // Determine token address or name
  let token = '0'; // Default to NXS
  if (tokenSelect.value === 'custom') {
    if (!customToken) {
      showNotification('Please enter a token name or address', 'error');
      return;
    }
    token = customToken;
  } else {
    token = tokenSelect.value;
  }

  console.log('Creating account with:');
  console.log('  - accountName:', accountName || 'undefined');
  console.log('  - token:', token);
  console.log('  - tokenSelect.value:', tokenSelect.value);

  showLoading('Creating account...');

  try {
    const result = await wallet.createAccount(accountName || undefined, token, pin);
    
    hideLoading();
    showNotification('Account created successfully!', 'success');
    
    // Clear form
    document.getElementById('new-account-name').value = '';
    document.getElementById('new-account-token-select').value = '0';
    document.getElementById('new-account-token-name').value = '';
    document.getElementById('create-account-pin').value = '';
    document.getElementById('custom-token-group').classList.add('hidden');
    
    // Refresh wallet data and return to receive screen
    await loadWalletData();
    showScreen('receive');
    await showReceiveAddress();
  } catch (error) {
    hideLoading();
    console.error('Failed to create account:', error);
    showNotification('Failed to create account: ' + error.message, 'error');
  }
}

// Load settings
async function loadSettings() {
  const walletInfo = wallet.getWalletInfo();
  const nodeUrl = await wallet.getNodeUrl();
  
  document.getElementById('settings-username').textContent = walletInfo.username || '-';
  document.getElementById('settings-genesis').textContent = walletInfo.genesis || '-';
  document.getElementById('node-url').value = nodeUrl;
  
  // Check node status
  await checkNodeStatus('settings');
  
  // Load connected sites
  await loadConnectedSites();
  await loadBlockedSites();
}

// Load connected sites list
async function loadConnectedSites() {
  const storage = new StorageService();
  const approvedDomains = await storage.getApprovedDomains();
  const container = document.getElementById('connected-sites-list');
  const revokeAllBtn = document.getElementById('revoke-all-btn');
  
  if (!approvedDomains || approvedDomains.length === 0) {
    container.textContent = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.textContent = 'No sites connected';
    container.appendChild(emptyDiv);
    revokeAllBtn.style.display = 'none';
    return;
  }
  
  // Show Revoke All button when there are connected sites
  revokeAllBtn.style.display = 'block';
  
  container.textContent = '';
  
  approvedDomains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'connected-site-item';
    
    // Format the domain to show just the hostname
    const displayDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    
    console.log('Creating site item for:', domain, 'Display:', displayDomain);
    
    // Build site item safely using DOM nodes
    const siteInfo = document.createElement('div');
    siteInfo.className = 'connected-site-info';
    
    const icon = document.createElement('div');
    icon.className = 'connected-site-icon';
    icon.textContent = '🌐';
    
    const siteDetails = document.createElement('div');
    siteDetails.className = 'connected-site-details';
    
    const domainDiv = document.createElement('div');
    domainDiv.className = 'connected-site-domain';
    domainDiv.textContent = displayDomain;
    
    const urlDiv = document.createElement('div');
    urlDiv.className = 'connected-site-url';
    urlDiv.textContent = domain;
    
    siteDetails.appendChild(domainDiv);
    siteDetails.appendChild(urlDiv);
    siteInfo.appendChild(icon);
    siteInfo.appendChild(siteDetails);
    
    const revokeBtn = document.createElement('button');
    revokeBtn.className = 'revoke-icon-btn';
    revokeBtn.dataset.domain = domain;
    revokeBtn.title = 'Revoke access';
    revokeBtn.textContent = '🗑️';
    
    item.appendChild(siteInfo);
    item.appendChild(revokeBtn);
    
    console.log('Item HTML:', item.innerHTML);
    
    // Add revoke button handler
    revokeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRevokeConnection(domain);
    });
    
    container.appendChild(item);
  });
}

// Handle revoke connection
async function handleRevokeConnection(domain) {
  if (!confirm(`Are you sure you want to revoke access for ${domain}?`)) {
    return;
  }
  
  try {
    const storage = new StorageService();
    await storage.removeApprovedDomain(domain);
    showNotification('Connection revoked successfully', 'success');
    await loadConnectedSites();
  } catch (error) {
    console.error('Failed to revoke connection:', error);
    showNotification('Failed to revoke connection', 'error');
  }
}

// Load blocked sites list
async function loadBlockedSites() {
  const storage = new StorageService();
  const blockedDomains = await storage.getBlockedDomains();
  const container = document.getElementById('blocked-sites-list');
  
  if (!blockedDomains || blockedDomains.length === 0) {
    container.textContent = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.textContent = 'No sites blocked';
    container.appendChild(emptyDiv);
    return;
  }
  
  container.textContent = '';
  
  blockedDomains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'connected-site-item blocked-site-item';
    
    // Format the domain to show just the hostname
    const displayDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    
    // Build site item safely using DOM nodes
    const siteInfo = document.createElement('div');
    siteInfo.className = 'connected-site-info';
    
    const icon = document.createElement('div');
    icon.className = 'connected-site-icon';
    icon.textContent = '🚫';
    
    const siteDetails = document.createElement('div');
    siteDetails.className = 'connected-site-details';
    
    const domainDiv = document.createElement('div');
    domainDiv.className = 'connected-site-domain';
    domainDiv.textContent = displayDomain;
    
    const urlDiv = document.createElement('div');
    urlDiv.className = 'connected-site-url';
    urlDiv.textContent = domain;
    
    siteDetails.appendChild(domainDiv);
    siteDetails.appendChild(urlDiv);
    siteInfo.appendChild(icon);
    siteInfo.appendChild(siteDetails);
    
    const unblockBtn = document.createElement('button');
    unblockBtn.className = 'revoke-icon-btn unblock-icon-btn';
    unblockBtn.dataset.domain = domain;
    unblockBtn.title = 'Unblock site';
    unblockBtn.textContent = '✓';
    
    item.appendChild(siteInfo);
    item.appendChild(unblockBtn);
    
    // Add unblock button handler
    unblockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleUnblockSite(domain);
    });
    
    container.appendChild(item);
  });
}

// Handle unblock site
async function handleUnblockSite(domain) {
  if (!confirm(`Are you sure you want to unblock ${domain}?`)) {
    return;
  }
  
  try {
    const storage = new StorageService();
    await storage.removeBlockedDomain(domain);
    showNotification('Site unblocked successfully', 'success');
    await loadBlockedSites();
  } catch (error) {
    console.error('Failed to unblock site:', error);
    showNotification('Failed to unblock site', 'error');
  }
}

// Handle revoke all connections
async function handleRevokeAllConnections() {
  const storage = new StorageService();
  const approvedDomains = await storage.getApprovedDomains();
  
  if (!approvedDomains || approvedDomains.length === 0) {
    return;
  }
  
  if (!confirm(`Are you sure you want to revoke access for all ${approvedDomains.length} connected site(s)?`)) {
    return;
  }
  
  try {
    for (const domain of approvedDomains) {
      await storage.removeApprovedDomain(domain);
    }
    showNotification('All connections revoked successfully', 'success');
    await loadConnectedSites();
  } catch (error) {
    console.error('Failed to revoke all connections:', error);
    showNotification('Failed to revoke all connections', 'error');
  }
}

// Handle save node URL
async function handleSaveNode() {
  const newUrl = document.getElementById('node-url').value.trim();
  
  if (!newUrl) {
    showNotification('Please enter a node URL', 'error');
    return;
  }

  try {
    // Validate URL with HTTPS enforcement
    const validatedUrl = validateNodeUrl(newUrl);
    
    await wallet.updateNodeUrl(validatedUrl);
    showNotification('Node URL updated successfully', 'success');
    
    // Update the input field with validated URL (in case HTTP was converted to HTTPS)
    document.getElementById('node-url').value = validatedUrl;
    
    // Check node status with the new URL
    await checkNodeStatus('settings');
  } catch (error) {
    showNotification('Failed to update node URL: ' + error.message, 'error');
  }
}

// Handle lock wallet
async function handleLockWallet() {
  const pin = prompt('Enter your PIN to lock the wallet:');
  
  if (!pin) {
    return; // User cancelled
  }

  try {
    await wallet.lock(pin);
    showScreen('login');
    showNotification('Wallet locked', 'success');
  } catch (error) {
    showNotification('Failed to lock wallet: ' + error.message, 'error');
  }
}

// Handle logout
async function handleLogout() {
  console.log('Logout button clicked');
  
  if (!confirm('Are you sure you want to logout?')) {
    console.log('Logout cancelled by user');
    return;
  }

  console.log('Attempting logout...');
  
  try {
    // Revoke all dApp connections before logging out
    const storage = new StorageService();
    const approvedDomains = await storage.getApprovedDomains();
    if (approvedDomains && approvedDomains.length > 0) {
      console.log(`Revoking ${approvedDomains.length} dApp connection(s)...`);
      for (const domain of approvedDomains) {
        await storage.removeApprovedDomain(domain);
      }
      console.log('All dApp connections revoked');
    }
    
    // Use message passing to ensure background script wallet is also updated
    const response = await chrome.runtime.sendMessage({
      method: 'wallet.logout'
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Also clear local wallet instance
    wallet.session = null;
    wallet.genesis = null;
    wallet.username = null;
    wallet.isLocked = true;
    
    stopAutoRefresh();
    console.log('Logout successful, switching to login screen');
    showScreen('login');
    
    // Clear form fields
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-pin').value = '';
    
    showNotification('Logged out successfully', 'success');
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Failed to logout: ' + error.message, 'error');
  }
}

// Switch tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    pane.classList.toggle('hidden', pane.id !== `${tabName}-tab`);
  });
}

// Show screen
function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(`${screenName}-screen`).classList.remove('hidden');
  currentScreen = screenName;
}

// Show loading overlay
function showLoading(text = 'Processing...') {
  document.getElementById('loading-overlay').classList.remove('hidden');
  document.querySelector('.loading-text').textContent = text;
}

// Hide loading overlay
function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// Show unlock prompt overlay
function showUnlockPrompt() {
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.remove('hidden');
  overlay.textContent = '';
  
  // Build unlock prompt safely using DOM nodes
  const container = document.createElement('div');
  container.style.cssText = 'background: white; padding: 30px; border-radius: 12px; max-width: 300px; text-align: center;';
  
  const title = document.createElement('h3');
  title.style.cssText = 'margin: 0 0 15px 0; color: #333;';
  title.textContent = 'Wallet Locked';
  
  const message = document.createElement('p');
  message.style.cssText = 'color: #666; margin-bottom: 20px;';
  message.textContent = 'Enter your PIN to unlock';
  
  const pinInput = document.createElement('input');
  pinInput.type = 'password';
  pinInput.id = 'unlock-pin-input';
  pinInput.placeholder = 'Enter PIN';
  pinInput.maxLength = 8;
  pinInput.autocomplete = 'off';
  pinInput.style.cssText = 'width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; margin-bottom: 15px;';
  
  const unlockBtn = document.createElement('button');
  unlockBtn.id = 'unlock-btn';
  unlockBtn.className = 'btn btn-primary';
  unlockBtn.style.cssText = 'width: 100%; padding: 12px; background: #ff6600; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;';
  unlockBtn.textContent = 'Unlock';
  
  container.appendChild(title);
  container.appendChild(message);
  container.appendChild(pinInput);
  container.appendChild(unlockBtn);
  overlay.appendChild(container);
  
  // Focus PIN input
  setTimeout(() => {
    if (pinInput) {
      pinInput.focus();
      
      // Handle unlock
      const handleUnlock = async () => {
        const pin = pinInput.value;
        if (!pin) {
          alert('Please enter your PIN');
          return;
        }
        
        try {
          overlay.textContent = '';
          const spinner = document.createElement('div');
          spinner.className = 'spinner';
          const loadingText = document.createElement('div');
          loadingText.className = 'loading-text';
          loadingText.textContent = 'Unlocking...';
          overlay.appendChild(spinner);
          overlay.appendChild(loadingText);
          await wallet.unlock(pin);
          hideLoading();
          hideLockedState();
          startAutoRefresh();
          showNotification('Wallet unlocked!', 'success');
        } catch (error) {
          hideLoading();
          showNotification('Failed to unlock: ' + error.message, 'error');
          showUnlockPrompt(); // Show prompt again
        }
      };
      
      unlockBtn.addEventListener('click', handleUnlock);
      pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUnlock();
      });
    }
  }, 100);
}

// Show unlock modal (called by unlock button)
function showUnlockModal() {
  showUnlockPrompt();
}

// Show locked state UI
function showLockedState() {
  console.log('Showing locked state UI');
  
  // Show unlock button
  const unlockBtn = document.getElementById('unlock-wallet-btn');
  if (unlockBtn) {
    unlockBtn.style.display = 'block';
  }
  
  // Disable transaction buttons
  const sendBtn = document.getElementById('send-btn');
  const confirmSendBtn = document.getElementById('confirm-send-btn');
  const createAccountBtn = document.getElementById('create-account-btn');
  
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.5';
    sendBtn.title = 'Unlock wallet to send transactions';
  }
  if (confirmSendBtn) {
    confirmSendBtn.disabled = true;
  }
  if (createAccountBtn) {
    createAccountBtn.disabled = true;
  }
}

// Hide locked state UI
function hideLockedState() {
  console.log('Hiding locked state UI - wallet is unlocked');
  
  // Hide unlock button
  const unlockBtn = document.getElementById('unlock-wallet-btn');
  if (unlockBtn) {
    unlockBtn.style.display = 'none';
  }
  
  // Enable transaction buttons
  const sendBtn = document.getElementById('send-btn');
  const confirmSendBtn = document.getElementById('confirm-send-btn');
  const createAccountBtn = document.getElementById('create-account-btn');
  
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.style.opacity = '1';
    sendBtn.title = '';
  }
  if (confirmSendBtn) {
    confirmSendBtn.disabled = false;
  }
  if (createAccountBtn) {
    createAccountBtn.disabled = false;
  }
}

// Show notification
function showNotification(text, type = 'info') {
  const notification = document.getElementById('notification');
  notification.textContent = text;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');

  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// Utility functions
function formatAmount(amount, minDecimals = 2) {
  const num = parseFloat(amount);
  
  if (num === 0) {
    return '0.00';
  }
  
  // For very small amounts (< 1), use 6 decimals
  if (Math.abs(num) < 1) {
    const decimals = Math.max(6, minDecimals);
    return num.toFixed(decimals).replace(/\.?0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  }
  
  // Calculate decimals based on magnitude:
  // 0-9.999...: 6 decimals
  // 10-99.999...: 5 decimals
  // 100-999.999...: 4 decimals
  // 1000-9999.999...: 3 decimals
  // 10000+: 2 decimals (minimum)
  
  const integerDigits = Math.floor(Math.log10(Math.abs(num))) + 1;
  const decimals = Math.max(minDecimals, 7 - integerDigits);
  
  return num.toFixed(decimals).replace(/\.?0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function truncateAddress(address) {
  if (!address) return '';
  if (address.length <= 16) return address;
  return address.substring(0, 8) + '...' + address.substring(address.length - 8);
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  
  return date.toLocaleDateString();
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
