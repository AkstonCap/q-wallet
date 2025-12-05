// Popup UI Controller
// Handles all UI interactions and state management

let wallet;
let currentScreen = 'login';
let autoRefreshInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize wallet service
  wallet = new WalletService();
  await wallet.initialize();

  // Load and set saved API URL
  await loadSavedApiUrl();

  // Check if user is logged in
  if (wallet.isLoggedIn() && !wallet.isLocked) {
    showScreen('wallet');
    loadWalletData();
    startAutoRefresh();
  } else {
    showScreen('login');
  }

  // Setup event listeners
  setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
  // API service selectors
  document.getElementById('login-api-service').addEventListener('change', handleLoginApiChange);
  document.getElementById('create-api-service').addEventListener('change', handleCreateApiChange);
  
  // Login form
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('show-create-btn').addEventListener('click', () => {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('create-form').classList.remove('hidden');
  });

  // Create wallet form
  document.getElementById('create-btn').addEventListener('click', handleCreateWallet);
  document.getElementById('back-to-login-btn').addEventListener('click', () => {
    document.getElementById('create-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  });

  // Wallet screen
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
  // Lock wallet button is commented out in HTML
  // document.getElementById('lock-wallet-btn').addEventListener('click', handleLockWallet);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

// Load saved API URL and set it in the selects
async function loadSavedApiUrl() {
  const savedUrl = await wallet.getNodeUrl();
  const loginSelect = document.getElementById('login-api-service');
  const createSelect = document.getElementById('create-api-service');
  
  // Check if saved URL matches one of the preset options
  const loginOptions = Array.from(loginSelect.options).map(opt => opt.value);
  const createOptions = Array.from(createSelect.options).map(opt => opt.value);
  
  if (loginOptions.includes(savedUrl)) {
    loginSelect.value = savedUrl;
  } else if (savedUrl && savedUrl !== 'http://localhost:8080') {
    // Custom URL
    loginSelect.value = 'custom';
    document.getElementById('login-custom-api-group').classList.remove('hidden');
    document.getElementById('login-custom-api').value = savedUrl;
  }
  
  if (createOptions.includes(savedUrl)) {
    createSelect.value = savedUrl;
  } else if (savedUrl && savedUrl !== 'http://localhost:8080') {
    // Custom URL
    createSelect.value = 'custom';
    document.getElementById('create-custom-api-group').classList.remove('hidden');
    document.getElementById('create-custom-api').value = savedUrl;
  }
}

// Handle API service selection for login
function handleLoginApiChange() {
  const select = document.getElementById('login-api-service');
  const customGroup = document.getElementById('login-custom-api-group');
  
  if (select.value === 'custom') {
    customGroup.classList.remove('hidden');
  } else {
    customGroup.classList.add('hidden');
  }
}

// Handle API service selection for create
function handleCreateApiChange() {
  const select = document.getElementById('create-api-service');
  const customGroup = document.getElementById('create-custom-api-group');
  
  if (select.value === 'custom') {
    customGroup.classList.remove('hidden');
  } else {
    customGroup.classList.add('hidden');
  }
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

// Get selected API URL from create form
function getCreateApiUrl() {
  const select = document.getElementById('create-api-service');
  if (select.value === 'custom') {
    const customUrl = document.getElementById('create-custom-api').value.trim();
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
    
    // Create and save session (locked)
    await wallet.login(username, password, pin);
    
    // Move to wallet UI immediately
    showScreen('wallet');
    hideLoading();
    showNotification('Login successful!', 'success');
    
    // Unlock session and load data in background
    try {
      await wallet.unlock(pin);
      await loadWalletData();
      startAutoRefresh();
    } catch (unlockError) {
      console.error('Failed to unlock session or load data:', unlockError);
      console.error('Error details:', unlockError.message);
      showNotification('Warning: Failed to unlock session - ' + unlockError.message, 'warning');
    }
    
    // SECURITY: Clear sensitive data after unlock completes
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-pin').value = '';
  } catch (error) {
    showNotification('Login failed: ' + error.message, 'error');
    hideLoading();
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
    
    console.log('Loading accounts...');
    // Get all accounts (each token has its own account with unique address)
    const accounts = await wallet.listAccounts();
    console.log('Accounts loaded:', accounts);
    
    // Check if accounts is an array
    if (!Array.isArray(accounts)) {
      console.error('Expected accounts to be an array, got:', typeof accounts, accounts);
      throw new Error('Invalid accounts response from API');
    }
    
    // Find the default NXS account for main display
    const defaultAccount = accounts.find(acc => acc.name === 'default' && (acc.token === '0' || acc.ticker === 'NXS'));
    
    if (defaultAccount) {
      const truncatedAddress = truncateAddress(defaultAccount.address);
      document.getElementById('address-text').textContent = truncatedAddress;
      document.getElementById('address-text').setAttribute('data-full-address', defaultAccount.address);
      
      // Display NXS balance
      document.getElementById('balance-amount').textContent = formatAmount(defaultAccount.balance);
    } else {
      console.warn('No default NXS account found in accounts:', accounts);
      // Show first account if available
      if (accounts.length > 0) {
        const firstAccount = accounts[0];
        const truncatedAddress = truncateAddress(firstAccount.address);
        document.getElementById('address-text').textContent = truncatedAddress;
        document.getElementById('address-text').setAttribute('data-full-address', firstAccount.address);
        document.getElementById('balance-amount').textContent = formatAmount(firstAccount.balance || 0);
      }
    }

    // Load tokens list with all accounts
    loadTokensList(accounts);

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
    const transactions = await wallet.getTransactions('default', 50);
    const container = document.getElementById('transactions-list');

    if (!transactions || transactions.length === 0) {
      container.innerHTML = '<div class="empty-state">No transactions yet</div>';
      return;
    }

    container.innerHTML = '';
    
    transactions.forEach(tx => {
      const item = createTransactionItem(tx);
      container.appendChild(item);
    });
  } catch (error) {
    console.error('Failed to load transactions:', error);
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
function loadTokensList(accounts) {
  const container = document.getElementById('tokens-list');
  
  if (!accounts || accounts.length === 0) {
    container.innerHTML = '<div class="empty-state">No accounts found</div>';
    return;
  }

  container.innerHTML = '';
  
  // Display each account (each account is for a specific token)
  accounts.forEach(account => {
    const item = document.createElement('div');
    item.className = 'token-item';
    
    const tokenInfo = document.createElement('div');
    tokenInfo.className = 'token-info';
    
    const tokenName = document.createElement('div');
    tokenName.className = 'token-name';
    tokenName.textContent = account.ticker || 'Unknown';
    
    const tokenDesc = document.createElement('div');
    tokenDesc.className = 'token-desc';
    if (account.ticker === 'NXS') {
      tokenDesc.textContent = account.name || 'default';
    } else {
      // Show account name for non-NXS tokens
      tokenDesc.textContent = account.name || truncateAddress(account.address);
    }
    
    tokenInfo.appendChild(tokenName);
    tokenInfo.appendChild(tokenDesc);
    
    const tokenBalance = document.createElement('div');
    tokenBalance.className = 'token-balance';
    tokenBalance.textContent = formatAmount(account.balance || 0);
    
    item.appendChild(tokenInfo);
    item.appendChild(tokenBalance);
    container.appendChild(item);
  });
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
  
  div.innerHTML = `
    <div class="transaction-icon ${isIncoming ? 'receive' : 'send'}">
      ${isIncoming ? '↓' : '↑'}
    </div>
    <div class="transaction-details">
      <div class="transaction-type">${txType}</div>
      <div class="transaction-date">${formatDate(tx.timestamp || Date.now())}</div>
    </div>
    <div class="transaction-amount ${isIncoming ? 'positive' : 'negative'}">
      ${showAmount ? (isIncoming ? '+' : '-') + formatAmount(amount) + ' ' + ticker : '—'}
    </div>
  `;
  
  return div;
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

  // Show PIN confirmation modal with transaction details
  showPinModal(accountName, recipient, amount, reference);
}

// Show PIN confirmation modal
function showPinModal(fromAccount, toAddress, amount, reference) {
  const select = document.getElementById('send-from-account');
  const selectedOption = select.options[select.selectedIndex];
  const ticker = selectedOption.dataset.ticker || 'Unknown';
  const isNXS = ticker === 'NXS';
  
  // Calculate Distordia service fee
  const parsedAmount = parseFloat(amount);
  let distordiaFee = 0;
  if (isNXS) {
    // NXS: 0.1% of amount, minimum 0.000001 NXS
    distordiaFee = Math.max(parsedAmount * 0.001, 0.000001);
  } else {
    // Other tokens: 0.01 NXS flat fee
    distordiaFee = 0.01;
  }
  
  // Nexus transaction fee (for multiple transactions within 10 seconds)
  const nexusFee = 0.01;
  const totalFees = distordiaFee + nexusFee;
  
  const total = isNXS ? parsedAmount + totalFees : parsedAmount;
  
  // Populate modal with transaction details
  document.getElementById('modal-from-account').textContent = `${fromAccount} (${ticker})`;
  document.getElementById('modal-to-address').textContent = toAddress;
  document.getElementById('modal-to-address').title = toAddress; // Full address on hover
  document.getElementById('modal-amount').textContent = `${formatAmount(amount)} ${ticker}`;
  
  // Update total to show fees with breakdown
  if (isNXS) {
    document.getElementById('modal-total').textContent = `${formatAmount(total)} NXS (incl. ${formatAmount(totalFees)} fees)`;
  } else {
    document.getElementById('modal-total').textContent = `${formatAmount(amount)} ${ticker} + ${formatAmount(totalFees)} NXS fees`;
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
    select.innerHTML = '<option value="">Select account...</option>';
    
    // Add each account as an option
    accounts.forEach(account => {
      const option = document.createElement('option');
      option.value = account.name;
      option.textContent = `${account.ticker || 'Unknown'} - ${account.name} (${formatAmount(account.balance || 0)})`;
      option.dataset.balance = account.balance || 0;
      option.dataset.ticker = account.ticker || 'Unknown';
      option.dataset.decimals = account.decimals || 6;
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
  
  // Calculate Distordia service fee
  let distordiaFee = 0;
  if (isNXS) {
    // NXS: 0.1% of amount, minimum 0.000001 NXS
    distordiaFee = Math.max(amount * 0.001, 0.000001);
  } else {
    // Other tokens: 0.01 NXS flat fee
    distordiaFee = 0.01;
  }
  
  // Nexus transaction fee (for multiple transactions within 10 seconds)
  const nexusFee = 0.01;
  
  // Total fees in NXS
  const totalFees = distordiaFee + nexusFee;
  const total = isNXS ? amount + totalFees : amount;

  document.getElementById('summary-amount').textContent = formatAmount(amount) + ' ' + ticker;
  document.getElementById('summary-fee').textContent = formatAmount(totalFees) + ' NXS (Nexus: ' + formatAmount(nexusFee) + ' + Service: ' + formatAmount(distordiaFee) + ')';
  
  if (isNXS) {
    document.getElementById('summary-total').textContent = formatAmount(total) + ' NXS';
  } else {
    document.getElementById('summary-total').textContent = formatAmount(amount) + ' ' + ticker + ' + ' + formatAmount(totalFees) + ' NXS fees';
  }
}

// Show receive address
async function showReceiveAddress() {
  try {
    // Load all accounts
    const accounts = await wallet.listAccounts();
    
    // Populate account selector
    const select = document.getElementById('receive-account-select');
    select.innerHTML = '';
    
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
  
  // Load connected sites
  await loadConnectedSites();
}

// Load connected sites list
async function loadConnectedSites() {
  const storage = new StorageService();
  const approvedDomains = await storage.getApprovedDomains();
  const container = document.getElementById('connected-sites-list');
  
  if (!approvedDomains || approvedDomains.length === 0) {
    container.innerHTML = '<div class="empty-state">No sites connected</div>';
    return;
  }
  
  container.innerHTML = '';
  
  approvedDomains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'connected-site-item';
    
    item.innerHTML = `
      <div class="connected-site-info">
        <div class="connected-site-domain">${domain}</div>
        <div class="connected-site-status">✓ Connected</div>
      </div>
      <button class="btn btn-danger revoke-btn" data-domain="${domain}">Revoke</button>
    `;
    
    // Add revoke button handler
    item.querySelector('.revoke-btn').addEventListener('click', () => handleRevokeConnection(domain));
    
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
    await wallet.logout();
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
  
  // For very small amounts (fees), show more decimals
  if (num < 0.01 && num > 0) {
    // Show up to 6 decimal places for small amounts, removing trailing zeros
    return num.toFixed(6).replace(/\.?0+$/, '');
  }
  
  // For normal amounts, use standard 2 decimals
  return num.toFixed(minDecimals);
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
