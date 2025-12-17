# Security Architecture

This document provides a detailed overview of the security measures implemented in Distordia Q-Wallet.

## Table of Contents
- [Storage Security](#storage-security)
- [Session Management](#session-management)
- [Code Security](#code-security)
- [Threat Model](#threat-model)
- [Alternative Approaches](#alternative-approaches)
- [Security Auditing](#security-auditing)

## Storage Security

### Session Storage (chrome.storage.session)

The wallet uses Chrome's session storage API for all sensitive data. This is the same approach used by industry-standard browser wallets like MetaMask.

#### What is chrome.storage.session?

- **Memory-only storage**: Data is kept in RAM, **NEVER written to disk**
- **Browser lifecycle**: Data persists only while browser is running
- **Automatic cleanup**: Cleared when browser closes
- **Isolated**: Not accessible from web pages or other extensions
- **Secure context**: Protected by browser's security sandbox

#### Encrypted Fallback Mode

If a browser doesn't fully support chrome.storage.session:

- **Memory-only encryption key**: Generated randomly per session, stored in JavaScript memory
- **Key lifetime**: Lost when extension reloads/closes
- **Encrypted on disk**: Data encrypted before storage, but key never persisted
- **Unrecoverable**: Without the memory-only key, encrypted data is useless
- **Still cleared on close**: Manual cleanup removes encrypted data

**Why this is secure:**
- Encryption key never written to disk (lives in memory only)
- Key lost = data unrecoverable
- Better than plaintext storage
- Automatically upgrades when chrome.storage.session available

#### What We Store

**Sensitive Data (chrome.storage.session or encrypted):**
```javascript
{
  session: "UUID-session-id-from-nexus",  // Session token
  pin: "1234",                              // User's PIN  
  genesis: "hash-value",                    // Account identifier
  username: "myusername"                    // Non-sensitive
}
```

**Persistent Data (chrome.storage.local - unencrypted):**
```javascript
{
  nodeUrl: "https://api.distordia.com",   // API endpoint
  approvedDomains: ["example.com"],        // dApp permissions
  // NO SENSITIVE DATA STORED HERE
}
```

### Why This Approach?

**✅ Advantages:**
1. **No disk exposure** - Data in RAM only (or encrypted with memory-only key)
2. **Automatic cleanup** - Cleared on browser close
3. **Industry standard** - Same approach as MetaMask, other major wallets
4. **No key management** - Encryption key (if needed) lives in memory only
5. **Browser-protected** - Leverages Chrome's security model
6. **Graceful degradation** - Fallback for browsers without session storage

**⚠️ Trade-offs:**
1. **Memory accessible while running** - Vulnerable to memory dumps (inherent to browser wallets)
2. **Public computers** - Must explicitly logout, don't rely on browser close alone
3. **No persistence** - Must re-authenticate each browser session
4. **Fallback complexity** - Encryption adds code complexity (but improves security)

## Session Management

### Blockchain Session Lifecycle

```
1. User Login
   └─> Create session on Nexus blockchain (username/password/PIN)
   └─> Store session ID + PIN in chrome.storage.session
   └─> Session unlocked with PIN

2. Active Use
   └─> Session ID used for all blockchain operations
   └─> PIN required for transaction approval
   └─> Lock status synced with blockchain

3. Logout/Browser Close
   └─> Retrieve PIN from session storage
   └─> Call sessions/terminate/local API with PIN
   └─> Clear chrome.storage.session data
   └─> Session terminated on blockchain
```

### Why Store PIN?

**Problem:** Nexus API requires PIN to terminate sessions on multi-user nodes

**Solution:** Store PIN in memory-only storage (chrome.storage.session)

**Why this is secure:**
- PIN never written to disk
- Cleared automatically on browser close
- Only used for session termination
- Alternative would be leaving active sessions on blockchain (worse security)

### Session Termination

When you logout or close the browser:

```javascript
// 1. Load session data from storage
const session = await storage.getSession();
const pin = await storage.getPin();

// 2. ATTEMPT to terminate on blockchain
try {
  await api.request('sessions/terminate/local', {
    pin: pin,
    session: session.session
  });
  console.log('Session terminated on blockchain');
} catch (error) {
  console.error('Failed to terminate on blockchain:', error);
  // SECURITY: Continue with local cleanup anyway
}

// 3. ALWAYS clear local storage (regardless of step 2 success)
await storage.clearSession();  // Removes session + PIN
```

**CRITICAL SECURITY PRINCIPLE:**
- ✅ **Local storage is ALWAYS cleared**, even if blockchain termination fails
- ✅ **Public computer safety** - Sensitive data never left on machine
- ⚠️ **Blockchain session** - May remain active if node offline (expires in ~24 hours)
- 🔒 **Local security prioritized** over remote cleanup

### Offline Node Scenario

**What happens if the node is offline when you logout/close browser?**

1. **Wallet attempts termination** (tries to contact node)
2. **Network error occurs** (timeout, connection failed)
3. **Local storage is CLEARED ANYWAY** ✅
   - Session ID removed
   - PIN removed  
   - Genesis/username removed
4. **Blockchain session remains active** ⚠️
   - Will expire naturally (typically 24 hours)
   - Cannot be used without local session ID (which is now deleted)
   - No risk to local machine security

**Why this is secure:**
- 🔒 Sensitive data never left on computer
- 🛡️ Compromised computer cannot access blockchain session (no local credentials)
- ⏳ Orphaned blockchain session times out automatically
- 🏛️ Safe for public computer use

## Code Security

### Content Security Policy (CSP)

The extension enforces a strict Content Security Policy to prevent code injection attacks:

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**What this blocks:**
- ❌ All inline `<script>` tags
- ❌ All `eval()` and `Function()` constructors
- ❌ All event handlers in HTML (`onclick=`, `onerror=`, etc.)
- ❌ External scripts from untrusted sources
- ✅ Only allows scripts from the extension package itself

**Why this is critical:**
- Prevents XSS (Cross-Site Scripting) attacks
- Blocks code injection even if bugs exist
- Defense-in-depth security layer
- Industry standard for browser extensions

**Example protection:**
```javascript
// Even if a malicious API returns this:
const maliciousResponse = '<script>stealCredentials()</script>';

// And buggy code does this:
container.innerHTML = maliciousResponse;

// CSP blocks the script from executing!
// Browser console shows: "Refused to execute inline script"
```

### XSS Prevention

All user-controlled and external data is sanitized before display:

**Safe DOM Manipulation:**
```javascript
// ❌ UNSAFE (vulnerable to XSS)
container.innerHTML = userInput;

// ✅ SAFE (CSP-compliant)
container.textContent = userInput;
// or
const div = document.createElement('div');
div.textContent = userInput;
container.appendChild(div);
```

**Implementation:**
- ✅ All `innerHTML` usage eliminated from extension pages
- ✅ User inputs displayed via `textContent` (auto-escapes)
- ✅ Dynamic content created with `createElement()` + `textContent`
- ✅ No string concatenation for HTML generation

**Protection layers:**
1. **Input validation** - Sanitize before use
2. **Output encoding** - Use `textContent` instead of `innerHTML`
3. **Content Security Policy** - Block execution even if bypassed

### Rate Limiting

Protection against brute force attacks:

**Login attempts:**
```javascript
// After failed login:
- Button disabled for 2 seconds
- Visual feedback: "Wait 2s..."
- Limits attempts to ~30 per minute
- Prevents automated brute force
```

**Implementation:**
```javascript
// popup.js
try {
  await wallet.login(username, password, pin);
} catch (error) {
  // Rate limit: 2-second lockout
  loginBtn.disabled = true;
  loginBtn.textContent = 'Wait 2s...';
  
  setTimeout(() => {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }, 2000);
}
```

**Additional protections:**
- Nexus API enforces server-side rate limiting
- Account lockout after too many failed attempts (API-level)
- Failed attempts logged for security monitoring

### Input Validation

All user inputs are validated before processing:

**Transaction validation:**
```javascript
// Amount validation
if (isNaN(amount) || amount <= 0) {
  throw new Error('Invalid amount');
}

// Reference validation (64-bit unsigned integer)
if (reference !== undefined) {
  const refNum = BigInt(reference);
  if (refNum < 0n || refNum > 18446744073709551615n) {
    throw new Error('Invalid reference');
  }
}

// Address validation
if (!to || to.trim() === '') {
  throw new Error('Recipient address required');
}
```

**URL validation:**
```javascript
// HTTPS enforcement for remote nodes
const urlObj = new URL(nodeUrl);
if (urlObj.hostname !== 'localhost' && 
    urlObj.hostname !== '127.0.0.1' &&
    !urlObj.hostname.startsWith('192.168.') &&
    !urlObj.hostname.startsWith('10.') &&
    urlObj.protocol === 'http:') {
  throw new Error('HTTPS required for remote connections');
}
```

### No Unsafe Code Patterns

**What we DON'T use:**
- ❌ `eval()` - Never used
- ❌ `Function()` constructor - Never used
- ❌ `setTimeout(string)` - Never used
- ❌ `setInterval(string)` - Never used
- ❌ `innerHTML` with dynamic content - Eliminated
- ❌ Inline event handlers - Not used
- ❌ `dangerouslySetInnerHTML` - Not applicable (vanilla JS)

**Code verification:**
```bash
# Verify no unsafe patterns
grep -r "eval(" *.js          # ✅ None found
grep -r "innerHTML" *.js       # ✅ Only safe debug logs
grep -r "onclick=" *.html      # ✅ None in extension pages
```

## Threat Model

### Threats We Protect Against

| Threat | Protection |
|--------|-----------|
| **Stolen computer (powered off)** | ✅ No sensitive data on disk (RAM-only or encrypted with memory key) |
| **Stolen computer (after browser close)** | ✅ All session data cleared from RAM, encryption key lost |
| **Public computer with offline node** | ✅ Local data cleared regardless of network status |
| **Malicious extension** | ✅ Isolated storage, chrome.storage.session not accessible |
| **Malicious website** | ✅ Content script isolation, no direct access to wallet |
| **Network MITM** | ✅ HTTPS enforcement for remote nodes |
| **Unauthorized transactions** | ✅ PIN required for all transactions |
| **Session hijacking** | ✅ Sessions terminated on logout/close (local data always cleared) |
| **Disk forensics (fallback mode)** | ✅ Data encrypted, key in memory only (unrecoverable) |
| **XSS attacks** | ✅ Content Security Policy + textContent usage |
| **Code injection** | ✅ CSP blocks eval(), inline scripts, and unsafe patterns |
| **Brute force login** | ✅ Rate limiting (2-second delay after failed attempts) |
| **Malicious API responses** | ✅ CSP prevents script execution from compromised node |

### Threats We Don't Protect Against

| Threat | Why | Mitigation |
|--------|-----|------------|
| **Memory dumps while running** | Browser limitation | Use hardware wallet for large amounts |
| **Compromised browser** | Root access = game over | Keep browser/OS updated |
| **Keyloggers** | Can capture PIN/password | Use secure, trusted computers |
| **Physical access (while running)** | Can interact with open browser | Lock screen when away |
| **Malicious node** | Node sees transactions | Use trusted nodes only |

## Alternative Approaches

### Our Encrypted Fallback Approach

**Implementation:**
```javascript
// Generate memory-only encryption key (lost on reload)
this.encryptionKey = generateRandomKey(); // Lives in JavaScript memory

// Encrypt before storing
const encrypted = encrypt(sensitiveData, this.encryptionKey);
chrome.storage.local.set({ encrypted }); // Encrypted data on disk

// On extension reload: Key lost = data unrecoverable
```

**Why this works:**
- ✅ Encryption key NEVER written to disk
- ✅ Key lives in JavaScript memory only
- ✅ Extension reload/close = key lost forever
- ✅ Encrypted data on disk is useless without key
- ✅ Better than plaintext fallback

### Why Not Persistent Encryption?

**Option:** Store encrypted PIN/session on disk with persistent key

**Why we don't:**
```javascript
// Where to store encryption key?
const encryptedPIN = encrypt(PIN, encryptionKey);
chrome.storage.local.set({ encryptedPIN }); // On disk

// Problem: Where does encryptionKey come from?
// 1. Hardcoded in extension? → No security (source is public/auditable)
// 2. Stored on disk? → Defeats encryption purpose
// 3. Derived from password? → Must store password (circular problem)
// 4. User enters each time? → Same as just entering PIN
```

**Conclusion:** Persistent encryption doesn't add real security

### Why Not Hardware Wallet?

**Option:** Use hardware device (Ledger, Trezor, etc.)

**Challenges:**
- Browser extension limitations (no USB access in Manifest V3)
- Nexus doesn't have hardware wallet support yet
- Would require desktop/mobile app

**Future:** Consider for mobile/desktop versions

### Why Not Password-Only (No PIN Storage)?

**Option:** Never store PIN, require entry each time

**Trade-offs:**
```
✅ Pros:
- PIN never in memory longer than needed
- User actively confirms logout

❌ Cons:
- Can't terminate session on browser close
- Leaves active sessions on blockchain (security risk)
- Worse user experience (can't close browser safely)
```

**Decision:** Storing PIN in session memory is more secure overall

## Security Auditing

### Open Source Transparency

This wallet is open source for several reasons:

1. **Community review** - Anyone can audit the code
2. **No hidden backdoors** - Verify we're not stealing credentials
3. **Industry standard** - All major wallets are open source
4. **Trust through transparency** - Don't trust, verify

### What to Audit

**Critical files:**
```
manifest.json           - Content Security Policy configuration
services/storage.js     - Session storage implementation
services/wallet.js      - Session management and PIN handling
background.js          - Service worker, session cleanup
services/nexus-api.js  - API communication (no credential leakage)
popup.js               - UI logic (XSS prevention, rate limiting)
content.js             - Content script injection
inpage.js              - dApp provider (isolated execution)
```

**Key security checks:**
- ✅ No credentials sent to external servers
- ✅ PIN/session only in chrome.storage.session
- ✅ Proper cleanup on logout/browser close
- ✅ HTTPS enforcement for remote nodes
- ✅ Session termination on blockchain
- ✅ Content Security Policy properly configured
- ✅ No eval() or Function() usage
- ✅ No innerHTML with dynamic content
- ✅ Rate limiting on authentication
- ✅ Input validation on all user inputs

### Reporting Security Issues

Found a vulnerability? Please report responsibly:

1. **Do NOT** open a public GitHub issue
2. Contact: [security contact email]
3. Allow time for fix before disclosure
4. Provide detailed reproduction steps

## Best Practices for Users

### Daily Use
- ✅ Use strong, unique password and PIN
- ✅ Only connect to trusted dApps
- ✅ Verify transaction details before approving
- ✅ Keep browser and OS updated
- ✅ Use HTTPS for remote nodes

### Ending Session
- ✅ Click Logout button (don't just close browser)
- ✅ Verify logout success before walking away
- ✅ On public computers: Logout + clear browser data

### Large Amounts
- ⚠️ Consider using Nexus desktop wallet for large holdings
- ⚠️ Browser wallets are convenient but not as secure as hardware
- ⚠️ Don't use on untrusted/public computers

## Comparison to Other Wallets

| Feature | Q-Wallet | MetaMask | Nexus Desktop |
|---------|----------|----------|---------------|
| **Storage** | chrome.storage.session | chrome.storage.session | Encrypted file on disk |
| **Auto-clear** | Browser close | Browser close | No (persistent) |
| **Session term** | Yes (with PIN) | N/A (Ethereum different) | Yes |
| **Hardware support** | No | Yes (Ledger/Trezor) | No |
| **Platform** | Browser extension | Browser extension | Desktop app |

**Conclusion:** Q-Wallet uses the same security model as industry-standard browser wallets, adapted for Nexus blockchain's session architecture.

## Technical Details

### Chrome Storage API Limits

```javascript
// chrome.storage.session (MV3)
- Max storage: 10 MB
- Cleared: On browser close
- Persistence: Session only
- Sync: Not synced across devices
- Access: Extension only

// chrome.storage.local
- Max storage: 5 MB (unlimitedStorage permission)
- Cleared: Never (until user clears browser data)
- Persistence: Permanent
- Sync: Not synced (we use local, not sync)
- Access: Extension only
```

### Session Storage Keys

```javascript
// Session storage (memory-only)
'session'       // Nexus session ID
'pin'           // User's PIN
'session_session' // Fallback key (MV2 compatibility)
'session_pin'     // Fallback key (MV2 compatibility)

// Local storage (persistent)
'nodeUrl'         // API endpoint
'approvedDomains' // dApp permissions
'walletConfig'    // Non-sensitive settings
```

## Conclusion

The security architecture of Q-Wallet represents a careful balance between:
- **Security** - Memory-only storage, automatic cleanup
- **Usability** - No constant PIN prompts, safe browser close
- **Industry standards** - Same approach as trusted wallets
- **Blockchain integration** - Proper session termination

For most users, this provides excellent security for day-to-day use. For very large amounts or maximum security, consider the Nexus desktop wallet or hardware wallet solutions (when available).
