# Distordia Q-Wallet

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

For complete dApp integration documentation, see [DAPP-INTEGRATION.md](DAPP-INTEGRATION.md).

## Security Features

### Data Protection
- 🔒 **No Credential Storage** - Your username, password, and PIN are never stored in the extension
- 🔐 **Session-Based Security** - Session tokens auto-clear when you close your browser
- 🔑 **PIN Confirmation** - All transactions require PIN re-entry for approval
- 🌐 **HTTPS Enforcement** - Remote connections must use secure HTTPS protocol

### Best Practices
1. ✅ Use strong, unique passwords (minimum 8 characters)
2. ✅ Never share your password or PIN with anyone
3. ✅ Only connect to trusted Nexus nodes
4. ✅ Review all transactions carefully before confirming
5. ✅ Lock your wallet when not in use
6. ✅ Only approve dApp connections from websites you trust
7. ✅ Keep your credentials backed up safely offline

### What's Stored
- ✅ Session tokens (temporarily, auto-cleared on browser close)
- ✅ Wallet preferences and settings
- ✅ Node URL configuration
- ✅ Transaction cache for quick display

### What's NEVER Stored
- ❌ Your username, password, or PIN
- ❌ Private keys (managed by Nexus node)
- ❌ Any sensitive credentials

## Frequently Asked Questions

### How do I backup my wallet?
Your wallet is created on the Nexus blockchain, not in the browser extension. Make sure to securely store your username, password, and PIN. You can access your wallet from any device with these credentials.

### Can I use multiple accounts?
Yes! The Nexus blockchain supports multiple accounts per profile. Create additional accounts in the wallet settings.

### What if I forget my password or PIN?
Unfortunately, these cannot be recovered. Always keep secure backups of your credentials.

### Is my wallet secure?
Yes! Your credentials are never stored in the extension. Session tokens are temporary and auto-clear when you close your browser. All transactions require PIN confirmation.

### Can I use this with hardware wallets?
Not currently, but this feature is planned for future releases.

### How do I connect to a remote Nexus node?
Go to Settings → Node Settings, and enter your remote node URL. For security, only HTTPS connections are allowed for remote nodes (localhost/LAN can use HTTP).

### What browsers are supported?
Chrome, Brave, Edge, and other Chromium-based browsers are fully supported. Firefox is supported but the extension needs to be loaded as a temporary add-on.

## Troubleshooting

### Extension Won't Load
- Ensure you're using a Chromium-based browser or Firefox
- Check that all files are present
- Look for errors in `chrome://extensions` with Developer mode enabled

### Can't Connect to Node
- Verify your Nexus node is running (try: `curl http://localhost:8080/system/get/info`)
- Check the node URL in settings
- Ensure CORS is enabled on your node (for remote connections)
- Check firewall settings

### Login Fails
- Verify username, password, and PIN are correct
- Ensure your Nexus node is accessible
- Check that the profile exists (create a new wallet if needed)

### Transactions Not Showing
- Wait for blockchain confirmation (usually a few seconds)
- Refresh wallet data by locking and unlocking
- Check node connection in settings
- Verify transaction on the blockchain

### Icons Not Showing
The extension works perfectly without icons. If you want custom icons, open `generate-icons.html` in your browser and save the generated images to the `icons/` folder.

## Future Plans

Planned features for future releases:
- Multi-account UI improvements
- Token management for custom tokens
- Hardware wallet integration
- Address book
- Transaction export
- Multi-language support
- Dark mode theme
- NFT support
- Staking interface
- DeFi integrations

## License

MIT License - Use freely, modify, and distribute as needed.

## Important Disclaimer

This wallet manages cryptocurrency. Use at your own risk. Always:
- ✅ Keep secure backups of your credentials
- ✅ Use strong, unique passwords
- ✅ Verify all transactions before confirming
- ✅ Only install from trusted sources
- ✅ Never share your password or PIN

---

**Built with ❤️ for the Nexus Blockchain Community**

