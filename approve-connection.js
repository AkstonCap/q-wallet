// Approve Connection Script
// Handles the connection approval popup

// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const origin = urlParams.get('origin');
const requestId = urlParams.get('requestId');
const feeParam = urlParams.get('fee');

let feeConfig = null;
let accounts = [];
let hasSufficientBalance = false;

// Display origin
document.getElementById('origin-text').textContent = origin || 'Unknown';

// Parse fee configuration if present
if (feeParam) {
  try {
    feeConfig = JSON.parse(decodeURIComponent(feeParam));
    displayFeeInformation();
    loadAccountsForPayment();
  } catch (error) {
    console.error('Failed to parse fee configuration:', error);
  }
}

// Display fee information
function displayFeeInformation() {
  if (!feeConfig) return;
  
  const feeSection = document.getElementById('fee-section');
  feeSection.style.display = 'block';
  
  document.getElementById('fee-amount').textContent = 
    `${feeConfig.amount} ${feeConfig.tokenName}`;
  
  const validityHours = Math.floor(feeConfig.validitySeconds / 3600);
  const validityText = validityHours >= 24 
    ? `${Math.floor(validityHours / 24)} day(s)`
    : `${validityHours} hour(s)`;
  document.getElementById('fee-validity').textContent = validityText;
  
  document.getElementById('fee-recipient').textContent = feeConfig.recipientAddress;
  
  // Update approve button text
  document.getElementById('approve-btn').textContent = 
    `Pay ${feeConfig.amount} ${feeConfig.tokenName} & Approve`;
}

// Load accounts that can pay the fee
async function loadAccountsForPayment() {
  if (!feeConfig) return;
  
  try {
    const response = await chrome.runtime.sendMessage({
      method: 'account.listAccounts',
      params: {}
    });
    
    const allAccounts = response.result || [];
    
    // Filter accounts by token type and check balances
    const paymentAccountSelect = document.getElementById('payment-account');
    paymentAccountSelect.innerHTML = '<option value="">Select account...</option>';
    
    let hasMatchingAccounts = false;
    let hasAccountWithSufficientBalance = false;
    
    for (const account of allAccounts) {
      const accountToken = account.ticker || '';
      const accountTokenAddress = account.token || '';
      
      // Only show accounts with matching token
      if (accountToken === feeConfig.tokenName || accountTokenAddress === feeConfig.tokenName) {
        hasMatchingAccounts = true;
        const balance = parseFloat(account.balance || 0);
        const accountName = account.name || account.address;
        
        const option = document.createElement('option');
        option.value = accountName;
        option.textContent = `${accountName} (${balance} ${accountToken})`;
        
        // Disable if insufficient balance
        if (balance < feeConfig.amount) {
          option.disabled = true;
          option.textContent += ' - Insufficient';
        } else {
          hasAccountWithSufficientBalance = true;
        }
        
        paymentAccountSelect.appendChild(option);
        accounts.push({ name: accountName, balance, token: accountToken });
      }
    }
    
    hasSufficientBalance = hasAccountWithSufficientBalance;
    
    // Update balance display on selection change
    paymentAccountSelect.addEventListener('change', updateBalanceDisplay);
    
    // Handle insufficient balance scenarios
    if (!hasMatchingAccounts || !hasAccountWithSufficientBalance) {
      showInsufficientBalanceOption();
    }
    
    // If no accounts found at all, show message
    if (paymentAccountSelect.options.length === 1) {
      paymentAccountSelect.innerHTML = 
        `<option value="">No ${feeConfig.tokenName} accounts found</option>`;
      document.getElementById('approve-btn').disabled = true;
    }
  } catch (error) {
    console.error('Failed to load accounts:', error);
    document.getElementById('payment-account').innerHTML = 
      '<option value="">Error loading accounts</option>';
  }
}

// Show insufficient balance option with buy tokens button
function showInsufficientBalanceOption() {
  // Only show buy tokens option if token is not NXS
  if (feeConfig.tokenName === 'NXS') {
    // For NXS, just disable approve button - can't buy NXS from market
    document.getElementById('approve-btn').disabled = true;
    return;
  }
  
  // Show insufficient balance notice
  const notice = document.getElementById('insufficient-balance-notice');
  notice.style.display = 'block';
  document.getElementById('insufficient-token').textContent = feeConfig.tokenName;
  
  // Hide PIN input since they can't pay yet
  document.getElementById('pin-input-section').style.display = 'none';
  
  // Disable approve button
  document.getElementById('approve-btn').disabled = true;
  
  // Setup buy tokens button handler
  document.getElementById('buy-tokens-btn').addEventListener('click', handleBuyTokens);
}

// Handle buy tokens button click
async function handleBuyTokens() {
  try {
    // Send message to background to open buy tokens modal
    await chrome.runtime.sendMessage({
      type: 'OPEN_BUY_FEE_TOKENS',
      origin: origin,
      fee: feeConfig,
      requestId: requestId
    });
    
    // Close this window - background will open the buy tokens modal
    closeWindow();
  } catch (error) {
    console.error('Failed to open buy tokens:', error);
    alert('Failed to open buy tokens dialog: ' + error.message);
  }
}

// Update balance display when account selected
function updateBalanceDisplay() {
  const select = document.getElementById('payment-account');
  const selectedAccount = accounts.find(a => a.name === select.value);
  const balanceDisplay = document.getElementById('account-balance-display');
  
  if (selectedAccount && feeConfig) {
    const remaining = selectedAccount.balance - feeConfig.amount;
    balanceDisplay.textContent = 
      `Balance after payment: ${remaining.toFixed(2)} ${feeConfig.tokenName}`;
  } else {
    balanceDisplay.textContent = '';
  }
}

// Handle approve button
document.getElementById('approve-btn').addEventListener('click', async () => {
  let paymentAccount = null;
  let pin = null;
  
  // If fee is required, validate account selection and PIN
  if (feeConfig) {
    paymentAccount = document.getElementById('payment-account').value;
    if (!paymentAccount) {
      alert('Please select an account to pay the connection fee');
      return;
    }
    
    pin = document.getElementById('payment-pin').value;
    if (!pin) {
      alert('Please enter your PIN to authorize the payment');
      return;
    }
  }
  
  await sendResponse(true, false, paymentAccount, pin);
  closeWindow();
});

// Handle Enter key in PIN field
if (feeConfig) {
  document.getElementById('payment-pin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('approve-btn').click();
    }
  });
}

// Handle deny button
document.getElementById('deny-btn').addEventListener('click', async () => {
  await sendResponse(false, false);
  closeWindow();
});

// Handle block button
document.getElementById('block-btn').addEventListener('click', async () => {
  await sendResponse(false, true);
  closeWindow();
});

// Close the popup window
function closeWindow() {
  // Try multiple methods to ensure window closes
  setTimeout(() => {
    window.close();
  }, 100);
  
  // Also try to close via chrome API
  if (chrome && chrome.windows) {
    chrome.windows.getCurrent((window) => {
      if (window) {
        chrome.windows.remove(window.id);
      }
    });
  }
}

// Send response to background script
async function sendResponse(approved, blocked, paymentAccount = null, pin = null) {
  try {
    await chrome.runtime.sendMessage({
      type: 'CONNECTION_RESPONSE',
      requestId: requestId,
      approved: approved,
      blocked: blocked,
      origin: origin,
      paymentAccount: paymentAccount,
      pin: pin
    });
  } catch (error) {
    console.error('Failed to send response:', error);
  }
}

// Handle window close (treat as deny)
window.addEventListener('beforeunload', () => {
  if (!document.hidden) {
    sendResponse(false, false, null);
  }
});
