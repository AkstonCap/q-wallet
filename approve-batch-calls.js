// Approve Batch API Calls Popup Script

let requestId = null;
let callsData = null;
let distFee = 0;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get parameters from URL
  const params = new URLSearchParams(window.location.search);
  requestId = params.get('requestId');
  const origin = params.get('origin');
  const callsParam = params.get('calls');
  distFee = parseFloat(params.get('distFee')) || 1;
  
  try {
    callsData = JSON.parse(callsParam);
  } catch (error) {
    console.error('Failed to parse calls data:', error);
    showError('Invalid batch calls data');
    return;
  }
  
  // Display details
  document.getElementById('origin').textContent = origin || 'Unknown';
  document.getElementById('total-calls').textContent = callsData.length;
  document.getElementById('dist-fee').textContent = `${distFee} NXS`;
  
  // Populate calls list
  displayCalls();
  
  // Setup event listeners
  setupEventListeners();
  
  // Listen for result from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message received:', message);
    
    if (message.type === 'BATCH_CALLS_RESULT' && message.requestId === requestId) {
      console.log('Batch calls result received:', message);
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

// Display calls in the list
function displayCalls() {
  const container = document.getElementById('calls-list');
  container.innerHTML = '';
  
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
  
  console.log('Sending approval response with requestId:', requestId);
  
  // Show loading
  showLoading();
  
  // Send approval to background script
  chrome.runtime.sendMessage({
    type: 'TRANSACTION_APPROVAL_RESPONSE',
    requestId: requestId,
    approved: true,
    pin: pin,
    transactionData: {
      origin: document.getElementById('origin').textContent,
      calls: callsData,
      distFee: distFee
    }
  }, (response) => {
    console.log('Approval sent, response:', response);
  });
}

// Handle deny button
function handleDeny() {
  console.log('User denied batch calls');
  
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
