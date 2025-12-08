# Distordia Q-Wallet Mobile

A secure cryptocurrency mobile wallet for the Nexus blockchain. Built with React Native and Expo for iOS and Android.

![Nexus Wallet](icons/icon128.png)

## Features

### Core Wallet Functionality
- 🔐 **Secure Account Management** - Create and manage Nexus accounts with encrypted storage
- 💰 **Send & Receive NXS** - Easy-to-use interface for sending and receiving NXS tokens
- 📊 **Transaction History** - View all your past transactions
- 🔄 **Pull to Refresh** - Update your balance and transactions with a simple swipe
- ⚙️ **Configurable Node** - Connect to any Nexus node (local or remote)
- 🔒 **Session Management** - Secure login/logout with PIN protection
- 📱 **Native Mobile UI** - Optimized for iOS and Android devices

### Security Features
- 🔑 **Password Protected** - Strong password encryption
- 🔢 **PIN Authentication** - Additional PIN layer for transaction approval
- 🔐 **Secure Storage** - React Native SecureStore for sensitive data
- 🚪 **Lock/Unlock** - Lock your wallet when not in use
- 👁️ **Session Management** - Automatic session handling

## Installation

### For Users

#### iOS
1. Download from the App Store (coming soon)
2. Or build from source (see Developer section below)

#### Android
1. Download from Google Play (coming soon)
2. Or build from source (see Developer section below)

### For Developers

#### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- For iOS: Mac with Xcode
- For Android: Android Studio

#### Setup

```bash
# Clone the repository
git clone https://github.com/AkstonCap/q-wallet.git
cd q-mobile

# Install dependencies
npm install

# Start development server
npm start

# Run on iOS (requires Mac)
npm run ios

# Run on Android
npm run android
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
- Use a public Nexus node or hosted service like api.distordia.com
- Configure the node URL in wallet settings (api.distordia.com is the default)

### 2. Login to Your Wallet

The mobile app requires an existing Nexus SigChain account. To create one:

1. Download the official Nexus Desktop Wallet from https://nexus.io/wallet
2. Create a new SigChain account with username, password, and PIN
3. Open the mobile app and login with your credentials

### 3. Using the Wallet

#### Receive NXS
1. Tap the "Receive" button
2. Share your address or show the QR code
3. Give this address to whoever is sending you NXS

#### Send NXS
1. Tap the "Send" button
2. Enter recipient address
3. Enter amount to send
4. Add optional reference/note
5. Confirm with your PIN
6. Transaction sent!

#### View Transactions
- All transactions are shown on the main wallet screen
- Pull down to refresh your balance and transactions
- Tap on any transaction to view details

## Project Structure

```
q-mobile/
├── App.js                    # Main app with navigation
├── package.json              # Dependencies
├── app.json                  # Expo configuration
├── src/
│   ├── screens/             # React Native screens
│   │   ├── LoginScreen.js
│   │   ├── WalletScreen.js
│   │   ├── SendScreen.js
│   │   ├── ReceiveScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── CreateAccountScreen.js
│   │   └── TransactionApprovalScreen.js
│   ├── services/            # Business logic
│   │   ├── nexus-api.js    # Nexus blockchain API
│   │   ├── storage.js      # Secure storage service
│   │   └── wallet.js       # Wallet service
│   └── styles/
│       └── common.js        # Shared styles
├── assets/                  # App icons and images
└── icons/                   # Legacy icons

```

## Technology Stack

- **React Native** - Cross-platform mobile framework
- **Expo** - Development toolchain and services
- **React Navigation** - Screen navigation
- **AsyncStorage** - Persistent data storage
- **SecureStore** - Encrypted storage for sensitive data
- **QR Code Generator** - For address sharing

## Security

- **Encrypted Storage**: All sensitive data (session tokens, PINs) are stored using Expo SecureStore
- **HTTPS Enforcement**: Remote node connections require HTTPS
- **PIN Protection**: All transactions require PIN confirmation
- **No Private Keys Stored**: The app uses Nexus's SigChain system - no private keys are stored on device
- **Session Management**: Automatic session timeout and secure logout

## API Documentation

For detailed information about the Nexus API, see the [Nexus API documentation](Nexus%20api%20docs/API/README.MD).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

See [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/AkstonCap/q-wallet/issues
- Nexus Community: https://nexus.io/community

## Roadmap

- [ ] Biometric authentication (Face ID / Touch ID)
- [ ] Multi-account support with easy switching
- [ ] Token management and custom tokens
- [ ] Transaction notifications
- [ ] Address book for frequent recipients
- [ ] Fiat currency conversion display
- [ ] Dark/Light theme toggle
- [ ] Export transaction history
- [ ] Multi-language support

---

**Note**: This is a mobile wallet application. For browser extension version, see the `browser-extension` branch.

1. Click the "Send" button
2. Enter recipient address or username
3. Enter amount to send
4. Add optional reference/memo
5. Review transaction summary including fees
6. Confirm transaction with PIN

**Transaction Fees:**
- **Nexus Network Fee:** 0.01 NXS (automatically deducted for multiple transactions within 10 seconds)
- **Distordia Service Fee:** 
  - For NXS: 0.1% of send amount (minimum 0.000001 NXS)
  - For other tokens: 0.01 NXS flat fee
- All fees are deducted from your default NXS account

**Example:** Sending 1 NXS
- Amount sent: 1 NXS
- Distordia service fee: 0.001 NXS (0.1%)
- Nexus network fee: 0.01 NXS (auto-deducted)
- Total cost: 1.011 NXS

#### Create Accounts
1. Go to "Receive" screen
2. Click "Create New Account"
3. Enter optional account name
4. Select token (NXS or custom token name/address)
5. Enter PIN to confirm

**Account Creation Fees:**
- **Nexus Network Fee:** 0.01 NXS (automatically deducted)
- **Distordia Service Fee:** 0.01 NXS
- Total: 0.02 NXS (deducted from default account)

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
- 💰 **Transparent Fees** - All transaction and service fees are clearly displayed before confirmation

### Fee Structure
The wallet implements a two-tier fee system to ensure sustainability and network security:

**Nexus Network Fee (Automatic):**
- 0.01 NXS per additional transaction within 10 seconds
- Automatically deducted by the Nexus blockchain
- Not charged by the wallet, but included in fee estimates

**Distordia Service Fee:**
- **For NXS sends:** 0.1% of amount (minimum 0.000001 NXS)
  - Example: 1 NXS = 0.001 NXS fee
  - Example: 100 NXS = 0.1 NXS fee
  - Example: 0.001 NXS = 0.000001 NXS fee (minimum)
- **For token sends:** 0.01 NXS flat fee
- **For account creation:** 0.01 NXS flat fee

All fees are clearly displayed in the transaction summary before you confirm. Service fees are sent to the Distordia development address to support ongoing wallet development and maintenance.

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
- ❌ Any sensitive credentials

## Frequently Asked Questions

### How do I backup my wallet?
Your wallet is created on the Nexus blockchain, not in the browser extension. Make sure to securely store your username, password, and PIN. You can access your wallet from any device with these credentials.

### Can I use multiple accounts?
Yes! The Nexus blockchain supports multiple accounts per profile. Create additional accounts in the wallet settings.

### What if I forget my password or PIN?
If you forget your username, password or PIN, you can recover access to your wallet using the private seed phrase, these must be created in the Nexus desktop wallet (Nexus Interface) or CLI. Always keep secure backups of your credentials and seed phrase.

### Is my wallet secure?
Yes! Your credentials are never stored in the extension. Session tokens are temporary and auto-clear when you close your browser. All transactions require PIN confirmation.

### Can I use this with hardware wallets?
Not currently.

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

