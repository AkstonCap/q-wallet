// Approve Transaction Popup Script
// Handles dApp transaction approval requests

let requestId = null;
let transactionData = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get transaction details from URL parameters
  const params = new URLSearchParams(window.location.search);
  requestId = params.get('requestId');
  
  transactionData = {
    origin: params.get('origin'),
    from: params.get('from'),
    to: params.get('to'),
    amount: params.get('amount'),
    reference: params.get('reference') || 'None'
  };
  
  // Display transaction details
  displayTransactionDetails();
  
  // Setup event listeners
  setupEventListeners();
  
  // Focus PIN input
  document.getElementById('pin-input').focus();
});

// Display transaction details
function displayTransactionDetails() {
  document.getElementById('origin').textContent = transactionData.origin || 'Unknown';
  document.getElementById('from-account').textContent = transactionData.from || 'default';
  document.getElementById('to-address').textContent = truncateAddress(transactionData.to);
  document.getElementById('amount').textContent = `${transactionData.amount} NXS`;
  document.getElementById('reference').textContent = transactionData.reference;
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
  const pinInput = document.getElementById('pin-input');
  
  approveBtn.addEventListener('click', handleApprove);
  denyBtn.addEventListener('click', handleDeny);
  
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
  
  if (!pin || pin.length < 4) {
    alert('Please enter a valid PIN (at least 4 digits)');
    return;
  }
  
  // Show loading state
  showLoading();
  
  try {
    // Send approval response to background script
    await chrome.runtime.sendMessage({
      type: 'TRANSACTION_APPROVAL_RESPONSE',
      requestId: requestId,
      approved: true,
      pin: pin,
      transactionData: transactionData
    });
    
    // Close window
    window.close();
  } catch (error) {
    console.error('Failed to send approval:', error);
    hideLoading();
    alert('Failed to process approval. Please try again.');
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
