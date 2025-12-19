// Production-ready logger with environment-aware logging levels
// Set DEBUG to false before building for production

const Logger = {
  // Set to false in production builds to suppress debug/verbose logs
  DEBUG: true,
  
  // Prefix for all logs to identify extension
  PREFIX: '[Nexus Wallet]',
  
  /**
   * Sensitive field patterns that should NEVER be logged
   * These will be automatically redacted in all log output
   */
  SENSITIVE_FIELDS: ['pin', 'password', 'session', 'privatekey', 'private_key', 'mnemonic', 'seed', 'genesis', 'username'],
  
  /**
   * Redact sensitive data from any value
   * Recursively processes objects and arrays
   */
  redact(value) {
    if (value === null || value === undefined) {
      return value;
    }
    
    // Handle strings - check if it looks like a session token or hash
    if (typeof value === 'string') {
      // Redact long hex strings (likely session tokens, hashes, keys)
      if (value.length > 32 && /^[a-f0-9]+$/i.test(value)) {
        return '[REDACTED]';
      }
      return value;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => this.redact(item));
    }
    
    // Handle objects
    if (typeof value === 'object') {
      const redacted = {};
      for (const [key, val] of Object.entries(value)) {
        const keyLower = key.toLowerCase();
        
        // Check if key contains sensitive field name
        if (this.SENSITIVE_FIELDS.some(field => keyLower.includes(field))) {
          redacted[key] = '[REDACTED]';
        } else {
          // Recursively redact nested objects
          redacted[key] = this.redact(val);
        }
      }
      return redacted;
    }
    
    return value;
  },
  
  /**
   * Process arguments for logging - redact sensitive data
   */
  _processArgs(...args) {
    return args.map(arg => this.redact(arg));
  },
  
  /**
   * Debug-level logging (development only)
   * Use for detailed flow tracing, verbose state info
   * Automatically suppressed when DEBUG = false
   */
  debug(...args) {
    if (this.DEBUG) {
      console.debug(this.PREFIX, ...this._processArgs(...args));
    }
  },
  
  /**
   * Info-level logging (production)
   * Use for important state changes, successful operations
   */
  info(...args) {
    console.info(this.PREFIX, ...this._processArgs(...args));
  },
  
  /**
   * Warning-level logging (production)
   * Use for unexpected but handled situations
   */
  warn(...args) {
    console.warn(this.PREFIX, ...this._processArgs(...args));
  },
  
  /**
   * Error-level logging (production)
   * Use for errors, failures that need attention
   */
  error(...args) {
    console.error(this.PREFIX, ...this._processArgs(...args));
  },
  
  /**
   * Legacy sanitize method (deprecated - use redact instead)
   * Kept for backwards compatibility
   */
  sanitize(obj) {
    return this.redact(obj);
  }
};

// Export for use in browser extension context
if (typeof window !== 'undefined') {
  window.Logger = Logger;
}
