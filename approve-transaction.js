// Approve Transaction Popup Script
// Handles dApp transaction approval requests

let requestId = null;
let transactionData = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get transaction details from URL parameters
  const params = new URLSearchParams(window.location.search);
  requestId = params.get('requestId');
  
  const refParam = params.get('reference');
  transactionData = {
    origin: params.get('origin'),
    from: params.get('from'),
    to: params.get('to'),
    amount: params.get('amount')
  };
  
  // Only include reference if it has a value
  if (refParam && refParam.trim() && refParam !== 'None') {
    transactionData.reference = refParam.trim();
  }
  
  // Display transaction details
  displayTransactionDetails();
  
  // Setup event listeners
  setupEventListeners();
  
  // Listen for transaction result from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('=== Message received in approval popup ===');
    console.log('Message type:', message.type);
    console.log('Message requestId:', message.requestId);
    console.log('Current requestId:', requestId);
    console.log('Full message:', message);
    
    if (message.type === 'TRANSACTION_RESULT' && message.requestId === requestId) {
      console.log('Transaction result received:', message);
      hideLoading();
      
      if (message.success) {
        console.log('Showing success with result:', message.result);
        showSuccess(message.result);
      } else {
        console.log('Showing error:', message.error);
        showError(message.error || 'Transaction failed');
      }
      
      sendResponse({ received: true });
    }
    return true;
  });
  
  // Focus PIN input
  document.getElementById('pin-input').focus();
});

// Display transaction details
function displayTransactionDetails() {
  document.getElementById('origin').textContent = transactionData.origin || 'Unknown';
  document.getElementById('from-account').textContent = transactionData.from || 'default';
  document.getElementById('to-address').textContent = truncateAddress(transactionData.to);
  document.getElementById('amount').textContent = `${transactionData.amount} NXS`;
  document.getElementById('reference').textContent = transactionData.reference || 'None';
}

// Truncate long addresses for display
function truncateAddress(address) {
  if (!address || address.length <= 20) return address;
  return address.substring(0, 10) + '...' + address.substring(address.length - 10);
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
  
  // Enable approve button only when PIN is entered
  pinInput.addEventListener('input', () => {
    const pin = pinInput.value.trim();
    approveBtn.disabled = !pin || pin.length < 4;
  });
  
  // Allow Enter key to approve
  pinInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const pin = pinInput.value.trim();
      if (pin && pin.length >= 4) {
        handleApprove();
      }
    }
  });
  
  // Disable approve button initially
  approveBtn.disabled = true;
}

// Handle approval
async function handleApprove() {
  const pinInput = document.getElementById('pin-input');
  const pin = pinInput.value.trim();
  
  console.log('=== handleApprove called ===');
  console.log('PIN present:', !!pin);
  console.log('PIN length:', pin ? pin.length : 0);
  console.log('RequestId:', requestId);
  console.log('TransactionData:', transactionData);
  
  if (!pin || pin.length < 4) {
    alert('Please enter a valid PIN (at least 4 digits)');
    return;
  }
  
  // Show loading state
  showLoading();
  
  try {
    console.log('Sending TRANSACTION_APPROVAL_RESPONSE message...');
    // Send approval response to background script
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSACTION_APPROVAL_RESPONSE',
      requestId: requestId,
      approved: true,
      pin: pin,
      transactionData: transactionData
    });
    
    console.log('Message sent successfully, response:', response);
    console.log('Waiting for transaction result...');
  } catch (error) {
    console.error('Failed to send approval:', error);
    hideLoading();
    showError('Failed to process approval. Please try again.');
  }
}

// Handle denial
async function handleDeny() {
  try {
    // Send denial response to background script
    await chrome.runtime.sendMessage({
      type: 'TRANSACTION_APPROVAL_RESPONSE',
      requestId: requestId,
      approved: false,
      transactionData: transactionData
    });
    
    // Close window
    window.close();
  } catch (error) {
    console.error('Failed to send denial:', error);
    window.close();
  }
}

// Show loading state
function showLoading() {
  document.querySelector('.content').style.display = 'none';
  document.querySelector('.buttons').style.display = 'none';
  document.getElementById('loading').classList.add('active');
}

// Hide loading state
function hideLoading() {
  document.querySelector('.content').style.display = 'block';
  document.querySelector('.buttons').style.display = 'flex';
  document.getElementById('loading').classList.remove('active');
}

// Show success result
function showSuccess(result) {
  const resultDiv = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');
  const resultData = document.getElementById('result-data');
  const closeBtn = document.getElementById('close-btn');
  
  resultTitle.textContent = '✅ Transaction Successful';
  resultTitle.style.color = '#4caf50';
  
  // Extract txid from various possible response structures
  const txid = result?.txid || result?.result?.txid || result?.hash;
  
  if (txid) {
    resultMessage.textContent = 'Transaction ID:';
    resultData.textContent = txid;
    resultData.style.display = 'block';
  } else {
    resultMessage.textContent = 'Transaction completed successfully';
    resultData.textContent = JSON.stringify(result, null, 2);
    resultData.style.display = 'block';
  }
  
  resultDiv.classList.add('active');
  closeBtn.focus();
  
  // Auto-close after 10 seconds
  setTimeout(() => {
    window.close();
  }, 10000);
}

// Show error result
function showError(error) {
  const resultDiv = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');
  const resultData = document.getElementById('result-data');
  const closeBtn = document.getElementById('close-btn');
  
  resultTitle.textContent = '❌ Transaction Failed';
  resultTitle.style.color = '#f44336';
  resultMessage.textContent = error;
  resultData.style.display = 'none';
  
  resultDiv.classList.add('active');
  closeBtn.focus();
}
