# Distordia Q-Wallet

A secure cryptocurrency wallet browser extension for the Nexus blockchain, similar to MetaMask but specifically designed for Nexus.io.

![Nexus Wallet](icons/icon128.png)

> **🔥 Why Q-Wallet?** See our [comparison with MetaMask, Trust Wallet, and other competitors](Q-WALLET-VS-COMPETITION.md) to understand why Q-Wallet offers quantum-resistant security that traditional wallets cannot match.

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
- 🔐 **Memory-Only Session Storage** - Session ID and PIN stored in chrome.storage.session (RAM only), NEVER written to disk
- 🔒 **Encrypted Fallback** - If browser doesn't support session storage, uses memory-only encryption key (lost on reload)
- �️ **Content Security Policy** - Strict CSP prevents code injection and XSS attacks
- 🚫 **XSS Prevention** - All user inputs sanitized, no innerHTML with dynamic content
- ⏱️ **Rate Limiting** - Protection against brute force attacks (2-second delay after failed login)
- 🔐 **HTTPS Enforcement** - Remote nodes require HTTPS connections
- 🚪 **Lock/Unlock** - Lock your wallet when not in use
- 👁️ **Automatic Session Cleanup** - Sessions automatically terminated on logout or browser close
- 🛡️ **Defense in Depth** - Multiple layers of security protection
- 🔒 **Blockchain Session Termination** - Active sessions properly terminated on Nexus node on logout/browser close

### Quantum Resistance
- 🛡️ **Quantum-Resistant SigChains** - Protected by Nexus blockchain's signature chain technology
- 🔐 **One-Time Keypairs** - Each transaction uses a unique keypair, never reused
- 🚫 **No Public Key Reuse** - Eliminates vulnerability to quantum attacks via Shor's algorithm
- ⚛️ **Post-Quantum Ready** - Future-proof security architecture resistant to quantum computing threats
- 🔑 **Hardware-Like Security** - SigChain architecture provides security similar to hardware wallets

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
git clone https://github.com/AkstonCap/q-wallet.git
cd q-wallet

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
- Use a public Nexus node or hosted service like api.distordia.com
- Configure the node URL in wallet settings (api.distordia.com available as default)

### 2. Create Your Wallet

1. Click the Nexus Wallet extension icon
2. Click "Create New Wallet"
3. Enter your details:
   - **Username**: Your unique identifier
   - **Password**: Strong password (min 8 characters)
   - **PIN**: 4-8 digit PIN for transaction approval
4. Confirm and create

**⚠️ Important:** Store your username, password and PIN safely! If you forget them, you can only recover your wallet using your private seed phrase (never share this with anyone).

### 3. Using the Wallet

#### Receive NXS
1. Click the "Receive" button
2. Copy your address or share the QR code
3. Give this address to whoever is sending you NXS

#### Send NXS
1. Click the "Send" button
#### Send NXS
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

### Data Protection & Storage

#### Session Storage (chrome.storage.session)
#### Session Storage (chrome.storage.session)
The wallet uses Chrome's **session storage API** for sensitive data like session IDs and PINs. This provides:

- ✅ **Memory-Only Storage** - Data stored in RAM only, NEVER written to disk
- ✅ **Automatic Cleanup** - All session data cleared when browser closes
- ✅ **Isolation** - Not accessible to web pages or other extensions
- ✅ **Browser Security** - Protected by browser's security sandbox

**Fallback Mode (if chrome.storage.session unavailable):**
- Uses encryption with memory-only key (generated per session)
- Encryption key stored in JavaScript memory, lost on extension reload
- Encrypted data unrecoverable without the key
- Still cleared on browser close

**What's stored in session:**
- Session ID (UUID from Nexus blockchain)
- PIN (for transaction approval and logout)
- Username and genesis hash (non-sensitive identifiers)

**When data is cleared:**
- User logs out (explicit action)
- Browser window closes (automatic)
- Extension is reloaded/updated
- Fallback mode: Key lost = data unrecoverable

#### Blockchain Session Management
- 🔐 **Active Session Termination** - Wallet attempts to terminate sessions on the Nexus blockchain when you logout or close the browser
- 🔑 **PIN Authentication** - Required for terminating sessions on multi-user nodes
- 🛡️ **Security-First Cleanup** - **Local session data (session ID, PIN) is ALWAYS cleared from storage, even if blockchain termination fails**
- ⚠️ **Offline Node Handling** - If the node is offline, local data is still cleared immediately (blockchain session will expire naturally)
- 🏛️ **Public Computer Safety** - Closing browser always clears all sensitive data from local storage, regardless of network status

#### Password & Credentials
- 🔒 **No Credential Storage** - Your username, password, and PIN are never stored persistently
- 🔐 **Session-Based Security** - Only session tokens are kept (in memory)
- 🔑 **PIN Confirmation** - All transactions require PIN re-entry for approval
- 🌐 **HTTPS Enforcement** - Remote connections must use secure HTTPS protocol

### Alternative Storage Methods

**Why chrome.storage.session?**
- ✅ Stored in RAM only, not written to disk
- ✅ Automatically cleared on browser close
- ✅ Native browser security sandbox
- ✅ No need to manage encryption keys

**Why the encrypted fallback?**
- Some browsers may not support chrome.storage.session fully
- Encryption key lives in memory only (lost on reload)
- Better than plaintext on disk
- Data becomes unrecoverable when key is lost

**Why not always encrypt in local storage?**
- Encryption key must be stored somewhere
- If key on disk → not secure
- If key in code → visible to anyone
- If key from password → defeats the purpose
- Session storage is simpler and more secure

**Hardware wallet integration?**
- Not currently supported (browser extension limitation)
- Consider this for future mobile/desktop versions
- Current approach matches industry standard (MetaMask, etc.)

### Best Practices

**For Regular Use:**
- ✅ Always logout when finished (don't just close window)
- ✅ Use strong, unique password and PIN
- ✅ Only connect to trusted dApps
- ✅ Verify transaction details before approving

**For Public Computers:**
- ⚠️ **Use with caution** - Browser wallets on shared computers have inherent risks
- ✅ Always **explicitly logout** before leaving (don't rely on browser close alone)
- ✅ Verify logout was successful before walking away
- ✅ **Clear browser data** after logout for extra security (Ctrl+Shift+Delete)
- 🔒 **Local data is always cleared** - Even if node is offline, session/PIN are removed from computer
- ⏳ **Blockchain session timeout** - If logout fails due to offline node, session will expire naturally (typically 24 hours)

**For Public/Shared Computers:**
- ⚠️ Use the Logout button before walking away
- ⚠️ Don't rely on browser close alone
- ⚠️ Clear browser data after use
- ⚠️ Consider not using wallet on public computers at all
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

## Security

### Security Architecture

For a comprehensive overview of the security measures, see [SECURITY.md](SECURITY.md).

**Key Security Features:**
- ✅ **Content Security Policy (CSP)** - Blocks all inline scripts and code injection attacks
- ✅ **XSS Prevention** - All dynamic content safely rendered using textContent
- ✅ **Rate Limiting** - 2-second delay after failed login attempts to prevent brute force
- ✅ **HTTPS Enforcement** - Remote API connections require secure protocol
- ✅ **Memory-Only Storage** - Session data stored in RAM, never written to disk
- ✅ **No eval()** - Zero use of dangerous eval() or Function() constructors
- ✅ **Input Validation** - All user inputs validated before processing
- ✅ **Secure Session Management** - Proper termination on logout/browser close

**Security Grade: A- (Production Ready)**

The wallet implements defense-in-depth security with multiple protection layers:
1. Storage security (chrome.storage.session)
2. Code security (CSP + no unsafe patterns)
3. Network security (HTTPS enforcement)
4. Authentication security (PIN + rate limiting)
5. Input/output sanitization

**Audited Files:**
- `manifest.json` - CSP configuration
- `services/storage.js` - Secure storage implementation
- `services/wallet.js` - Session management
- `popup.js` - UI security (XSS prevention, rate limiting)
- `background.js` - Service worker security
- `services/nexus-api.js` - API communication

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

