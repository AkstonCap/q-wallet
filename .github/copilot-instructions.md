# Q-Wallet AI Coding Instructions

## Project Overview
Distordia Q-Wallet is a Chrome/Firefox browser extension providing a secure cryptocurrency wallet for the Nexus blockchain. Architecture: Manifest V3 extension with vanilla JavaScript (no build process), communicating with Nexus blockchain nodes via JSON-RPC API.

## Core Architecture

### Extension Structure (Message-Passing Model)
- **background.js**: Service worker, central message hub, manages wallet state and dApp connections
- **popup.js/popup.html**: Main UI, sends messages to background for wallet operations
- **content.js**: Injected into all web pages, bridges between webpage and extension
- **inpage.js**: Injected into page context, provides `window.nexus` API for dApps
- **approve-*.html/js**: Modal windows for transaction/connection approvals

Message flow: `dApp → inpage.js → content.js → background.js → Nexus API`

### Service Layer ([services/](services/))
- **wallet.js**: `WalletService` - Core wallet logic, session management, Nexus API abstraction
- **nexus-api.js**: `NexusAPI` - Direct HTTP communication with Nexus node (JSON-RPC)
- **storage.js**: `StorageService` - chrome.storage wrapper with session/local storage abstraction
- **lib/logger.js**: `Logger` - Automatic redaction of sensitive fields (pin, password, session, genesis)

### Module System
Uses `importScripts()` in background.js (service worker context). Content/inpage scripts cannot import - they inline minimal logger implementations. No ES6 modules, no build step.

## Critical Patterns

### Security Model (READ THIS FIRST)
1. **Session Storage Priority**: Uses `chrome.storage.session` (RAM-only, never touches disk). Fallback to encrypted `chrome.storage.local` with memory-only encryption key.
2. **Quantum Resistance**: Leverages Nexus SigChain architecture (one-time keypairs per transaction). Wallet doesn't implement quantum crypto - Nexus blockchain provides it.
3. **Sensitive Data Handling**: ALL logging auto-redacts fields matching `SENSITIVE_FIELDS = ['pin', 'password', 'session', 'privatekey', 'genesis', 'username']`. NEVER log these directly.
4. **HTTPS Enforcement**: Remote nodes must use HTTPS (see [nexus-api.js](services/nexus-api.js) `validateAndSetNodeUrl()`).
5. **Lock State Sync**: Wallet can be locked (view-only) or unlocked. Lock state must sync between local storage and Nexus node session status.

### Message Passing Contract
All background.js messages follow: `{method: 'namespace.action', params: {...}}`

Examples:
```javascript
{method: 'wallet.login', params: {username, password, pin}}
{method: 'account.getBalance', params: {account: 'default'}}
{method: 'transaction.send', params: {account, amount, recipient, reference}}
{method: 'dapp.requestConnection', params: {origin}}
```

Responses: `{result: ...}` or `{error: 'message'}`

### dApp Connection Flow
1. dApp calls `window.nexus.connect()` (inpage.js)
2. Message passes through content.js → background.js → `handleDAppConnection()`
3. background.js opens approval window (`approve-connection.html`)
4. User approves/denies → response stored in `pendingApprovals` Map
5. Promise resolves → connection stored in `chrome.storage` with domain as key

**Critical**: Each dApp domain is checked against approved/blocked lists. Blocked domains throw immediately.

### Transaction Approval Pattern
Similar flow but uses `pendingTransactionApprovals` Map. Approval window (`approve-transaction.html`) requests PIN. Transaction executes ONLY after PIN validation. Window remains open to display result.

## Development Workflows

### No Build Process
Load directly in browser: `chrome://extensions` → "Load unpacked" → select project folder. Changes require extension reload (click refresh icon or Ctrl+R on extensions page).

### Testing
- **Manual**: Use [example-dapp.html](example-dapp.html) for dApp integration testing
- **Node Setup**: Requires running Nexus node (default: `http://localhost:8080`). Use `./nexus -noapiauth` for local testing.
- **Debugging**: Use Chrome DevTools:
  - Background worker: Extensions page → "Inspect views: service worker"
  - Popup: Right-click extension icon → "Inspect popup"
  - Content/Inpage: Regular page DevTools console

### Common Tasks
- **Add new wallet method**: Edit [services/wallet.js](services/wallet.js), add case to background.js `handleMessage()`, call from popup.js
- **Add dApp API method**: Add to [inpage.js](inpage.js) `NexusProvider` class, handle in background.js under `dapp.*` namespace
- **Modify UI**: Edit [popup.html](popup.html) + [popup.js](popup.js) (uses screen-based navigation with `showScreen()`)

## Nexus Blockchain Specifics

### Key Concepts
- **SigChain**: Signature chain providing quantum resistance via one-time keypairs
- **Genesis Hash**: Unique account identifier (like public key hash in other blockchains)
- **Session**: Authenticated connection to Nexus node (created on login, terminated on logout)
- **Accounts**: Named sub-accounts under one profile (e.g., 'default', 'savings')

### API Patterns (services/nexus-api.js)
All methods call `/endpoint` with POST JSON. Example:
```javascript
await api.request('users/login/user', {username, password, pin})
await api.request('finance/get/account', {session, name: 'default'})
```

See [Nexus api docs/](Nexus%20api%20docs/) for full API reference (especially [API/README.MD](Nexus%20api%20docs/API/README.MD)).

## Code Conventions

### Naming
- Classes: PascalCase with "Service" suffix (`WalletService`, `StorageService`)
- Methods: camelCase (`getBalance`, `sendTransaction`)
- Constants: UPPER_SNAKE_CASE (`SENSITIVE_FIELDS`, `DEBUG`)
- Files: kebab-case for multi-word (`approve-connection.js`)

### Error Handling
Always `try/catch` async operations. Throw errors with user-friendly messages - they're displayed directly in UI. Background.js catches and returns `{error: message}`.

### Async Patterns
Prefer async/await over promises. Use `sendResponse` with `return true` in message listeners for async responses.

### Comments
Minimal inline comments. Use doc-style headers for files explaining purpose. Security-critical code gets inline warnings (`// SECURITY: ...`).

## Key Files Reference
- [README.md](README.md) - User-facing installation/features
- [DEVELOPER.md](DEVELOPER.md) - dApp integration guide
- [SECURITY.md](SECURITY.md) - Detailed security architecture including quantum resistance
- [DAPP-INTEGRATION.md](DAPP-INTEGRATION.md) - Complete dApp API reference
- [manifest.json](manifest.json) - Extension configuration (permissions, CSP, scripts)

## Don't Do This
- ❌ Use innerHTML with dynamic content (XSS risk - violates CSP)
- ❌ Log sensitive fields without redaction
- ❌ Store session/PIN in chrome.storage.local without encryption
- ❌ Allow HTTP for remote node connections
- ❌ Create build tooling (keep it vanilla JS)
- ❌ Use ES6 modules in service worker context
- ❌ Close approval windows before user sees transaction result
