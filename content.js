// Content Script
// Injects the Nexus provider into web pages for dApp integration

(function() {
  'use strict';

  // Inject the inpage script into the page context
  const container = document.head || document.documentElement;
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inpage.js');
  script.onload = function() {
    this.remove();
  };
  (container).insertBefore(script, container.children[0]);

  // Setup message relay between inpage script and background
  window.addEventListener('message', async (event) => {
    // Only accept messages from same window
    if (event.source !== window) {
      return;
    }

    // Only handle nexus provider messages
    if (event.data.type && event.data.type === 'NEXUS_PROVIDER_REQUEST') {
      const { id, method, params } = event.data;

      try {
        // Forward to background script
        const response = await chrome.runtime.sendMessage({
          method,
          params: {
            ...params,
            origin: window.location.origin
          }
        });

        // Send response back to page
        window.postMessage({
          type: 'NEXUS_PROVIDER_RESPONSE',
          id,
          result: response.result,
          error: response.error
        }, '*');
      } catch (error) {
        window.postMessage({
          type: 'NEXUS_PROVIDER_RESPONSE',
          id,
          error: error.message
        }, '*');
      }
    }
  });

  console.log('Nexus Wallet content script injected');
})();
