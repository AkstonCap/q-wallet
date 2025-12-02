// Approve Connection Script
// Handles the connection approval popup

// Get origin from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const origin = urlParams.get('origin');
const requestId = urlParams.get('requestId');

// Display origin
document.getElementById('origin-text').textContent = origin || 'Unknown';

// Handle approve button
document.getElementById('approve-btn').addEventListener('click', async () => {
  await sendResponse(true, false);
  closeWindow();
});

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
async function sendResponse(approved, blocked) {
  try {
    await chrome.runtime.sendMessage({
      type: 'CONNECTION_RESPONSE',
      requestId: requestId,
      approved: approved,
      blocked: blocked,
      origin: origin
    });
  } catch (error) {
    console.error('Failed to send response:', error);
  }
}

// Handle window close (treat as deny)
window.addEventListener('beforeunload', () => {
  if (!document.hidden) {
    sendResponse(false, false);
  }
});
