// Approve Batch API Calls Popup Script

let requestId = null;
let callsData = null;
let nxsFee = 0;
let totalNxsRequired = 0;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get parameters from URL
  const params = new URLSearchParams(window.location.search);
  requestId = params.get('requestId');
  const origin = params.get('origin');
  const callsParam = params.get('calls');
  nxsFee = parseFloat(params.get('nxsFee')) || 0;
  
  try {
    callsData = JSON.parse(callsParam);
  } catch (error) {
    console.error('[Q-Wallet] Failed to parse calls data:', error.message);
    showError('Invalid batch calls data');
    return;
  }
  
  // Display details
  document.getElementById('origin').textContent = origin || 'Unknown';
  document.getElementById('total-calls').textContent = callsData.length;
  
  // Display fee info
  if (nxsFee === 0) {
    document.getElementById('nxs-fee').textContent = 'Free (1 call)';
  } else {
    document.getElementById('nxs-fee').textContent = `${nxsFee} NXS`;
  }
  
  // Calculate total NXS required (service fee + congestion fees)
  // Congestion fee: 0.01 NXS * ((calls - 1) + fee debits)
  // Fee debits = 1 if nxsFee > 0, else 0
  const feeDebits = nxsFee > 0 ? 1 : 0;
  const congestionFeeCount = Math.max(0, callsData.length - 1) + feeDebits;
  const congestionFee = congestionFeeCount * 0.01;
  totalNxsRequired = nxsFee + congestionFee;
  
  // Display estimated total fees
  document.getElementById('nexus-fees').textContent = `~${congestionFee.toFixed(2)} NXS (${congestionFeeCount} calls)`;
  
  // Check NXS balance
  checkNxsBalance();
  
  // Populate calls list
  displayCalls();
  
  // Setup event listeners
  setupEventListeners();
  
  // Listen for result from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BATCH_CALLS_RESULT' && message.requestId === requestId) {
      hideLoading();
      
      if (message.success) {
        showSuccess(message.results, message.successfulCalls, message.totalCalls);
      } else {
        showError(`${message.totalCalls - message.successfulCalls} of ${message.totalCalls} calls failed`);
      }
      
      sendResponse({ received: true });
    }
    return true;
  });
  
  // Focus PIN input
  document.getElementById('pin-input').focus();
});

// Check if default NXS account has sufficient balance for fees
async function checkNxsBalance() {
  const approveBtn = document.getElementById('approve-btn');
  const feeNote = document.querySelector('.fee-note');
  
  try {
    // Get default account balance
    const response = await chrome.runtime.sendMessage({
      method: 'account.getBalance',
      params: { account: 'default' }
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    const balance = parseFloat(response.result?.balance || 0);
    
    if (balance < totalNxsRequired) {
      // Insufficient balance - disable approve button
      approveBtn.disabled = true;
      approveBtn.title = `Insufficient NXS balance. Need ${totalNxsRequired.toFixed(4)} NXS, have ${balance.toFixed(4)} NXS`;
      feeNote.innerHTML = `⚠️ <strong style="color: #f44336;">Insufficient NXS balance.</strong> Need ${totalNxsRequired.toFixed(4)} NXS for fees, but default account only has ${balance.toFixed(4)} NXS.`;
      feeNote.style.color = '#f44336';
    } else {
      approveBtn.disabled = false;
      approveBtn.title = '';
    }
  } catch (error) {
    console.error('[Q-Wallet] Failed to check NXS balance:', error.message);
    // Allow approval attempt if balance check fails - backend will catch it
    approveBtn.disabled = false;
  }
}

// Display calls in the list
function displayCalls() {
  const container = document.getElementById('calls-list');
  container.textContent = '';
  
  callsData.forEach((call, index) => {
    const callItem = document.createElement('div');
    callItem.className = 'call-item';
    
    const callNumber = document.createElement('div');
    callNumber.className = 'call-number';
    callNumber.textContent = `Call ${index + 1} of ${callsData.length}`;
    
    const callEndpoint = document.createElement('div');
    callEndpoint.className = 'call-endpoint';
    callEndpoint.textContent = call.endpoint;
    
    const callParams = document.createElement('div');
    callParams.className = 'call-params';
    // Filter out sensitive params for display
    const displayParams = { ...call.params };
    delete displayParams.pin;
    delete displayParams.session;
    callParams.textContent = JSON.stringify(displayParams, null, 2);
    
    callItem.appendChild(callNumber);
    callItem.appendChild(callEndpoint);
    callItem.appendChild(callParams);
    container.appendChild(callItem);
  });
}

// Setup event listeners
function setupEventListeners() {
  const approveBtn = document.getElementById('approve-btn');
  const denyBtn = document.getElementById('deny-btn');
  const closeBtn = document.getElementById('close-btn');
  const pinInput = document.getElementById('pin-input');
  
  approveBtn.addEventListener('click', handleApprove);
  denyBtn.addEventListener('click', handleDeny);
  closeBtn.addEventListener('click', () => window.close());
  
  // Allow Enter key to approve
  pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleApprove();
    }
  });
}

// Handle approve button
async function handleApprove() {
  const pin = document.getElementById('pin-input').value;
  
  if (!pin) {
    alert('Please enter your PIN');
    return;
  }
  
  // Show loading
  showLoading();
  
  // Send approval to background script
  chrome.runtime.sendMessage({
    type: 'TRANSACTION_APPROVAL_RESPONSE',
    requestId: requestId,
    approved: true,
    pin: pin,
    nxsFee: nxsFee,
    transactionData: {
      origin: document.getElementById('origin').textContent,
      calls: callsData,
      nxsFee: nxsFee
    }
  });
}

// Handle deny button
function handleDeny() {
  
  chrome.runtime.sendMessage({
    type: 'TRANSACTION_APPROVAL_RESPONSE',
    requestId: requestId,
    approved: false,
    pin: null,
    transactionData: null
  }, () => {
    window.close();
  });
}

// Show loading state
function showLoading() {
  document.querySelector('.content').style.display = 'none';
  document.getElementById('loading').classList.add('show');
}

// Hide loading state
function hideLoading() {
  document.getElementById('loading').classList.remove('show');
}

// Show success result
function showSuccess(results, successfulCalls, totalCalls) {
  const resultDiv = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');
  const resultData = document.getElementById('result-data');
  
  resultTitle.textContent = '✅ Batch Calls Completed';
  resultTitle.style.color = '#4caf50';
  resultMessage.textContent = `Successfully executed ${successfulCalls} of ${totalCalls} API calls`;
  resultData.textContent = JSON.stringify(results, null, 2);
  
  resultDiv.classList.add('show');
}

// Show error result
function showError(message) {
  const resultDiv = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');
  const resultData = document.getElementById('result-data');
  
  resultTitle.textContent = '❌ Batch Calls Failed';
  resultTitle.style.color = '#f44336';
  resultMessage.textContent = message;
  resultData.textContent = '';
  resultData.style.display = 'none';
  
  resultDiv.classList.add('show');
}
