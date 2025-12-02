# dApp Integration Guide

## Connecting to Distordia Q-wallet

The Distordia Q-wallet provides a secure way for websites to interact with the Nexus blockchain through the browser extension.

## Security Model

### User Approval Required
When a website attempts to connect to your wallet for the first time, you'll receive a **notification** asking for approval:

- **Approve**: The site will be added to your approved list and can access wallet functions
- **Deny**: The connection request is rejected and the site cannot access your wallet

### Permission Management
- Only **approved sites** can call wallet functions
- **Blocked sites** are permanently denied access
- You can **revoke access** anytime from Settings → Connected Sites
- Each site connection is tracked by domain (e.g., `https://example.com`)

### What Sites Can Access
Approved sites can:
- Request your wallet address
- Request your account balance
- Request transaction history
- **Request to send transactions** (requires additional confirmation)

Approved sites **cannot**:
- Access your password or PIN
- Send transactions without your explicit approval
- Access your private keys

## For Website Developers

### Basic Connection

```javascript
// Check if wallet is installed
if (typeof window.nexus !== 'undefined') {
  console.log('Nexus wallet is installed!');
}

// Request connection (triggers approval notification)
async function connectWallet() {
  try {
    const accounts = await window.nexus.connect();
    console.log('Connected account:', accounts[0]);
  } catch (error) {
    console.error('User denied connection:', error);
  }
}

// Check existing connection
async function checkConnection() {
  try {
    const accounts = await window.nexus.getAccounts();
    if (accounts.length > 0) {
      console.log('Already connected:', accounts[0]);
    }
  } catch (error) {
    console.log('Not connected');
  }
}
```

### Get Balance

```javascript
async function getBalance() {
  try {
    const balance = await window.nexus.getBalance('default');
    console.log('Balance:', balance);
  } catch (error) {
    console.error('Failed to get balance:', error);
  }
}
```

### Send Transaction

```javascript
async function sendTransaction() {
  try {
    const result = await window.nexus.sendTransaction({
      from: 'default',
      to: 'recipient_address_or_username',
      amount: 10.5,
      reference: 'Payment for services'
    });
    console.log('Transaction sent:', result);
  } catch (error) {
    console.error('Transaction failed:', error);
  }
}
```

### Get Transaction History

```javascript
async function getHistory() {
  try {
    const transactions = await window.nexus.getTransactionHistory(50);
    console.log('Recent transactions:', transactions);
  } catch (error) {
    console.error('Failed to get history:', error);
  }
}
```

## Testing Your Integration

1. Load the extension in your browser
2. Log in to your wallet
3. Open your website
4. Call `window.nexus.connect()` - you should see an approval notification
5. Click **Approve** in the notification
6. Your site can now interact with the wallet

## Best Practices

### Handle Connection Errors
```javascript
try {
  const accounts = await window.nexus.connect();
  // Connection successful
} catch (error) {
  if (error.message.includes('denied')) {
    // User explicitly denied connection
    alert('Please approve wallet connection to continue');
  } else if (error.message.includes('not connected')) {
    // Wallet not logged in
    alert('Please log in to your Nexus wallet');
  } else {
    // Other error
    console.error('Connection error:', error);
  }
}
```

### Check Connection State
```javascript
async function initDApp() {
  // Check if wallet exists
  if (typeof window.nexus === 'undefined') {
    alert('Please install Distordia Q-wallet extension');
    return;
  }

  // Check if already connected
  const accounts = await window.nexus.getAccounts();
  if (accounts.length === 0) {
    // Not connected, request connection
    await window.nexus.connect();
  }
}
```

### Listen for Account Changes
```javascript
// Currently, you should periodically check connection
setInterval(async () => {
  const accounts = await window.nexus.getAccounts();
  if (accounts.length === 0) {
    // User disconnected
    handleDisconnect();
  }
}, 5000);
```

## Security Recommendations

### For Users
- Only approve connections for websites you trust
- Review connected sites regularly in Settings
- Revoke access for sites you no longer use
- Never approve connections from unfamiliar or suspicious sites

### For Developers
- Always handle connection errors gracefully
- Display clear information about why you need wallet access
- Never request more permissions than necessary
- Respect user's decision to deny connection
- Store minimal user data from wallet interactions

## Example dApp

See `example-dapp.html` for a complete working example demonstrating:
- Connection request with approval
- Balance checking
- Transaction sending
- Error handling

## Support

For issues or questions:
- Check the browser console for error messages
- Ensure you're logged into the wallet
- Verify the site is approved in Settings → Connected Sites
- Try revoking and re-approving the connection
