// Popup UI Controller
// Handles all UI interactions and state management

let wallet;
let currentScreen = 'login';

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

  // Receive screen
  document.getElementById('back-from-receive-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('copy-address-btn').addEventListener('click', copyReceiveAddress);
  document.getElementById('receive-account-select').addEventListener('change', handleReceiveAccountChange);

  // Settings screen
  document.getElementById('back-from-settings-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('save-node-btn').addEventListener('click', handleSaveNode);
  document.getElementById('lock-wallet-btn').addEventListener('click', handleLockWallet);
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

// Get selected API URL from login form
function getLoginApiUrl() {
  const select = document.getElementById('login-api-service');
  if (select.value === 'custom') {
    const customUrl = document.getElementById('login-custom-api').value.trim();
    if (!customUrl) {
      throw new Error('Please enter a custom API URL');
    }
    return customUrl;
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
    return customUrl;
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
    } catch (unlockError) {
      console.error('Failed to unlock session or load data:', unlockError);
      console.error('Error details:', unlockError.message);
      showNotification('Warning: Failed to unlock session - ' + unlockError.message, 'warning');
    }
  } catch (error) {
    showNotification('Login failed: ' + error.message, 'error');
    hideLoading();
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
  
  const type = tx.type || (tx.OP === 'DEBIT' ? 'send' : 'receive');
  const isReceive = type === 'receive' || tx.OP === 'CREDIT';
  const amount = tx.amount || 0;
  
  div.innerHTML = `
    <div class="transaction-icon ${isReceive ? 'receive' : 'send'}">
      ${isReceive ? '↓' : '↑'}
    </div>
    <div class="transaction-details">
      <div class="transaction-type">${isReceive ? 'Received' : 'Sent'}</div>
      <div class="transaction-date">${formatDate(tx.timestamp || Date.now())}</div>
    </div>
    <div class="transaction-amount ${isReceive ? 'positive' : 'negative'}">
      ${isReceive ? '+' : '-'}${formatAmount(amount)} NXS
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

  showLoading('Sending transaction...');

  try {
    await wallet.send(accountName, amount, recipient, reference);
    showNotification('Transaction sent successfully!', 'success');
    
    // Clear form
    document.getElementById('send-to').value = '';
    document.getElementById('send-amount').value = '';
    document.getElementById('send-reference').value = '';
    
    // Return to wallet screen and refresh
    showScreen('wallet');
    await loadWalletData();
  } catch (error) {
    showNotification('Failed to send: ' + error.message, 'error');
  } finally {
    hideLoading();
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
  const ticker = document.getElementById('send-currency').textContent;
  const fee = 0.01; // Estimated fee in NXS
  const total = ticker === 'NXS' ? amount + fee : amount;

  document.getElementById('summary-amount').textContent = formatAmount(amount) + ' ' + ticker;
  document.getElementById('summary-fee').textContent = '~' + formatAmount(fee) + ' NXS';
  
  if (ticker === 'NXS') {
    document.getElementById('summary-total').textContent = formatAmount(total) + ' NXS';
  } else {
    document.getElementById('summary-total').textContent = formatAmount(amount) + ' ' + ticker + ' + ~' + formatAmount(fee) + ' NXS fee';
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
  const url = document.getElementById('node-url').value.trim();
  
  if (!url) {
    showNotification('Please enter a node URL', 'error');
    return;
  }

  try {
    await wallet.updateNodeUrl(url);
    showNotification('Node URL updated successfully!', 'success');
  } catch (error) {
    showNotification('Failed to update node URL', 'error');
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
  if (!confirm('Are you sure you want to logout?')) {
    return;
  }

  try {
    await wallet.logout();
    showScreen('login');
    
    // Clear form fields
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-pin').value = '';
    
    showNotification('Logged out successfully', 'success');
  } catch (error) {
    showNotification('Failed to logout', 'error');
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
function formatAmount(amount) {
  return parseFloat(amount).toFixed(2);
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
