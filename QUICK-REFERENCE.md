# Q-Wallet Mobile - Quick Reference

## 🚀 Getting Started in 3 Steps

### 1. Install
```bash
npm install
```

### 2. Setup Icons (Quick)
```powershell
# Windows PowerShell
Copy-Item icons\icon128.png assets\icon.png
Copy-Item icons\icon128.png assets\splash.png
Copy-Item icons\icon128.png assets\adaptive-icon.png
```

### 3. Run
```bash
npm start
```
Then scan QR code with Expo Go app or press `i` for iOS, `a` for Android.

---

## 📱 What You Get

✅ **Native Mobile Wallet** for iOS & Android  
✅ **Send & Receive NXS** with PIN protection  
✅ **Transaction History** with pull-to-refresh  
✅ **QR Code** for receiving  
✅ **Secure Storage** with encryption  
✅ **Multi-Account** support  

❌ **No dApp Integration** (wallet only, no browser)

---

## 📁 Key Files

```
App.js                  → Main app
src/screens/           → All UI screens
src/services/          → Wallet logic & API
package.json           → Dependencies
app.json              → App config
```

---

## 🔧 Development

```bash
npm start              # Start dev server
npm run ios            # Run iOS (Mac only)
npm run android        # Run Android
npm start -- --clear   # Clear cache
```

---

## 📖 Documentation

- `README.md` - Full documentation
- `MOBILE-SETUP.md` - Detailed setup guide
- `DEVELOPER.md` - Development guide
- `CONVERSION-SUMMARY.md` - What changed from browser extension

---

## 🆘 Troubleshooting

**Can't connect to API?**
→ Default: https://api.distordia.com  
→ Change in Settings screen  

**Missing icons error?**
→ Run step 2 above (copy icons)

**Module not found?**
→ `rm -rf node_modules && npm install`

**Need Nexus account?**
→ Create with Nexus Desktop Wallet: https://nexus.io/wallet

---

## ✨ What Changed from Browser Extension?

**Added:**
- React Native mobile UI
- Native navigation
- Expo framework
- AsyncStorage + SecureStore

**Removed:**
- Browser extension (manifest.json, background.js, etc.)
- dApp injection
- Web page integration

**Kept:**
- All wallet features
- Nexus API integration
- Security & PIN protection

---

## 🎯 Ready to Build?

1. ✅ Run `npm install`
2. ✅ Copy icons (step 2)
3. ✅ Run `npm start`
4. ✅ Scan QR or run on simulator
5. ✅ Login with Nexus credentials
6. 🎉 Start using!

**Need help?** See `MOBILE-SETUP.md` or open GitHub issue.
