// Approve Buy Fee Tokens Script
// Handles purchasing fee tokens from the on-chain market

// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);
const origin = urlParams.get('origin');
const requestId = urlParams.get('requestId');
const feeParam = urlParams.get('fee');

let feeConfig = null;
let selectedAsk = null;
let asks = {
  exact: null,
  cheapest: null
};
let nxsAccounts = [];
let tokenAccounts = [];
let responseSent = false;

// Parse fee configuration
if (feeParam) {
  try {
    feeConfig = JSON.parse(decodeURIComponent(feeParam));
    document.getElementById('fee-required').textContent = 
      `${feeConfig.amount} ${feeConfig.tokenName}`;
    loadMarketAsks();
    loadAccounts();
  } catch (error) {
    console.error('Failed to parse fee configuration:', error);
    showError('Invalid fee configuration');
  }
} else {
  showError('Missing fee configuration');
}

// Load user accounts for from/to selection
async function loadAccounts() {
  try {
    const response = await chrome.runtime.sendMessage({
      method: 'account.listAccounts',
      params: {}
    });

    const allAccounts = response.result || [];
    
    // Separate NXS accounts and fee token accounts
    for (const account of allAccounts) {
      const accountToken = account.ticker || '';
      const accountTokenAddress = account.token || '';
      const balance = parseFloat(account.balance || 0);
      const accountName = account.name || account.address;
      
      // NXS accounts (token address is 0 or empty for NXS)
      if (accountTokenAddress === '0' || accountTokenAddress === '' || accountToken === 'NXS') {
        nxsAccounts.push({ name: accountName, balance, token: 'NXS' });
      }
      
      // Fee token accounts
      if (accountToken === feeConfig.tokenName || accountTokenAddress === feeConfig.tokenName) {
        tokenAccounts.push({ name: accountName, balance, token: accountToken || feeConfig.tokenName });
      }
    }
    
    // Sort NXS accounts by balance (descending), but put 'default' first if exists
    nxsAccounts.sort((a, b) => {
      if (a.name === 'default') return -1;
      if (b.name === 'default') return 1;
      return b.balance - a.balance;
    });
    
    // Sort token accounts by balance (descending)
    tokenAccounts.sort((a, b) => b.balance - a.balance);
    
    // Populate selects when pin-section becomes visible
    // (will be called when an ask is selected)
  } catch (error) {
    console.error('Failed to load accounts:', error);
  }
}

// Populate account selectors
function populateAccountSelectors() {
  // Update token label
  document.getElementById('to-account-token').textContent = feeConfig.tokenName;
  
  // Populate NXS (from) accounts
  const fromSelect = document.getElementById('from-account');
  fromSelect.innerHTML = '';
  
  if (nxsAccounts.length === 0) {
    fromSelect.innerHTML = '<option value="">No NXS accounts found</option>';
  } else {
    for (const account of nxsAccounts) {
      const option = document.createElement('option');
      option.value = account.name;
      option.textContent = `${account.name} (${account.balance.toFixed(6)} NXS)`;
      // Check if this account has enough NXS for the selected ask
      if (selectedAsk && account.balance < selectedAsk.costNXS) {
        option.disabled = true;
        option.textContent += ' - Insufficient';
      }
      fromSelect.appendChild(option);
    }
    // Select default or first available
    const defaultAccount = nxsAccounts.find(a => a.name === 'default' && (!selectedAsk || a.balance >= selectedAsk.costNXS));
    if (defaultAccount) {
      fromSelect.value = defaultAccount.name;
    } else {
      // Select first non-disabled option
      const firstAvailable = nxsAccounts.find(a => !selectedAsk || a.balance >= selectedAsk.costNXS);
      if (firstAvailable) {
        fromSelect.value = firstAvailable.name;
      }
    }
  }
  
  // Populate token (to) accounts
  const toSelect = document.getElementById('to-account');
  toSelect.innerHTML = '';
  
  if (tokenAccounts.length === 0) {
    toSelect.innerHTML = `<option value="">No ${feeConfig.tokenName} accounts found</option>`;
  } else {
    for (const account of tokenAccounts) {
      const option = document.createElement('option');
      option.value = account.name;
      option.textContent = `${account.name} (${account.balance} ${account.token})`;
      toSelect.appendChild(option);
    }
    // Select first (highest balance)
    toSelect.value = tokenAccounts[0].name;
  }
}

// Load market asks for the fee token
async function loadMarketAsks() {
  if (!feeConfig || feeConfig.tokenName === 'NXS') {
    // Should not happen - NXS doesn't need market purchase
    showError('Cannot buy NXS from market');
    return;
  }

  try {
    // Request market asks from background
    const response = await chrome.runtime.sendMessage({
      method: 'market.listAsks',
      params: {
        market: `${feeConfig.tokenName}/NXS`
      }
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const asksList = response.result || [];
    processAsks(asksList);
  } catch (error) {
    console.error('Failed to load market asks:', error);
    showError('Failed to load market: ' + error.message);
  }
}

// Process asks and find the two options
function processAsks(asksList) {
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById('asks-section').classList.remove('hidden');

  if (!asksList || asksList.length === 0) {
    document.getElementById('no-asks').classList.remove('hidden');
    return;
  }

  const requiredAmount = parseFloat(feeConfig.amount);

  // Filter asks that have at least the required amount
  // For market=<token>/NXS:
  // - contract.amount = tokens being sold (what you receive)
  // - order.amount = NXS the seller wants (what you pay)
  // - price = NXS per token (already calculated by API)
  const validAsks = asksList.filter(ask => {
    const buyAmount = parseFloat(ask.contract?.amount || 0);
    return buyAmount >= requiredAmount;
  });

  if (validAsks.length === 0) {
    document.getElementById('no-asks').classList.remove('hidden');
    return;
  }

  // Process each ask with calculated price
  // NXS amounts in orders are in divisible units (divide by 1e6)
  // price = (order.amount / 1e6) / contract.amount = NXS per token
  const asksWithDetails = validAsks.map(ask => {
    const buyAmount = parseFloat(ask.contract?.amount || 0);
    const costRaw = parseFloat(ask.order?.amount || 0);
    const costNXS = costRaw / 1e6;
    const price = costNXS / buyAmount;
    return {
      ...ask,
      buyAmount,
      costNXS,
      price
    };
  });

  // Option 1: Find asks with amount at or closest above fee amount, then lowest price
  const sortedByAmount = [...asksWithDetails].sort((a, b) => {
    // First by amount (ascending, but must be >= required)
    if (a.buyAmount !== b.buyAmount) {
      return a.buyAmount - b.buyAmount;
    }
    // Then by price (ascending)
    return a.price - b.price;
  });

  // Get the lowest valid amount
  const lowestAmount = sortedByAmount[0].buyAmount;
  
  // From those with the lowest amount, get the one with lowest price
  const exactMatches = sortedByAmount.filter(a => a.buyAmount === lowestAmount);
  exactMatches.sort((a, b) => a.price - b.price);
  asks.exact = exactMatches[0];

  // Option 2: Find the ask with the lowest price (best rate)
  const sortedByPrice = [...asksWithDetails].sort((a, b) => a.price - b.price);
  asks.cheapest = sortedByPrice[0];

  // Display Option 1 (Exact/Best Match)
  if (asks.exact) {
    const optionExact = document.getElementById('option-exact');
    optionExact.classList.remove('hidden');
    document.getElementById('exact-amount').textContent = 
      `${asks.exact.buyAmount} ${feeConfig.tokenName}`;
    document.getElementById('exact-cost').textContent = 
      `${asks.exact.costNXS.toFixed(6)} NXS`;
    document.getElementById('exact-price').textContent = 
      `${asks.exact.price.toFixed(6)} NXS/${feeConfig.tokenName}`;
    
    optionExact.addEventListener('click', () => selectOption('exact'));
  }

  // Display Option 2 (Lowest Price)
  // Only show if it's different from exact option
  if (asks.cheapest && asks.cheapest.txid !== asks.exact?.txid) {
    const optionCheapest = document.getElementById('option-cheapest');
    optionCheapest.classList.remove('hidden');
    document.getElementById('cheapest-amount').textContent = 
      `${asks.cheapest.buyAmount} ${feeConfig.tokenName}`;
    document.getElementById('cheapest-cost').textContent = 
      `${asks.cheapest.costNXS.toFixed(6)} NXS`;
    document.getElementById('cheapest-price').textContent = 
      `${asks.cheapest.price.toFixed(6)} NXS/${feeConfig.tokenName}`;
    
    optionCheapest.addEventListener('click', () => selectOption('cheapest'));
  }

  // If we only have one option, auto-select it
  if (asks.exact && (!asks.cheapest || asks.cheapest.txid === asks.exact.txid)) {
    selectOption('exact');
  }
}

// Select an option
function selectOption(option) {
  // Deselect all
  document.querySelectorAll('.ask-option').forEach(el => {
    el.classList.remove('selected');
  });

  // Select the clicked one
  if (option === 'exact' && asks.exact) {
    document.getElementById('option-exact').classList.add('selected');
    selectedAsk = asks.exact;
  } else if (option === 'cheapest' && asks.cheapest) {
    document.getElementById('option-cheapest').classList.add('selected');
    selectedAsk = asks.cheapest;
  }

  // Show PIN section, populate account selectors, and enable buy button
  if (selectedAsk) {
    document.getElementById('pin-section').classList.remove('hidden');
    populateAccountSelectors();
    document.getElementById('buy-btn').disabled = false;
  }
}

// Show error state
function showError(message) {
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById('asks-section').classList.add('hidden');
  document.getElementById('result-section').classList.remove('hidden');
  
  const resultBox = document.getElementById('result-box');
  resultBox.classList.add('result-error');
  document.getElementById('result-title').textContent = '❌ Error';
  document.getElementById('result-message').textContent = message;
  
  document.getElementById('buy-btn').classList.add('hidden');
}

// Show success state
function showSuccess(message, txid) {
  document.getElementById('asks-section').classList.add('hidden');
  document.getElementById('result-section').classList.remove('hidden');
  
  const resultBox = document.getElementById('result-box');
  resultBox.classList.add('result-success');
  document.getElementById('result-title').textContent = '✅ Purchase Successful';
  document.getElementById('result-message').textContent = message;
  
  // Show retry notice
  document.getElementById('retry-notice').classList.remove('hidden');
  
  // Change buttons
  document.getElementById('buy-btn').classList.add('hidden');
  document.getElementById('cancel-btn').textContent = 'Close';
  
  // Auto-close after 10 seconds on success
  setTimeout(() => {
    closeWindow();
  }, 10000);
}

// Handle buy button
document.getElementById('buy-btn').addEventListener('click', async () => {
  if (!selectedAsk) {
    alert('Please select an offer');
    return;
  }

  const fromAccount = document.getElementById('from-account').value;
  if (!fromAccount) {
    alert('Please select an NXS account to pay from');
    return;
  }

  const toAccount = document.getElementById('to-account').value;
  if (!toAccount) {
    alert('Please select an account to receive tokens');
    return;
  }

  const pin = document.getElementById('buy-pin').value;
  if (!pin) {
    alert('Please enter your PIN');
    return;
  }

  // Disable button and show loading
  const buyBtn = document.getElementById('buy-btn');
  buyBtn.disabled = true;
  buyBtn.textContent = 'Processing...';

  try {
    const response = await chrome.runtime.sendMessage({
      method: 'market.executeOrder',
      params: {
        txid: selectedAsk.txid,
        pin: pin,
        from: fromAccount,
        to: toAccount
      }
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const result = response.result;
    showSuccess(
      `Successfully purchased ${selectedAsk.buyAmount} ${feeConfig.tokenName} for ${selectedAsk.costNXS.toFixed(6)} NXS`,
      result.txid
    );

    // Send response to background
    await sendResponse(true, result.txid);

  } catch (error) {
    console.error('Purchase failed:', error);
    buyBtn.disabled = false;
    buyBtn.textContent = 'Buy Tokens';
    alert('Purchase failed: ' + error.message);
  }
});

// Handle Enter key in PIN field
document.getElementById('buy-pin').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !document.getElementById('buy-btn').disabled) {
    document.getElementById('buy-btn').click();
  }
});

// Handle cancel button
document.getElementById('cancel-btn').addEventListener('click', async () => {
  // Check if we're in success state (button text is "Close")
  const isSuccessState = !document.getElementById('result-section').classList.contains('hidden') &&
                         document.getElementById('result-box').classList.contains('result-success');
  
  if (isSuccessState) {
    // Just close the window - response was already sent
    closeWindow();
  } else {
    // Send cancel response
    await sendResponse(false, null);
    closeWindow();
  }
});

// Send response to background script
async function sendResponse(purchased, txid) {
  if (responseSent) {
    return; // Prevent double-sending
  }
  responseSent = true;
  
  try {
    await chrome.runtime.sendMessage({
      type: 'BUY_FEE_TOKENS_RESPONSE',
      requestId: requestId,
      purchased: purchased,
      txid: txid,
      origin: origin
    });
  } catch (error) {
    console.error('Failed to send response:', error);
  }
}

// Close the popup window
function closeWindow() {
  setTimeout(() => {
    window.close();
  }, 100);
  
  if (chrome && chrome.windows) {
    chrome.windows.getCurrent((window) => {
      if (window) {
        chrome.windows.remove(window.id);
      }
    });
  }
}

// Handle window close (treat as cancel)
window.addEventListener('beforeunload', () => {
  if (!document.getElementById('result-section').classList.contains('hidden')) {
    // Already showed result, don't send cancel
    return;
  }
  sendResponse(false, null);
});
