# Mobile Wallet - Setup Instructions

## Quick Start

This Q-Wallet has been converted from a browser extension to a React Native mobile application.

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Icons (Temporary)

For development, copy existing icons as placeholders:

```bash
# On Windows PowerShell
Copy-Item icons\icon128.png assets\icon.png
Copy-Item icons\icon128.png assets\splash.png
Copy-Item icons\icon128.png assets\adaptive-icon.png

# On Mac/Linux
cp icons/icon128.png assets/icon.png
cp icons/icon128.png assets/splash.png
cp icons/icon128.png assets/adaptive-icon.png
```

Note: For production, create proper sized icons (see `assets/README.md`)

### 3. Start Development Server

```bash
npm start
```

This will open Expo DevTools in your browser.

### 4. Run on Device

**Option A - Physical Device:**
1. Install Expo Go from App Store (iOS) or Play Store (Android)
2. Scan the QR code shown in the terminal
3. App will load on your device

**Option B - iOS Simulator (Mac only):**
```bash
npm run ios
```

**Option C - Android Emulator:**
```bash
npm run android
```

## What Changed

### From Browser Extension to Mobile App

**Removed:**
- `manifest.json` - Browser extension manifest
- `background.js` - Service worker for browser
- `content.js` - Content script injection
- `inpage.js` - In-page script for dApps
- `popup.html/js` - Extension popup
- All browser-specific HTML files
- Chrome extension APIs

**Added:**
- `App.js` - React Native main app with navigation
- `package.json` - React Native/Expo dependencies
- `app.json` - Expo configuration
- `babel.config.js` - Babel configuration
- `src/screens/` - React Native screen components
- `src/services/` - Mobile-compatible services
- `src/styles/` - React Native styles

**Modified:**
- Services now use AsyncStorage + SecureStore (instead of chrome.storage)
- All UI converted from HTML/CSS to React Native components
- Navigation uses React Navigation (instead of browser pages)
- No dApp integration (mobile-only wallet)

## Architecture

```
Mobile App Structure:
├── App.js                     # Main app with React Navigation
├── src/
│   ├── screens/              # All screen components
│   │   ├── LoginScreen.js
│   │   ├── WalletScreen.js
│   │   ├── SendScreen.js
│   │   ├── ReceiveScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── CreateAccountScreen.js
│   │   └── TransactionApprovalScreen.js
│   ├── services/             # Business logic (mobile-compatible)
│   │   ├── nexus-api.js     # Nexus API client
│   │   ├── storage.js       # AsyncStorage + SecureStore
│   │   └── wallet.js        # Wallet service
│   └── styles/
│       └── common.js         # Shared styles & theme
├── assets/                   # App icons & images
└── icons/                    # Legacy icons (can use for assets)
```

## Key Features

✅ **Implemented:**
- User login with Nexus SigChain
- View balance and transactions
- Send NXS with PIN confirmation
- Receive NXS (address + QR code)
- Create new accounts
- Change node settings
- Secure session management
- Pull-to-refresh

❌ **Not Included (from browser extension):**
- dApp integration (no browser injection)
- Browser popup UI
- Content script communication
- Extension-to-dApp messaging

## Testing

### Prerequisites for Testing
1. You need an existing Nexus SigChain account
2. Create one using Nexus Desktop Wallet: https://nexus.io/wallet
3. Use credentials: username, password, PIN

### Test Flow
1. Launch app (npm start → scan QR or npm run ios/android)
2. Login with your Nexus credentials
3. View balance and transactions
4. Test sending NXS to another address
5. Test receiving (view QR code)
6. Test settings (change node URL)
7. Test logout

## Production Build

### iOS
```bash
# Using Expo Build Service
eas build --platform ios

# Or
expo build:ios
```

### Android
```bash
# Using Expo Build Service
eas build --platform android

# Or
expo build:android
```

## Troubleshooting

**"Module not found" errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npm start -- --clear
```

**Icons missing:**
```bash
# Copy icons as shown in step 2 above
# Or create proper sized icons in assets/ folder
```

**Cannot connect to API:**
- Default is https://api.distordia.com
- Change in Settings screen
- For local testing, use http://localhost:8080 (node must be running)

**App crashes:**
- Check terminal logs for errors
- Verify all dependencies installed
- Try clearing Expo cache: `expo start -c`

## Documentation

- `README.md` - Main project documentation
- `QUICKSTART.md` - Quick start guide for users
- `DEVELOPER.md` - Developer guide and contribution info
- `DAPP-INTEGRATION.md` - Notes about dApp support (N/A for mobile)
- See `Nexus api docs/` for API documentation

## Support

- GitHub Issues: https://github.com/AkstonCap/q-wallet/issues
- Nexus Community: https://nexus.io/community

---

**Ready to start?** Run `npm install` then `npm start`!
