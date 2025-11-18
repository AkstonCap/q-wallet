# Nexus Wallet Browser Extension

A secure cryptocurrency wallet browser extension for the Nexus blockchain, similar to MetaMask but specifically designed for Nexus.io.

![Nexus Wallet](icons/icon128.png)

## Features

### Core Wallet Functionality
- 🔐 **Secure Account Management** - Create and manage Nexus accounts with encrypted storage
- 💰 **Send & Receive NXS** - Easy-to-use interface for sending and receiving NXS tokens
- 📊 **Transaction History** - View all your past transactions
- 🔄 **Real-time Balance Updates** - Automatic balance refresh every 5 minutes
- ⚙️ **Configurable Node** - Connect to any Nexus node (local or remote)
- 🔒 **Session Management** - Secure login/logout with PIN protection

### dApp Integration
- 🌐 **Web3 Provider** - Inject `window.nexus` object for dApp connectivity
- 🤝 **dApp Connections** - Connect your wallet to Nexus-based decentralized applications
- ✍️ **Transaction Signing** - Sign and approve transactions from dApps
- 📡 **Message Passing** - Secure communication between dApps and wallet

### Security Features
- 🔑 **Password Protected** - Strong password encryption
- 🔢 **PIN Authentication** - Additional PIN layer for transaction approval
- 🔐 **Secure Storage** - Chrome's secure storage API for sensitive data
- 🚪 **Lock/Unlock** - Lock your wallet when not in use
- 👁️ **Session Timeout** - Automatic session management

## Installation

### For Users

1. **Download the Extension**
   - Clone or download this repository
   - Or download the latest release from the releases page

2. **Install in Chrome/Brave/Edge**
   - Open your browser and navigate to `chrome://extensions/` (or `brave://extensions/`, `edge://extensions/`)
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `qwallet` folder

3. **Install in Firefox**
   - Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the `qwallet` folder

### For Developers

```bash
# Clone the repository
git clone https://github.com/yourusername/qwallet.git
cd qwallet

# No build process required - it's vanilla JavaScript!
# Just load the extension in your browser as described above
```

## Getting Started

### 1. Set Up Your Nexus Node

Before using the wallet, you need a Nexus node running. You can:

**Option A: Run a Local Node**
```bash
# Download and run the Nexus core
./nexus -apiuser=youruser -apipassword=yourpassword

# Or run without authentication (for local testing only)
./nexus -noapiauth
```

**Option B: Connect to a Remote Node**
- Use a public Nexus node or hosted service
- Configure the node URL in wallet settings

### 2. Create Your Wallet

1. Click the Nexus Wallet extension icon
2. Click "Create New Wallet"
3. Enter your details:
   - **Username**: Your unique identifier
   - **Password**: Strong password (min 8 characters)
   - **PIN**: 4-8 digit PIN for transaction approval
4. Confirm and create

**⚠️ Important:** Your password and PIN cannot be recovered. Store them safely!

### 3. Using the Wallet

#### Receive NXS
1. Click the "Receive" button
2. Copy your address or share the QR code
3. Give this address to whoever is sending you NXS

#### Send NXS
1. Click the "Send" button
2. Enter recipient address or username
3. Enter amount to send
4. Add optional reference/memo
5. Review and confirm transaction

#### View Transactions
- Check the "Transactions" tab to see your history
- Click any transaction for details

## Configuration

### Node Settings

Configure your Nexus node connection:

1. Click the ⚙️ settings icon
2. Enter your node URL (default: `http://localhost:8080`)
3. Click "Save Node"

Common node configurations:
- Local node: `http://localhost:8080`
- Remote node: `https://your-node-url:8080`

## dApp Integration

Developers can integrate Nexus Wallet into their dApps using the injected provider.

### Basic Usage

```javascript
// Check if Nexus Wallet is available
if (typeof window.nexus !== 'undefined') {
  console.log('Nexus Wallet is installed!');
  
  // Connect to wallet
  const accounts = await window.nexus.connect();
  console.log('Connected account:', accounts[0]);
  
  // Get balance
  const balance = await window.nexus.getBalance();
  console.log('Balance:', balance);
  
  // Send transaction
  const tx = await window.nexus.sendTransaction({
    to: 'recipient-address',
    amount: 10.5,
    reference: 'Payment for services'
  });
  console.log('Transaction:', tx);
}
```

### Available Methods

- `nexus.connect()` - Request connection to wallet
- `nexus.getAccounts()` - Get connected accounts
- `nexus.getBalance(account)` - Get account balance
- `nexus.sendTransaction(params)` - Send a transaction
- `nexus.signTransaction(tx)` - Sign a transaction
- `nexus.getTransactionHistory(limit)` - Get transaction history
- `nexus.isWalletConnected()` - Check connection status

### Events

```javascript
// Listen for account changes
window.nexus.on('accountsChanged', (accounts) => {
  console.log('Account changed:', accounts[0]);
});

// Listen for connection
window.nexus.on('connect', (info) => {
  console.log('Wallet connected:', info);
});
```

## Architecture

```
qwallet/
├── manifest.json           # Extension manifest (v3)
├── popup.html             # Main wallet UI
├── popup.js               # UI controller
├── background.js          # Background service worker
├── content.js             # Content script (message relay)
├── inpage.js              # Injected provider (window.nexus)
├── styles/
│   └── popup.css          # Wallet styling
├── services/
│   ├── nexus-api.js       # Nexus blockchain API client
│   ├── storage.js         # Chrome storage wrapper
│   └── wallet.js          # Wallet business logic
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## API Reference

### Nexus API Endpoints Used

The wallet interacts with the following Nexus API endpoints:

**Sessions**
- `sessions/create/local` - Create login session
- `sessions/terminate/local` - Logout
- `sessions/unlock/local` - Unlock with PIN
- `sessions/lock/local` - Lock session

**Profiles**
- `profiles/create/master` - Create new profile
- `profiles/get/master` - Get profile info

**Finance**
- `finance/get/account` - Get account details
- `finance/list/accounts` - List all accounts
- `finance/get/balances` - Get all balances
- `finance/create/account` - Create new account
- `finance/debit/account` - Send transaction
- `finance/transactions/account` - Get transaction history

**Ledger**
- `ledger/get/transaction` - Get transaction details
- `ledger/get/info` - Get blockchain info

## Security Considerations

### What's Stored
- Session tokens (encrypted by Chrome)
- Wallet configuration
- Transaction cache
- Node URL preference

### What's NOT Stored
- Private keys (managed by Nexus node)
- Plain-text passwords
- Plain-text PINs

### Best Practices
1. Use strong, unique passwords
2. Never share your password or PIN
3. Only connect to trusted nodes
4. Review all transactions before confirming
5. Lock your wallet when not in use
6. Only approve dApp connections you trust

## Development

### Project Structure

- **Manifest v3**: Uses the latest Chrome extension API
- **Vanilla JavaScript**: No build tools or frameworks required
- **Service Worker**: Background processing with `background.js`
- **Content Scripts**: Secure message passing between page and extension
- **Storage API**: Chrome's secure local storage

### Adding Features

1. **New API Endpoint**: Add method to `services/nexus-api.js`
2. **New Wallet Feature**: Add to `services/wallet.js`
3. **UI Component**: Update `popup.html` and `popup.js`
4. **dApp Method**: Add to `inpage.js` provider

### Testing

```bash
# Test with local Nexus node
./nexus -noapiauth

# Create test account
./nexus profiles/create/master username=test password=test123 pin=1234

# Check account
./nexus finance/get/balances session=<session-id>
```

## Troubleshooting

### Extension Won't Load
- Ensure you're using a Chromium-based browser or Firefox
- Check that all files are present
- Look for errors in `chrome://extensions` with Developer mode enabled

### Can't Connect to Node
- Verify your Nexus node is running
- Check the node URL in settings
- Ensure CORS is enabled on your node (for remote connections)
- Check firewall settings

### Login Fails
- Verify username, password, and PIN are correct
- Ensure your Nexus node is accessible
- Check that the profile exists (create if needed)

### Transactions Not Showing
- Wait for blockchain confirmation
- Refresh wallet (lock/unlock)
- Check node connection
- Verify transaction on blockchain explorer

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Roadmap

- [ ] Multi-account support
- [ ] Token management (custom tokens)
- [ ] Hardware wallet integration
- [ ] Address book
- [ ] Transaction notes
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Mobile version
- [ ] NFT support
- [ ] Staking interface
- [ ] DeFi integrations

## License

MIT License - see LICENSE file for details

## Support

- **Documentation**: [Nexus API Docs](./Nexus%20api%20docs/)
- **Issues**: Report bugs or request features via GitHub Issues
- **Community**: Join the Nexus community forums

## Credits

Built for the Nexus.io blockchain ecosystem.

## Disclaimer

This is wallet software that manages cryptocurrency. Use at your own risk. Always:
- Keep backups of your credentials
- Use strong passwords
- Verify all transactions
- Only install from trusted sources
- Keep your software updated

---

**Made with ❤️ for the Nexus Community**
