# Developer Guide - Nexus Wallet Extension

## Architecture Overview

The Nexus Wallet is built as a Chrome Manifest V3 extension using vanilla JavaScript with no build tools required.

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Browser Extension                  │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Popup UI   │  │  Background  │  │  Content  │ │
│  │  (popup.js)  │◄─┤   Service    │◄─┤  Script   │ │
│  └──────────────┘  │   Worker     │  │           │ │
│         │          └──────────────┘  └───────────┘ │
│         ▼                 │                 │       │
│  ┌──────────────┐         ▼                 ▼       │
│  │   Services   │  ┌─────────────┐   ┌──────────┐  │
│  │  - wallet.js │  │   Chrome    │   │  Inpage  │  │
│  │  - api.js    │  │   Storage   │   │ Provider │  │
│  │  - storage.js│  └─────────────┘   └──────────┘  │
│  └──────────────┘                           │       │
│         │                                    ▼       │
└─────────┼────────────────────────────────────┼──────┘
          │                                    │
          ▼                                    ▼
   ┌─────────────┐                      ┌──────────┐
   │   Nexus     │                      │   dApp   │
   │   Node      │                      │   Page   │
   │   (API)     │                      │          │
   └─────────────┘                      └──────────┘
```

### File Structure

```
qwallet/
├── manifest.json              # Extension manifest (Manifest V3)
├── popup.html                 # Wallet UI
├── popup.js                   # UI controller and event handlers
├── background.js              # Service worker (message handling)
├── content.js                 # Content script (message relay)
├── inpage.js                  # Injected provider (window.nexus)
│
├── services/
│   ├── nexus-api.js          # Nexus blockchain API wrapper
│   ├── storage.js            # Chrome storage wrapper
│   └── wallet.js             # Core wallet logic
│
├── styles/
│   └── popup.css             # Wallet UI styles
│
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── docs/
    ├── README.md             # Main documentation
    ├── QUICKSTART.md         # Quick start guide
    └── DEVELOPER.md          # This file
```

## Core Concepts

### 1. Service Worker (background.js)

The background script runs as a service worker and handles:
- Message passing between popup and content scripts
- Persistent wallet state
- Background tasks (balance updates)
- dApp connection management

**Key Functions:**
```javascript
handleMessage(request, sender) // Routes messages to appropriate handlers
handleDAppConnection()          // Manages dApp connection requests
handleSignTransaction()         // Handles transaction signing
```

### 2. Popup UI (popup.js)

The popup provides the main user interface:
- Login/Create wallet screens
- Wallet dashboard (balance, transactions)
- Send/Receive screens
- Settings

**Key Functions:**
```javascript
showScreen(screenName)         // Navigate between screens
loadWalletData()              // Refresh wallet information
handleSend()                  // Process send transactions
```

### 3. Nexus API Service (services/nexus-api.js)

Wrapper around Nexus blockchain API:
- Session management
- Account operations
- Transaction handling
- Blockchain queries

**Key Methods:**
```javascript
createSession(username, password, pin)  // Login
debit(account, amount, recipient)       // Send transaction
getAccount(name)                        // Get account details
getTransactions()                       // Get tx history
```

### 4. Wallet Service (services/wallet.js)

High-level wallet operations:
- Wallet creation and login
- Balance management
- Transaction processing
- State management

**Key Methods:**
```javascript
createWallet(username, password, pin)
login(username, password, pin)
send(account, amount, recipient)
getBalance(account)
```

### 5. Storage Service (services/storage.js)

Abstraction over Chrome storage API:
- Session persistence
- Wallet configuration
- Transaction cache

**Key Methods:**
```javascript
saveSession(sessionData)
getSession()
saveWalletConfig(config)
```

### 6. dApp Provider (inpage.js)

Injected into web pages as `window.nexus`:
- Connection management
- Transaction signing
- Balance queries
- Event handling

**Key Methods:**
```javascript
connect()                      // Connect to wallet
sendTransaction(params)        // Send transaction
getBalance(account)           // Get balance
```

## Message Passing Flow

### Popup ↔ Background

```javascript
// From popup.js
chrome.runtime.sendMessage({
  method: 'wallet.getBalance',
  params: { account: 'default' }
}, (response) => {
  console.log('Balance:', response.result);
});

// Handled in background.js
case 'wallet.getBalance':
  return { result: await wallet.getBalance(params.account) };
```

### dApp → Content → Background → Nexus API

```javascript
// 1. dApp (inpage.js)
window.nexus.getBalance()

// 2. Sends message via window.postMessage
window.postMessage({
  type: 'NEXUS_PROVIDER_REQUEST',
  method: 'account.getBalance'
})

// 3. Content script relays to background
chrome.runtime.sendMessage({ method: 'account.getBalance' })

// 4. Background calls API
return { result: await wallet.getBalance() }

// 5. Response flows back through the chain
```

## Development Workflow

### 1. Making Changes

```bash
# Edit files
code services/wallet.js

# Reload extension
# Go to chrome://extensions
# Click reload icon on Nexus Wallet
```

### 2. Testing

**Test Popup:**
1. Click extension icon
2. Open DevTools (F12)
3. Console shows errors/logs

**Test Background:**
1. Go to `chrome://extensions`
2. Click "Inspect views: service worker"
3. DevTools opens for background script

**Test Content Script:**
1. Open a webpage
2. Open DevTools (F12)
3. Check Console for content script logs

**Test API Calls:**
```bash
# Test Nexus node directly
curl -X POST http://localhost:8080/sessions/create/local \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123","pin":"1234"}'
```

### 3. Debugging Tips

**Enable verbose logging:**
```javascript
// Add to any file
console.log('[WALLET]', 'Detailed info:', data);
```

**Check storage:**
```javascript
// In popup or background console
chrome.storage.local.get(null, (data) => console.log(data));
```

**Monitor messages:**
```javascript
// In background.js
chrome.runtime.onMessage.addListener((request) => {
  console.log('Message received:', request);
});
```

## API Integration

### Adding New Nexus API Endpoint

1. **Add to nexus-api.js:**
```javascript
// Get staking rewards
async getStakingRewards(session) {
  return this.request('finance/get/stakerewards', { session });
}
```

2. **Add to wallet.js:**
```javascript
async getStakingRewards() {
  try {
    return await this.api.getStakingRewards(this.session);
  } catch (error) {
    console.error('Failed to get staking rewards:', error);
    throw error;
  }
}
```

3. **Add to background.js message handler:**
```javascript
case 'staking.getRewards':
  return { result: await wallet.getStakingRewards() };
```

4. **Use in popup.js:**
```javascript
async function loadStakingRewards() {
  const rewards = await chrome.runtime.sendMessage({
    method: 'staking.getRewards'
  });
  console.log('Rewards:', rewards);
}
```

## UI Development

### Adding New Screen

1. **Add HTML in popup.html:**
```html
<div id="staking-screen" class="screen hidden">
  <div class="header">
    <button id="back-from-staking-btn" class="back-btn">← Back</button>
    <h2>Staking</h2>
  </div>
  <div class="content">
    <!-- Your content here -->
  </div>
</div>
```

2. **Add styles in popup.css:**
```css
#staking-screen {
  /* Your styles */
}
```

3. **Add logic in popup.js:**
```javascript
document.getElementById('staking-btn').addEventListener('click', () => {
  showScreen('staking');
  loadStakingData();
});

async function loadStakingData() {
  // Load staking information
}
```

### Adding New Component

```javascript
function createStakingItem(stake) {
  const div = document.createElement('div');
  div.className = 'staking-item';
  div.innerHTML = `
    <div class="stake-amount">${stake.amount} NXS</div>
    <div class="stake-rewards">${stake.rewards} NXS</div>
  `;
  return div;
}
```

## Security Considerations

### What to NEVER Store

❌ Private keys (handled by Nexus node)
❌ Plain-text passwords
❌ Unencrypted PINs
❌ Sensitive user data

### What's Safe to Store

✅ Session tokens (encrypted by Chrome)
✅ Public addresses
✅ Transaction cache
✅ User preferences
✅ Node URL

### Best Practices

1. **Always validate input:**
```javascript
if (!amount || isNaN(amount) || amount <= 0) {
  throw new Error('Invalid amount');
}
```

2. **Use try-catch for API calls:**
```javascript
try {
  await api.sendTransaction();
} catch (error) {
  showNotification('Transaction failed', 'error');
}
```

3. **Sanitize user input:**
```javascript
const username = input.trim().toLowerCase();
```

4. **Check authentication:**
```javascript
if (!wallet.isLoggedIn()) {
  throw new Error('Not logged in');
}
```

## Testing

### Manual Testing Checklist

- [ ] Create new wallet
- [ ] Login with existing wallet
- [ ] View balance
- [ ] Send transaction
- [ ] Receive transaction
- [ ] View transaction history
- [ ] Lock/unlock wallet
- [ ] Logout
- [ ] Change node URL
- [ ] Connect dApp
- [ ] Send from dApp

### Test Scenarios

**Test 1: Create Wallet**
```javascript
// Should create profile and default account
username: 'test123'
password: 'testpass123'
pin: '1234'
Expected: Success, redirects to wallet screen
```

**Test 2: Send Transaction**
```javascript
// Should send NXS to recipient
recipient: 'recipient-address'
amount: 10.5
Expected: Transaction sent, balance updated
```

**Test 3: dApp Connection**
```javascript
// Should connect wallet to dApp
1. Open example-dapp.html
2. Click "Connect Wallet"
Expected: Account address displayed
```

## Performance Optimization

### Caching Strategy

```javascript
// Cache frequently accessed data
let balanceCache = null;
let cacheTime = null;

async function getBalance() {
  const now = Date.now();
  if (balanceCache && (now - cacheTime) < 60000) {
    return balanceCache;
  }
  
  balanceCache = await api.getBalance();
  cacheTime = now;
  return balanceCache;
}
```

### Lazy Loading

```javascript
// Only load when needed
async function showTransactions() {
  if (!transactionsLoaded) {
    await loadTransactions();
    transactionsLoaded = true;
  }
}
```

## Common Issues

### Issue: Extension won't load
**Solution:** Check manifest.json syntax, ensure all files exist

### Issue: API calls fail
**Solution:** Verify Nexus node is running, check CORS settings

### Issue: Storage not persisting
**Solution:** Check Chrome storage API usage, ensure async/await

### Issue: dApp not detecting wallet
**Solution:** Check content script injection, verify inpage.js loaded

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes following code style
4. Test thoroughly
5. Commit: `git commit -m "Add feature"`
6. Push: `git push origin feature-name`
7. Create Pull Request

### Code Style

- Use camelCase for variables and functions
- Use PascalCase for classes
- Add JSDoc comments for complex functions
- Keep functions small and focused
- Use async/await over promises
- Handle errors gracefully

### Documentation

- Update README.md for user-facing changes
- Update this file for developer changes
- Add inline comments for complex logic
- Include examples in documentation

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Nexus API Documentation](../Nexus%20api%20docs/)
- [Web Extension APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

## Support

- GitHub Issues: Report bugs and request features
- Nexus Community: Get help from other developers
- API Documentation: Learn about Nexus blockchain APIs

---

**Happy Coding! 🚀**
