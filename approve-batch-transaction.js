// Approve Batch Transaction Popup Script
// Handles dApp batch transaction approval requests

let requestId = null;
let origin = null;
let transactions = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Get parameters from URL
  const urlParams = new URLSearchParams(window.location.search);
  requestId = urlParams.get('requestId');
  origin = urlParams.get('origin');
  const batchJson = urlParams.get('batch');
  
  try {
    transactions = JSON.parse(decodeURIComponent(batchJson));
  } catch (error) {
    console.error('Failed to parse batch transactions:', error);
    const content = document.getElementById('approval-content');
    content.textContent = '';
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message error';
    const iconDiv = document.createElement('div');
    iconDiv.className = 'status-icon';
    iconDiv.textContent = '❌';
    const msgDiv = document.createElement('div');
    msgDiv.textContent = 'Invalid batch transaction data';
    statusDiv.appendChild(iconDiv);
    statusDiv.appendChild(msgDiv);
    content.appendChild(statusDiv);
    return;
  }
  
  // Display origin
  document.getElementById('origin').textContent = origin || 'Unknown dApp';
  
  // Calculate total amount
  let totalAmount = 0;
  transactions.forEach(tx => {
    totalAmount += parseFloat(tx.amount) || 0;
  });
  
  // Display batch summary
  document.getElementById('total-transactions').textContent = transactions.length;
  document.getElementById('total-amount').textContent = formatAmount(totalAmount) + ' NXS';
  
  // Display individual transactions
  displayTransactions();
  
  // Setup event listeners
  setupEventListeners();
  
  // Auto-focus PIN input
  document.getElementById('pin').focus();
  
  // Listen for transaction result
  chrome.runtime.onMessage.addListener(handleTransactionResult);
});

// Display individual transactions
function displayTransactions() {
  const container = document.getElementById('transactions-container');
  
  transactions.forEach((tx, index) => {
    const txElement = document.createElement('div');
    txElement.className = 'transaction-item';
    
    // Header
    const header = document.createElement('div');
    header.className = 'transaction-item-header';
    const txNumber = document.createElement('span');
    txNumber.className = 'transaction-number';
    txNumber.textContent = `Transaction #${index + 1}`;
    const txAmount = document.createElement('span');
    txAmount.className = 'transaction-amount';
    txAmount.textContent = `${formatAmount(tx.amount)} NXS`;
    header.appendChild(txNumber);
    header.appendChild(txAmount);
    txElement.appendChild(header);
    
    // From
    const fromDetail = document.createElement('div');
    fromDetail.className = 'transaction-detail';
    const fromLabel = document.createElement('span');
    fromLabel.className = 'transaction-detail-label';
    fromLabel.textContent = 'From:';
    const fromValue = document.createElement('span');
    fromValue.className = 'transaction-detail-value';
    fromValue.textContent = tx.from || 'default';
    fromDetail.appendChild(fromLabel);
    fromDetail.appendChild(fromValue);
    txElement.appendChild(fromDetail);
    
    // To
    const toDetail = document.createElement('div');
    toDetail.className = 'transaction-detail';
    const toLabel = document.createElement('span');
    toLabel.className = 'transaction-detail-label';
    toLabel.textContent = 'To:';
    const toValue = document.createElement('span');
    toValue.className = 'transaction-detail-value truncate';
    toValue.textContent = tx.to;
    toValue.title = tx.to;
    toDetail.appendChild(toLabel);
    toDetail.appendChild(toValue);
    txElement.appendChild(toDetail);
    
    // Reference (optional)
    if (tx.reference) {
      const refDetail = document.createElement('div');
      refDetail.className = 'transaction-detail';
      const refLabel = document.createElement('span');
      refLabel.className = 'transaction-detail-label';
      refLabel.textContent = 'Reference:';
      const refValue = document.createElement('span');
      refValue.className = 'transaction-detail-value';
      refValue.textContent = tx.reference;
      refDetail.appendChild(refLabel);
      refDetail.appendChild(refValue);
      txElement.appendChild(refDetail);
    }
    
    container.appendChild(txElement);
  });
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('approve-btn').addEventListener('click', handleApprove);
  document.getElementById('reject-btn').addEventListener('click', handleReject);
  
  // Allow Enter key to submit
  document.getElementById('pin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleApprove();
    }
  });
}

// Handle approve
async function handleApprove() {
  const pin = document.getElementById('pin').value;
  
  if (!pin) {
    alert('Please enter your PIN');
    return;
  }
  
  // Disable buttons
  document.getElementById('approve-btn').disabled = true;
  document.getElementById('reject-btn').disabled = true;
  document.getElementById('pin').disabled = true;
  
  // Show processing status
  showProcessingStatus();
  
  // Send approval response to background script
  chrome.runtime.sendMessage({
    type: 'TRANSACTION_APPROVAL_RESPONSE',
    requestId: requestId,
    approved: true,
    pin: pin,
    transactionData: { origin, transactions }
  });
  
  // Fallback timeout
  setTimeout(() => {
    showTimeoutStatus();
  }, 60000); // 60 second timeout
}

// Handle reject
function handleReject() {
  chrome.runtime.sendMessage({
    type: 'TRANSACTION_APPROVAL_RESPONSE',
    requestId: requestId,
    approved: false,
    transactionData: { origin, transactions }
  });
  
  window.close();
}

// Handle transaction result message
function handleTransactionResult(message) {
  if (message.type === 'BATCH_TRANSACTION_RESULT' && message.requestId === requestId) {
    chrome.runtime.onMessage.removeListener(handleTransactionResult);
    
    if (message.success) {
      showSuccessStatus(message.successfulTransactions, message.totalTransactions);
    } else {
      showErrorStatus(message.successfulTransactions || 0, message.totalTransactions);
    }
  }
}

// Show processing status
function showProcessingStatus() {
  const content = document.getElementById('approval-content');
  content.textContent = '';
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status-message processing';
  const iconDiv = document.createElement('div');
  iconDiv.className = 'status-icon';
  iconDiv.textContent = '⏳';
  const msgDiv = document.createElement('div');
  msgDiv.textContent = `Processing ${transactions.length} transaction${transactions.length > 1 ? 's' : ''}...`;
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'result-details';
  detailsDiv.textContent = 'This may take a moment. Please wait.';
  statusDiv.appendChild(iconDiv);
  statusDiv.appendChild(msgDiv);
  statusDiv.appendChild(detailsDiv);
  content.appendChild(statusDiv);
}

// Show success status
function showSuccessStatus(successfulTransactions, totalTransactions) {
  const content = document.getElementById('approval-content');
  content.textContent = '';
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status-message success';
  const iconDiv = document.createElement('div');
  iconDiv.className = 'status-icon';
  iconDiv.textContent = '✅';
  const msgDiv = document.createElement('div');
  msgDiv.textContent = 'Batch Transaction Successful!';
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'result-details';
  detailsDiv.textContent = `${successfulTransactions} of ${totalTransactions} transactions completed successfully.`;
  statusDiv.appendChild(iconDiv);
  statusDiv.appendChild(msgDiv);
  statusDiv.appendChild(detailsDiv);
  content.appendChild(statusDiv);
  
  // Close window after 2 seconds
  setTimeout(() => {
    window.close();
  }, 2000);
}

// Show error status
function showErrorStatus(successfulTransactions, totalTransactions) {
  const content = document.getElementById('approval-content');
  content.textContent = '';
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status-message error';
  const iconDiv = document.createElement('div');
  iconDiv.className = 'status-icon';
  iconDiv.textContent = '❌';
  const msgDiv = document.createElement('div');
  msgDiv.textContent = 'Batch Transaction Failed';
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'result-details';
  detailsDiv.textContent = `${successfulTransactions} of ${totalTransactions} transactions completed before error.`;
  statusDiv.appendChild(iconDiv);
  statusDiv.appendChild(msgDiv);
  statusDiv.appendChild(detailsDiv);
  content.appendChild(statusDiv);
  
  // Close window after 3 seconds
  setTimeout(() => {
    window.close();
  }, 3000);
}

// Show timeout status
function showTimeoutStatus() {
  const content = document.getElementById('approval-content');
  content.textContent = '';
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status-message error';
  const iconDiv = document.createElement('div');
  iconDiv.className = 'status-icon';
  iconDiv.textContent = '⏱️';
  const msgDiv = document.createElement('div');
  msgDiv.textContent = 'Request Timeout';
  const detailsDiv = document.createElement('div');
  detailsDiv.className = 'result-details';
  detailsDiv.textContent = 'The transaction took too long to process.';
  statusDiv.appendChild(iconDiv);
  statusDiv.appendChild(msgDiv);
  statusDiv.appendChild(detailsDiv);
  content.appendChild(statusDiv);
  
  setTimeout(() => window.close(), 2000);
}

// Helper function to format amounts
function formatAmount(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00';
  
  const integerDigits = Math.floor(Math.abs(num)).toString().length;
  const minDecimals = 2;
  const decimals = Math.max(minDecimals, 7 - integerDigits);
  
  return num.toFixed(decimals);
}
