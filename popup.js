// Popup UI Controller
// Handles all UI interactions and state management

let wallet;
let currentScreen = 'login';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize wallet service
  wallet = new WalletService();
  await wallet.initialize();

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
  document.getElementById('send-btn').addEventListener('click', () => {
    showScreen('send');
    updateSendAvailable();
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

  // Receive screen
  document.getElementById('back-from-receive-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('copy-address-btn').addEventListener('click', copyReceiveAddress);

  // Settings screen
  document.getElementById('back-from-settings-btn').addEventListener('click', () => showScreen('wallet'));
  document.getElementById('save-node-btn').addEventListener('click', handleSaveNode);
  document.getElementById('lock-wallet-btn').addEventListener('click', handleLockWallet);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
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
    await wallet.login(username, password, pin);
    showScreen('wallet');
    await loadWalletData();
    showNotification('Login successful!', 'success');
  } catch (error) {
    showNotification('Login failed: ' + error.message, 'error');
  } finally {
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
    await wallet.createWallet(username, password, pin);
    showScreen('wallet');
    await loadWalletData();
    showNotification('Wallet created successfully!', 'success');
  } catch (error) {
    showNotification('Failed to create wallet: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Load wallet data
async function loadWalletData() {
  try {
    const walletInfo = wallet.getWalletInfo();
    
    // Update account info
    document.getElementById('account-name').textContent = walletInfo.username || 'Default Account';
    
    // Get account address
    const address = await wallet.getAccountAddress('default');
    const truncatedAddress = truncateAddress(address);
    document.getElementById('address-text').textContent = truncatedAddress;
    document.getElementById('address-text').setAttribute('data-full-address', address);

    // Get balance
    const balance = await wallet.getBalance('default');
    document.getElementById('balance-amount').textContent = formatAmount(balance.balance);
    document.getElementById('nxs-balance').textContent = formatAmount(balance.balance);

    // Load transactions
    await loadTransactions();
  } catch (error) {
    console.error('Failed to load wallet data:', error);
    showNotification('Failed to load wallet data', 'error');
  }
}

// Load transactions
async function loadTransactions() {
  try {
    const transactions = await wallet.getTransactions(50);
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
  const recipient = document.getElementById('send-to').value.trim();
  const amount = document.getElementById('send-amount').value;
  const reference = document.getElementById('send-reference').value.trim();

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
    await wallet.send('default', amount, recipient, reference);
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
async function updateSendAvailable() {
  try {
    const balance = await wallet.getBalance('default');
    document.getElementById('send-available').textContent = formatAmount(balance.balance);
  } catch (error) {
    console.error('Failed to update available balance:', error);
  }
}

// Update transaction summary
function updateTransactionSummary() {
  const amount = parseFloat(document.getElementById('send-amount').value) || 0;
  const fee = 0.01; // Estimated fee
  const total = amount + fee;

  document.getElementById('summary-amount').textContent = formatAmount(amount) + ' NXS';
  document.getElementById('summary-fee').textContent = '~' + formatAmount(fee) + ' NXS';
  document.getElementById('summary-total').textContent = formatAmount(total) + ' NXS';
}

// Show receive address
async function showReceiveAddress() {
  try {
    const address = await wallet.getAccountAddress('default');
    document.getElementById('receive-address-text').textContent = address;
    
    // Generate QR code
    generateQRCode(address);
  } catch (error) {
    console.error('Failed to show receive address:', error);
    showNotification('Failed to load address', 'error');
  }
}

// Generate QR code
function generateQRCode(text) {
  const canvas = document.getElementById('qr-code');
  const size = 200;
  
  // Simple QR code placeholder (in production, use a QR code library)
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  
  ctx.fillStyle = '#000000';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('QR Code', size / 2, size / 2 - 10);
  ctx.fillText('(Install QR library)', size / 2, size / 2 + 10);
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
  try {
    await wallet.lock();
    showScreen('login');
    showNotification('Wallet locked', 'success');
  } catch (error) {
    showNotification('Failed to lock wallet', 'error');
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
