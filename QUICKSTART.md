# Nexus Mobile Wallet - Quick Start Guide

## 🚀 Quick Installation (5 minutes)

### Step 1: Install Dependencies

```bash
# Clone the repository
git clone https://github.com/AkstonCap/q-wallet.git
cd q-mobile

# Install dependencies
npm install
```

### Step 2: Set Up Nexus Node

**Option A - Use Remote Node (Recommended for Testing):**
- The app defaults to `https://api.distordia.com`
- No local setup needed!

**Option B - Local Node (For Development):**
```bash
# Run Nexus core without authentication (testing only)
./nexus -noapiauth
```

### Step 3: Create Your Nexus Account

Before using the mobile app, you need a Nexus SigChain account:

1. Download Nexus Desktop Wallet from https://nexus.io/wallet
2. Create account with:
   - Username: `testuser` (or your choice)
   - Password: `password123` (min 8 chars)
   - PIN: `1234` (4-8 digits)
3. Wait for account creation

### Step 4: Run the Mobile App

```bash
# Start development server
npm start

# Then press:
# - 'i' for iOS simulator (Mac only)
# - 'a' for Android emulator
# - Scan QR code with Expo Go app for physical device
```

### Step 5: Login to Your Wallet

1. Open the app
2. Select API service (use api.distordia.com)
3. Enter your credentials:
   - Username: `testuser`
   - Password: `password123`
   - PIN: `1234`
4. Tap "Unlock Wallet"
5. You're in! 🎉

### Step 6: Test the Wallet

**Get Your Address:**
1. Tap the address in the header to copy it
2. You'll see "Address copied!" notification
3. Your address is now in clipboard

**Configure Node (if needed):**
1. Click the ⚙️ settings icon
2. Enter your node URL (default: `http://localhost:8080`)
3. Click "Save Node"

### Step 5: Test with dApp (Optional)

1. Open `example-dapp.html` in your browser
2. Click "Connect Wallet"
3. Try the different features:
   - Get Balance
   - Send Transaction
   - View History

## 🔧 Troubleshooting

### "Login failed" or "Failed to create wallet"

**Check your Nexus node is running:**
```bash
# Test node connection
curl http://localhost:8080/system/get/info

# Should return JSON with node info
```

**If node isn't running:**
```bash
# Start Nexus core
./nexus -noapiauth
```

### Icons Not Showing

The extension works fine without icons, but to add them:
1. Open `generate-icons.html` in your browser
2. Right-click each canvas and save as PNG
3. Save in `icons/` folder with correct names

### Extension Won't Load

- Make sure you selected the entire `qwallet` folder
- Check for errors in the extension details page
- Ensure all files are present (especially `manifest.json`)

### CORS Errors

If connecting to remote node, ensure it has CORS enabled:
```bash
# Run Nexus with CORS (not for production)
./nexus -noapiauth -apiallowremote=1
```

## 📝 Next Steps

### For Users:
- ✅ Receive some NXS to your wallet
- ✅ Try sending a transaction
- ✅ Explore transaction history
- ✅ Connect to dApps

### For Developers:
- 📖 Read the [full README](README.md)
- 🔍 Check the [API documentation](Nexus%20api%20docs/)
- 💻 Try the [example dApp](example-dapp.html)
- 🛠️ Explore the [source code](services/)

## 🎯 Common Use Cases

### Send NXS to Another User
```
1. Click "Send"
2. Enter: recipient username or address
3. Enter: amount (e.g., 10.5)
4. (Optional) Add reference note
5. Click "Send Transaction"
6. Done!
```

### Receive NXS
```
1. Click "Receive"
2. Copy your address
3. Share with sender
4. Wait for transaction
5. Check "Transactions" tab
```

### Connect to dApp
```
1. Visit a Nexus dApp website
2. Click their "Connect Wallet" button
3. Approve in wallet popup (coming in future update)
4. Use the dApp features!
```

## 🔐 Security Tips

1. ✅ Use a strong, unique password
2. ✅ Never share your password or PIN
3. ✅ Lock wallet when not in use
4. ✅ Only install from trusted sources
5. ✅ Verify transactions before confirming
6. ✅ Keep backups of credentials

## ❓ Need Help?

- 📚 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/yourusername/qwallet/issues)
- 💬 Join Nexus Community Forums
- 📖 [Nexus API Docs](https://nexus.io/docs)

## 🎊 You're Ready!

Your Nexus Wallet is now set up and ready to use. Start exploring the Nexus blockchain!

---

**Happy Nexusing! 🚀**
