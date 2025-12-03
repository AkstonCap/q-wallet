# dApp Developer Guide

## Quick Start for Building Nexus dApps

This guide will help you integrate Q-Wallet into your decentralized application (dApp) to enable Nexus blockchain interactions.

## Prerequisites

- Basic knowledge of JavaScript and async/await
- A web application or website
- Q-Wallet extension installed for testing

## Integration in 5 Minutes

### Step 1: Check for Wallet

```javascript
// Check if Q-Wallet is installed
if (typeof window.nexus === 'undefined') {
  alert('Please install Q-Wallet extension');
  // Show installation instructions
  return;
}
```

### Step 2: Request Connection

```javascript
async function connectWallet() {
  try {
    const accounts = await window.nexus.connect();
    console.log('Connected to account:', accounts[0]);
    return accounts[0];
  } catch (error) {
    console.error('Connection denied:', error);
    return null;
  }
}
```

### Step 3: Get Balance

```javascript
async function checkBalance() {
  try {
    const balance = await window.nexus.getBalance('default');
    console.log('Balance:', balance, 'NXS');
    return balance;
  } catch (error) {
    console.error('Failed to get balance:', error);
    return 0;
  }
}
```

### Step 4: Send Transaction

```javascript
async function sendNXS(recipient, amount) {
  try {
    const result = await window.nexus.sendTransaction({
      from: 'default',
      to: recipient,
      amount: amount,
      reference: 'Payment from my dApp'
    });
    console.log('Transaction sent:', result.txid);
    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}
```

## Complete Example dApp

Here's a complete minimal dApp:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Nexus dApp</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    button { padding: 10px 20px; margin: 5px; cursor: pointer; }
    .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>My Nexus dApp</h1>
  
  <div id="wallet-status">
    <button id="connectBtn">Connect Wallet</button>
  </div>
  
  <div id="wallet-info" style="display: none;">
    <div class="info">
      <strong>Account:</strong> <span id="account"></span><br>
      <strong>Balance:</strong> <span id="balance"></span> NXS
    </div>
    
    <h3>Send NXS</h3>
    <input id="recipient" placeholder="Recipient address">
    <input id="amount" placeholder="Amount" type="number">
    <button id="sendBtn">Send</button>
  </div>

  <script>
    let currentAccount = null;

    // Initialize
    window.addEventListener('load', async () => {
      if (typeof window.nexus === 'undefined') {
        alert('Please install Q-Wallet');
        return;
      }

      // Check if already connected
      const accounts = await window.nexus.getAccounts();
      if (accounts.length > 0) {
        onConnected(accounts[0]);
      }

      // Connect button
      document.getElementById('connectBtn').onclick = async () => {
        try {
          const accounts = await window.nexus.connect();
          onConnected(accounts[0]);
        } catch (error) {
          alert('Connection denied');
        }
      };

      // Send button
      document.getElementById('sendBtn').onclick = sendTransaction;
    });

    async function onConnected(account) {
      currentAccount = account;
      document.getElementById('wallet-status').style.display = 'none';
      document.getElementById('wallet-info').style.display = 'block';
      document.getElementById('account').textContent = account;
      
      // Get balance
      const balance = await window.nexus.getBalance('default');
      document.getElementById('balance').textContent = balance;
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
