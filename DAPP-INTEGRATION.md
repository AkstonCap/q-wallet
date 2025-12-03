# dApp Integration Guide

## Connecting Your Website to Q-Wallet

The Q-Wallet browser extension provides a secure way for websites to interact with the Nexus blockchain, similar to how MetaMask works for Ethereum.

## How It Works

### Connection Approval
When your website attempts to connect to the wallet for the first time, the user receives a **popup notification** asking for approval:

- **Approve**: Your site is added to the approved list and can access wallet functions
- **Deny**: The connection is rejected and your site cannot access the wallet

### User Security
- Only **approved sites** can call wallet functions
- **All transactions** require the user to re-enter their PIN for confirmation
- Users can **revoke access** anytime from wallet Settings
- Each site connection is tracked by domain (e.g., `https://example.com`)

### What Your Site Can Do
After approval, your site can:
- Request the user's wallet address
- Request account balance
- Request transaction history
- **Request to send transactions** (user must approve each transaction with their PIN)

Your site **cannot**:
- Access the user's password or PIN
- Send transactions without user approval
- Access private keys
- Make transactions without the user confirming

## Getting Started

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

### Check existing connection
async function checkConnection() {
  try {
    const accounts = await window.nexus.getAccounts();
    if (accounts.length > 0) {
      console.log('Already connected:', accounts[0]);
      return true;
    }
    return false;
  } catch (error) {
    console.log('Not connected');
    return false;
  }
}
```

### Complete Example

```javascript
// Initialize your dApp
async function initDApp() {
  // 1. Check if wallet is installed
  if (typeof window.nexus === 'undefined') {
    alert('Please install Q-Wallet extension');
    return;
  }

  // 2. Check if already connected
  try {
    const accounts = await window.nexus.getAccounts();
    if (accounts.length > 0) {
      console.log('Already connected:', accounts[0]);
      updateUI(accounts[0]);
      return;
    }
  } catch (error) {
    console.log('Not connected yet');
  }

  // 3. Request connection
  document.getElementById('connectBtn').addEventListener('click', async () => {
    try {
      const accounts = await window.nexus.connect();
      console.log('Connected:', accounts[0]);
      updateUI(accounts[0]);
    } catch (error) {
      console.error('User denied connection:', error);
    }
  });
}

// Update your UI with wallet info
function updateUI(account) {
  document.getElementById('walletAddress').textContent = account;
  document.getElementById('connectBtn').style.display = 'none';
  document.getElementById('walletInfo').style.display = 'block';
}

// Initialize when page loads
window.addEventListener('load', initDApp);
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

### Send Transaction (with User Approval)

```javascript
async function sendNXS() {
  try {
    const result = await window.nexus.sendTransaction({
      from: 'default',                      // Account name
      to: 'recipient_username_or_address',  // Recipient
      amount: 10.5,                         // Amount in NXS
      reference: 'Payment for services'     // Optional memo
    });
    
    console.log('Transaction sent!');
    console.log('TX Hash:', result.txid);
    alert('Transaction successful!');
  } catch (error) {
    console.error('Transaction failed:', error);
    alert('Transaction cancelled or failed');
  }
}
```

**Important:** This will show a popup to the user asking them to confirm and enter their PIN. The transaction will only proceed if they approve it.

### Get Transaction History

```javascript
async function getTransactionHistory() {
  try {
    const transactions = await window.nexus.getTransactionHistory(50);
    console.log('Recent transactions:', transactions);
    
    // Display transactions
    transactions.forEach(tx => {
      console.log(`${tx.amount} NXS to ${tx.recipient}`);
    });
  } catch (error) {
    console.error('Failed to get history:', error);
  }
}
```

## Complete API Reference

### window.nexus.connect()
Request connection to the user's wallet. Shows approval popup to user.

**Returns:** `Promise<Array<string>>` - Array of account names/addresses

**Example:**
```javascript
const accounts = await window.nexus.connect();
// Returns: ['account-address-or-name']
```

### window.nexus.getAccounts()
Get currently connected accounts without requesting new connection.

**Returns:** `Promise<Array<string>>` - Array of account names, or empty array if not connected

**Example:**
```javascript
const accounts = await window.nexus.getAccounts();
if (accounts.length === 0) {
  // Not connected
}
```

### window.nexus.getBalance(account)
Get balance for specified account.

**Parameters:**
- `account` (string, optional): Account name, defaults to 'default'

**Returns:** `Promise<number>` - Balance in NXS

**Example:**
```javascript
const balance = await window.nexus.getBalance('default');
console.log(`Balance: ${balance} NXS`);
```

### window.nexus.sendTransaction(params)
Request to send a transaction. Shows approval popup to user with PIN requirement.

**Parameters:**
- `params.from` (string): Sender account name
- `params.to` (string): Recipient address or username
- `params.amount` (number): Amount to send in NXS
- `params.reference` (string, optional): Transaction memo

**Returns:** `Promise<object>` - Transaction result with txid

**Example:**
```javascript
const result = await window.nexus.sendTransaction({
  from: 'default',
  to: 'recipient',
  amount: 10.5,
  reference: 'Payment'
});
console.log('TX:', result.txid);
```

### window.nexus.getTransactionHistory(limit)
Get transaction history for the connected account.

**Parameters:**
- `limit` (number, optional): Maximum number of transactions, defaults to 50

**Returns:** `Promise<Array<object>>` - Array of transaction objects

**Example:**
```javascript
const txs = await window.nexus.getTransactionHistory(10);
```

### window.nexus.isWalletConnected()
Check if wallet is currently connected.

**Returns:** `Promise<boolean>`

**Example:**
```javascript
const connected = await window.nexus.isWalletConnected();
```

## Error Handling

Always wrap wallet calls in try-catch blocks and handle errors appropriately:

```javascript
try {
  const accounts = await window.nexus.connect();
  // Success
} catch (error) {
  if (error.message.includes('denied')) {
    // User denied the connection
    alert('Please approve the wallet connection to use this dApp');
  } else if (error.message.includes('not connected')) {
    // Wallet not logged in
    alert('Please log in to your Q-Wallet');
  } else {
    // Other error
    console.error('Wallet error:', error);
    alert('Failed to connect to wallet');
  }
}
```

## Best Practices

### 1. Check for Wallet Installation

```javascript
if (typeof window.nexus === 'undefined') {
  alert('Please install Q-Wallet: https://github.com/yourusername/qwallet');
  return;
}
```

### 2. Handle Connection State

```javascript
async function ensureConnection() {
  const accounts = await window.nexus.getAccounts();
  if (accounts.length === 0) {
    // Request connection
    await window.nexus.connect();
  }
  return true;
}
```

### 3. Validate User Input

```javascript
async function sendTransaction() {
  const amount = parseFloat(document.getElementById('amount').value);
  
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount');
    return;
  }
  
  const recipient = document.getElementById('recipient').value.trim();
  if (!recipient) {
    alert('Please enter a recipient');
    return;
  }
  
  // Proceed with transaction
  await window.nexus.sendTransaction({
    from: 'default',
    to: recipient,
    amount: amount
  });
}
```

### 4. Provide Clear User Feedback

```javascript
async function sendWithFeedback() {
  const button = document.getElementById('sendBtn');
  button.disabled = true;
  button.textContent = 'Processing...';
  
  try {
    const result = await window.nexus.sendTransaction({
      from: 'default',
      to: 'recipient',
      amount: 10
    });
    
    alert('Transaction successful!');
    console.log('TX:', result.txid);
  } catch (error) {
    alert('Transaction failed: ' + error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Send';
  }
}
```

### 5. Monitor Connection Status

```javascript
// Check connection periodically
setInterval(async () => {
  const accounts = await window.nexus.getAccounts();
  if (accounts.length === 0) {
    // User disconnected
    showConnectButton();
  }
}, 5000);
```

## Testing Your Integration

1. **Install the Q-Wallet extension** in your browser
2. **Create a wallet** and log in
3. **Open your website** with the integration code
4. **Click "Connect Wallet"** - you should see an approval popup
5. **Approve the connection** in the wallet
6. **Test all features:**
   - Getting balance
   - Viewing transaction history
   - Sending transactions (with PIN confirmation)

## Example Application

A complete example dApp is included in the wallet repository as `example-dapp.html`. It demonstrates:
- Wallet detection
- Connection request with approval
- Balance checking
- Transaction sending with error handling
- Transaction history display

## Common Issues

### "window.nexus is undefined"
- User doesn't have Q-Wallet installed
- Extension is disabled
- Page loaded before extension injected (wait for page load)

### "User denied connection"
- User clicked "Deny" in the approval popup
- Ask user to try again and click "Approve"

### "Not connected"
- User is not logged into their wallet
- Ask them to open Q-Wallet and log in

### "Transaction failed"
- User cancelled the transaction
- User entered wrong PIN
- Insufficient balance
- Network/node connection issue

## Security Recommendations

### For dApp Developers
1. ✅ Always handle user rejection gracefully
2. ✅ Validate all user inputs before sending to wallet
3. ✅ Show clear information about what your dApp will do
4. ✅ Never request more permissions than necessary
5. ✅ Respect user's decision to deny connection
6. ✅ Use HTTPS for your website
7. ✅ Test with small amounts first

### For Users
1. ✅ Only approve connections from websites you trust
2. ✅ Review all transaction details before confirming
3. ✅ Never share your PIN with anyone
4. ✅ Check the website URL before connecting
5. ✅ Revoke access for sites you no longer use (in wallet Settings)

## Need Help?

- **Example Code**: See `example-dapp.html` in the wallet repository
- **Wallet Docs**: Check the main [README.md](README.md)
- **Issues**: Report problems on GitHub
- **Community**: Join the Nexus community forums

---

**Start building amazing dApps on Nexus! 🚀**
