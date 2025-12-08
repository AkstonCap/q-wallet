# Mobile Wallet Developer Guide

## Development Setup

This guide will help you set up and contribute to the Q-Wallet mobile application.

## Prerequisites

- Node.js 18+ and npm
- Git
- Expo CLI (`npm install -g expo-cli`)
- For iOS development: Mac with Xcode
- For Android development: Android Studio

## Development Environment Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/AkstonCap/q-wallet.git
cd q-mobile

# Install dependencies
npm install
```

### Step 2: Start Development Server

```bash
# Start Expo development server
npm start

# This will open Expo DevTools in your browser
```

### Step 3: Run on Device/Simulator

**iOS Simulator (Mac only):**
```bash
npm run ios
```

**Android Emulator:**
```bash
npm run android
```

**Physical Device:**


## Project Architecture

### Directory Structure

```
src/
├── screens/              # React Native screen components
│   ├── LoginScreen.js
│   ├── WalletScreen.js
│   ├── SendScreen.js
│   ├── ReceiveScreen.js
│   ├── SettingsScreen.js
│   ├── CreateAccountScreen.js
│   └── TransactionApprovalScreen.js
├── services/             # Business logic and API services
│   ├── nexus-api.js     # Nexus blockchain API client
│   ├── storage.js       # Storage service (AsyncStorage + SecureStore)
│   └── wallet.js        # Wallet service (high-level wallet operations)
└── styles/
    └── common.js         # Shared styles and theme
```

### Service Layer

**nexus-api.js**: Handles all Nexus blockchain API calls
- Session management (login/logout)
- Account operations (get, list, create)
- Transactions (send, receive, history)
- Balance queries

**storage.js**: Manages persistent and secure storage
- Uses AsyncStorage for non-sensitive data
- Uses SecureStore for sensitive data (session tokens, credentials)
- Provides wallet-specific storage methods

**wallet.js**: High-level wallet service
- Combines API and storage services
- Manages wallet state
- Provides simplified interface for screens

### Screen Components

Each screen is a React Native functional component:
- Uses React hooks (useState, useEffect)
- Implements SafeAreaView for proper device spacing
- Uses commonStyles for consistent UI
- Handles loading states and error messages

## Development Guidelines

### Code Style

- Use functional components with hooks
- Use async/await for asynchronous operations
- Handle errors with try/catch blocks
- Show user-friendly error messages with Alert
- Use commonStyles for consistent styling

### Adding a New Screen

1. Create file in `src/screens/`
2. Import required dependencies
3. Implement screen component
4. Add to navigation in `App.js`
5. Test on both iOS and Android

### Adding a New API Method

1. Add method to `nexus-api.js`
2. Add high-level method to `wallet.js`
3. Use in screen components
4. Handle errors appropriately

### Security Best Practices

- Never log sensitive data (PINs, passwords, session tokens)
- Use SecureStore for all sensitive data
- Validate all user inputs
- Require PIN for transactions
- Clear session on logout

## Testing

### Manual Testing

```bash
# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Test on physical device with Expo Go
npm start
# Then scan QR code
```

### Testing Checklist

- [ ] Login with valid credentials
- [ ] Login with invalid credentials (error handling)
- [ ] View balance and transactions
- [ ] Send transaction with PIN
- [ ] Cancel transaction
- [ ] Receive - display address and QR code
- [ ] Create new account
- [ ] Change node settings
- [ ] Logout
- [ ] Pull-to-refresh on wallet screen

## Building for Production

### iOS Build

```bash
# Build for iOS
expo build:ios

# Or with EAS Build (recommended)
eas build --platform ios
```

### Android Build

```bash
# Build for Android
expo build:android

# Or with EAS Build (recommended)
eas build --platform android
```

## Debugging

### React Native Debugger

1. Open app in Expo Go or simulator
2. Shake device or press Cmd+D (iOS) / Cmd+M (Android)
3. Select "Debug Remote JS"
4. Open Chrome DevTools

### Viewing Logs

```bash
# View logs from Expo CLI
# Logs appear automatically in terminal where you ran npm start

# Or use React Native Debugger
# or Expo DevTools
```

### Common Issues

**Build fails:**
- Clear cache: `expo start -c`
- Delete node_modules: `rm -rf node_modules && npm install`

**App crashes on startup:**
- Check error logs in terminal
- Verify all dependencies are installed
- Check for syntax errors

**API connection fails:**
- Verify node URL is correct
- Check network connectivity
- Ensure node is running and accessible

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Commit: `git commit -am 'Add feature'`
5. Push: `git push origin feature-name`
6. Create Pull Request

### Pull Request Guidelines

- Describe changes clearly
- Include screenshots for UI changes
- Test on both iOS and Android
- Follow existing code style
- Update documentation if needed

## Resources

- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Nexus API Documentation](Nexus%20api%20docs/API/README.MD)

## Support

For issues or questions:
- GitHub Issues: https://github.com/AkstonCap/q-wallet/issues
- Nexus Community: https://nexus.io/community

---

**Note**: This is a mobile application. For browser extension development, see the `browser-extension` branch.
    }

    async function sendTransaction() {
      const recipient = document.getElementById('recipient').value;
      const amount = parseFloat(document.getElementById('amount').value);

      if (!recipient || !amount || amount <= 0) {
        alert('Please enter valid recipient and amount');
        return;
      }

      try {
        const result = await window.nexus.sendTransaction({
          from: 'default',
          to: recipient,
          amount: amount,
          reference: 'Payment from dApp'
        });
        alert('Transaction successful! TX: ' + result.txid);
      } catch (error) {
        alert('Transaction failed: ' + error.message);
      }
    }
  </script>
</body>
</html>
```

## API Reference

### window.nexus.connect()
Request connection to user's wallet. Shows approval popup.

**Returns:** `Promise<string[]>` - Array with account address/name

**Example:**
```javascript
const accounts = await window.nexus.connect();
```

### window.nexus.getAccounts()
Get connected accounts without showing popup.

**Returns:** `Promise<string[]>` - Array of accounts, or empty if not connected

**Example:**
```javascript
const accounts = await window.nexus.getAccounts();
const isConnected = accounts.length > 0;
```

### window.nexus.getBalance(account?)
Get account balance in NXS.

**Parameters:**
- `account` (string, optional): Account name, default is 'default'

**Returns:** `Promise<number>` - Balance in NXS

**Example:**
```javascript
const balance = await window.nexus.getBalance('default');
```

### window.nexus.sendTransaction(params)
Send NXS transaction (requires user PIN approval).

**Parameters:**
```javascript
{
  from: string,      // Sender account name
  to: string,        // Recipient address or username
  amount: number,    // Amount in NXS
  reference?: string // Optional memo
}
```

**Returns:** `Promise<{txid: string}>` - Transaction result

**Example:**
```javascript
const result = await window.nexus.sendTransaction({
  from: 'default',
  to: 'recipient_address',
  amount: 10.5,
  reference: 'Payment'
});
```

### window.nexus.getTransactionHistory(limit?)
Get transaction history for connected account.

**Parameters:**
- `limit` (number, optional): Max transactions, default 50

**Returns:** `Promise<Transaction[]>` - Array of transactions

**Example:**
```javascript
const txs = await window.nexus.getTransactionHistory(10);
txs.forEach(tx => console.log(tx.amount, 'NXS'));
```

### window.nexus.isWalletConnected()
Check if wallet is connected.

**Returns:** `Promise<boolean>`

**Example:**
```javascript
const connected = await window.nexus.isWalletConnected();
```

## Common Patterns

### Initialize on Page Load

```javascript
window.addEventListener('load', async () => {
  if (typeof window.nexus === 'undefined') {
    showInstallPrompt();
    return;
  }

  const accounts = await window.nexus.getAccounts();
  if (accounts.length > 0) {
    initializeApp(accounts[0]);
  } else {
    showConnectButton();
  }
});
```

### Handle Connection State

```javascript
let isConnected = false;

async function checkConnection() {
  const accounts = await window.nexus.getAccounts();
  isConnected = accounts.length > 0;
  
  if (isConnected) {
    updateUIConnected(accounts[0]);
  } else {
    updateUIDisconnected();
  }
}

// Check periodically
setInterval(checkConnection, 5000);
```

### Validate User Input

```javascript
async function sendTransaction() {
  const recipient = getRecipient();
  const amount = getAmount();

  // Validate
  if (!recipient) {
    showError('Please enter recipient');
    return;
  }

  if (isNaN(amount) || amount <= 0) {
    showError('Please enter valid amount');
    return;
  }

  // Get current balance
  const balance = await window.nexus.getBalance('default');
  if (amount > balance) {
    showError('Insufficient balance');
    return;
  }

  // Send
  try {
    await window.nexus.sendTransaction({
      from: 'default',
      to: recipient,
      amount: amount
    });
    showSuccess('Transaction sent!');
  } catch (error) {
    showError('Transaction failed: ' + error.message);
  }
}
```

### Show Transaction Status

```javascript
async function sendWithProgress(recipient, amount) {
  const progressDiv = document.getElementById('progress');
  
  try {
    progressDiv.textContent = 'Requesting approval...';
    
    const result = await window.nexus.sendTransaction({
      from: 'default',
      to: recipient,
      amount: amount
    });
    
    progressDiv.textContent = 'Transaction sent!';
    showTransactionLink(result.txid);
    
  } catch (error) {
    progressDiv.textContent = 'Transaction failed';
    console.error(error);
  }
}
```

## Error Handling

### Connection Errors

```javascript
try {
  await window.nexus.connect();
} catch (error) {
  if (error.message.includes('denied')) {
    // User clicked "Deny"
    alert('Please approve the connection to use this app');
  } else if (error.message.includes('not connected')) {
    // User not logged into wallet
    alert('Please log in to Q-Wallet');
  } else {
    console.error('Connection error:', error);
  }
}
```

### Transaction Errors

```javascript
try {
  await window.nexus.sendTransaction({...});
} catch (error) {
  if (error.message.includes('denied')) {
    // User cancelled transaction
    alert('Transaction cancelled');
  } else if (error.message.includes('insufficient')) {
    // Not enough balance
    alert('Insufficient balance');
  } else if (error.message.includes('Invalid PIN')) {
    // Wrong PIN entered
    alert('Invalid PIN, please try again');
  } else {
    console.error('Transaction error:', error);
  }
}
```

## Testing Your dApp

### Local Testing Setup

1. **Install Q-Wallet extension**
2. **Run Nexus node locally:**
   ```bash
   ./nexus -noapiauth
   ```
3. **Create test wallet** in the extension
4. **Open your dApp** in the browser
5. **Test connection and transactions**

### Test Checklist

- [ ] Wallet detection works
- [ ] Connect button shows approval popup
- [ ] Approval grants access
- [ ] Balance displays correctly
- [ ] Transaction form validates input
- [ ] Send transaction shows PIN popup
- [ ] Transaction completes successfully
- [ ] Errors are handled gracefully
- [ ] Disconnect/reconnect works

### Common Test Scenarios

```javascript
// Test 1: No wallet installed
// Expected: Show install prompt

// Test 2: Wallet installed, not connected
// Expected: Show connect button

// Test 3: Connect wallet
// Expected: Approval popup appears
// Action: Click "Approve"
// Expected: Account info displays

// Test 4: Send transaction
// Expected: PIN confirmation popup
// Action: Enter PIN
// Expected: Transaction succeeds

// Test 5: Send invalid amount
// Expected: Validation error before popup

// Test 6: User cancels transaction
// Expected: Error handled gracefully
```

## Best Practices

### Security

✅ **Always validate user input** before sending to wallet
✅ **Use HTTPS** for production dApps
✅ **Never store user credentials** (wallet handles this)
✅ **Handle errors gracefully** - don't expose technical details
✅ **Test with small amounts** during development
✅ **Show clear transaction details** to user before requesting

### User Experience

✅ **Check wallet installation** on page load
✅ **Show clear connection status** (connected/disconnected)
✅ **Provide feedback** during operations (loading states)
✅ **Explain why you need access** before requesting connection
✅ **Handle rejection gracefully** - don't keep prompting
✅ **Show transaction status** (pending, confirmed, failed)

### Performance

✅ **Cache balance** instead of requesting every second
✅ **Don't spam connection requests**
✅ **Use connection state** from getAccounts()
✅ **Batch multiple reads** when possible

## Example Projects

### Simple Payment dApp
Accept NXS payments for products/services.

```javascript
const products = {
  'item1': { name: 'Premium Plan', price: 100 },
  'item2': { name: 'Basic Plan', price: 50 }
};

async function purchaseItem(itemId) {
  const item = products[itemId];
  
  try {
    const result = await window.nexus.sendTransaction({
      from: 'default',
      to: 'YOUR_MERCHANT_ADDRESS',
      amount: item.price,
      reference: `Purchase: ${item.name}`
    });
    
    // Activate purchase
    activatePurchase(itemId, result.txid);
  } catch (error) {
    console.error('Purchase failed:', error);
  }
}
```

### Donation Widget

```javascript
async function donate(amount) {
  if (typeof window.nexus === 'undefined') {
    alert('Install Q-Wallet to donate');
    return;
  }

  try {
    await window.nexus.sendTransaction({
      from: 'default',
      to: 'DONATION_ADDRESS',
      amount: amount,
      reference: 'Donation'
    });
    
    showThankYou();
  } catch (error) {
    console.log('Donation cancelled');
  }
}
```

### Balance Display Widget

```javascript
async function showWalletBalance() {
  if (typeof window.nexus === 'undefined') {
    return;
  }

  const accounts = await window.nexus.getAccounts();
  if (accounts.length === 0) {
    return; // Not connected
  }

  const balance = await window.nexus.getBalance('default');
  document.getElementById('balance').textContent = `${balance} NXS`;
}
```

## Resources

- **Full Integration Guide**: [DAPP-INTEGRATION.md](DAPP-INTEGRATION.md)
- **Example dApp**: See `example-dapp.html` in the repository
- **Wallet Documentation**: [README.md](README.md)
- **Nexus API Docs**: [Nexus api docs/](Nexus%20api%20docs/)
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)

## Need Help?

- **Issues**: Report problems on GitHub
- **Questions**: Check existing issues or create a new one
- **Community**: Join the Nexus blockchain community
- **Examples**: See `example-dapp.html` for working code

---

**Happy building! 🚀**
