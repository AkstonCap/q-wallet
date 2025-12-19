# Security Logging Guidelines

## Overview
This document explains the security logging implementation in Q-Wallet to protect sensitive user data.

## Security Measures Implemented

### 1. Automatic Sensitive Data Redaction
The extension uses a Logger utility (`lib/logger.js`) that **automatically redacts** sensitive data before logging:

**Protected Data:**
- `session` - Session tokens
- `pin` - User PINs
- `password` - User passwords
- `genesis` - Genesis hashes
- `username` - Usernames
- `privatekey`/`private_key` - Private keys
- `mnemonic` - Seed phrases
- `seed` - Wallet seeds

**How it works:**
- All log arguments are recursively scanned before output
- Sensitive field names are replaced with `[REDACTED]`
- Long hex strings (64+ characters) are automatically truncated
- Works on objects, arrays, and nested structures

### 2. Environment-Aware Logging

**DEBUG Flag:**
```javascript
const DEBUG = false; // Set to false for production
```

When `DEBUG = false`:
- Only errors and warnings are logged
- Debug and info messages are suppressed
- Minimal console output in production

When `DEBUG = true` (development only):
- All log levels are visible
- Sensitive data is still automatically redacted
- Helps with debugging without compromising security

### 3. Files Updated for Security

**background.js:**
- All logging uses Logger.debug/info/warn/error
- Sensitive data automatically redacted
- No direct console.log statements

**content.js:**
- Inline logger with redaction (cannot import external scripts)
- Same redaction rules as lib/logger.js
- Handles message passing securely

**inpage.js:**
- Inline logger with redaction
- Protects window.nexus API calls
- No sensitive data exposed to web pages

**services/wallet.js:**
- All verbose console.log statements removed
- Only essential error logging remains with console.error
- No session, PIN, genesis, or username logging

**popup.js:**
- Verbose debug logging removed
- No sensitive data logged
- Clean, minimal console output

## Development Guidelines

### ✅ DO:
```javascript
// Use Logger for all logging
Logger.debug('User logged in', { username: user.username }); // Auto-redacted
Logger.info('Transaction completed', { txid: txid });
Logger.error('API error', error);

// Or use console.error for errors only
console.error('Critical error:', error);
```

### ❌ DON'T:
```javascript
// NEVER log sensitive data directly
console.log('Session:', session); // ❌ SECURITY RISK
console.log('PIN:', pin); // ❌ SECURITY RISK
console.log('User:', { session, genesis, username }); // ❌ SECURITY RISK
```

## Production Checklist

Before releasing to production:

1. ✅ Set `DEBUG = false` in:
   - `lib/logger.js`
   - `content.js`
   - `inpage.js`

2. ✅ Verify no console.log in sensitive areas:
   - `services/wallet.js` - ✅ All removed
   - `services/storage.js` - ✅ Check if needed
   - `services/nexus-api.js` - ✅ Check if needed

3. ✅ Test in production mode:
   - Open DevTools Console
   - Perform login
   - Check that no session, PIN, genesis, or username appears
   - Verify only errors/warnings are logged

## Security Benefits

### Prevents Session Hijacking
- Attackers cannot steal session tokens from console logs
- Critical for public computers and shared environments

### Protects User Privacy
- Usernames and genesis hashes remain confidential
- No personally identifiable information in logs

### Compliance
- Meets security best practices for browser extensions
- Reduces liability in case of developer tools access

## Emergency Response

If sensitive data is accidentally logged:

1. **Immediately update the code** to remove/redact the log
2. **Clear browser console** - F12 → Console → Clear
3. **Test thoroughly** to ensure the fix works
4. **Review all logging** in the affected file
5. **Consider session rotation** if exposure occurred

## Questions?

See:
- `lib/logger.js` - Logger implementation
- `SECURITY.md` - General security guidelines
- `DEVELOPER.md` - Development best practices
