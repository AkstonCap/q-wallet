// Content Script
// Injects the Nexus provider into web pages for dApp integration

(function() {
  'use strict';

  // Simple logger for content script (can't import external scripts)
  const Logger = {
    DEBUG: true, // Set to false in production
    SENSITIVE_FIELDS: ['pin', 'password', 'session', 'privatekey', 'private_key', 'mnemonic', 'seed', 'genesis', 'username'],
    
    redact(value) {
      if (value === null || value === undefined) return value;
      if (typeof value === 'string' && value.length > 32 && /^[a-f0-9]+$/i.test(value)) return '[REDACTED]';
      if (Array.isArray(value)) return value.map(item => this.redact(item));
      if (typeof value === 'object') {
        const redacted = {};
        for (const [key, val] of Object.entries(value)) {
          redacted[key] = this.SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f)) ? '[REDACTED]' : this.redact(val);
        }
        return redacted;
      }
      return value;
    },
    
    _processArgs(...args) {
      return args.map(arg => this.redact(arg));
    },
    
    debug(...args) {
      if (this.DEBUG) console.debug('[Nexus Content]', ...this._processArgs(...args));
    },
    info(...args) {
      console.info('[Nexus Content]', ...this._processArgs(...args));
    },
    error(...args) {
      console.error('[Nexus Content]', ...this._processArgs(...args));
    }
  };

  // Guard against multiple injections
  if (window.__NEXUS_WALLET_CONTENT_INJECTED__) {
    Logger.debug('Content script already injected, skipping');
    return;
  }
  window.__NEXUS_WALLET_CONTENT_INJECTED__ = true;

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
      
      Logger.debug('Request:', method);

      try {
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
          throw new Error('Extension context invalidated. Please refresh the page.');
        }

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
        // Handle extension context invalidation
        let errorMessage = error.message;
        if (error.message.includes('Extension context invalidated') || 
            error.message.includes('message port closed')) {
          errorMessage = 'Extension was reloaded. Please refresh this page.';
          Logger.error('Extension context invalidated');
        }
        
        window.postMessage({
          type: 'NEXUS_PROVIDER_RESPONSE',
          id,
          error: errorMessage
        }, '*');
      }
    }
  });

  Logger.info('Content script injected');
})();
