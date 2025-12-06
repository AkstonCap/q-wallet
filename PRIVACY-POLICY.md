# Privacy Policy for Distordia Q-Wallet

**Last Updated:** December 6, 2025

## Introduction

Distordia Q-Wallet ("the Wallet", "we", "our") is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our browser extension wallet for the Nexus blockchain.

## Core Privacy Principles

**We Do Not Collect Personal Data**

Distordia Q-Wallet is a non-custodial wallet that operates entirely on your device. We do not collect, store, or transmit your personal information to any servers controlled by us.

## Information Storage

### What is Stored Locally on Your Device

The following information is stored locally in your browser using Chrome's storage API:

- **Session tokens** - Temporary authentication tokens (automatically cleared when browser closes)
- **Wallet preferences** - UI settings and configuration
- **Node URL** - The Nexus node you're connected to
- **Transaction cache** - Recent transactions for quick display
- **Connected dApp domains** - List of websites you've approved for wallet connection

### What is NEVER Stored

- ❌ Your username
- ❌ Your password
- ❌ Your PIN
- ❌ Your recovery phrase
- ❌ Any personally identifiable information

## Data Transmission

### Nexus Node Communication

The Wallet communicates directly with Nexus blockchain nodes to:
- Create and manage accounts
- Send and receive transactions
- Query balances and transaction history
- Unlock and lock wallet sessions

**Important:** All communication with Nexus nodes goes directly from your device to the node. We do not operate intermediate servers that can see your data.

### Default Node Configuration

The Wallet comes pre-configured with `api.distordia.com` as a default Nexus node option for convenience. When using this or any node:
- Transaction data is sent directly to the node
- Node operators may log API requests for operational purposes
- You can change to any Nexus node at any time in Settings

### HTTPS Enforcement

For remote node connections, the Wallet enforces HTTPS to ensure your data is encrypted in transit. Local connections (localhost/LAN) may use HTTP.

## Third-Party Services

### dApp Connections

When you connect the Wallet to a decentralized application (dApp):
- You explicitly approve each connection
- Connected dApps can request your account addresses and balances
- dApps cannot access your credentials or make transactions without your approval
- You can revoke dApp access at any time in Settings

### No Analytics or Tracking

The Wallet does **not** include:
- ❌ Analytics services (Google Analytics, etc.)
- ❌ Tracking pixels or cookies
- ❌ Error reporting services that transmit data
- ❌ Advertisement networks
- ❌ Any third-party scripts that collect user data

## Transaction Fees

The Wallet charges service fees for transactions and account creation:
- **For NXS sends:** 0.1% of amount (minimum 0.000001 NXS)
- **For token sends:** 0.01 NXS flat fee
- **For account creation:** 0.01 NXS flat fee

These fees are sent to the Distordia development address (`8Csmb3RP227N1NHJDH8QZRjZjobe4udaygp7aNv5VLPWDvLDVD7`) and are visible on the public Nexus blockchain. This is the only way transaction patterns could be associated with the Wallet's usage.

## Blockchain Transparency

### Public Ledger

The Nexus blockchain is a public ledger. Once you make a transaction:
- Transaction details are permanently recorded on the blockchain
- Anyone can view transaction amounts, addresses, and timestamps
- This is inherent to blockchain technology, not a privacy limitation of the Wallet

### Pseudonymity

Your Nexus addresses are pseudonymous:
- Addresses are not directly linked to your personal identity
- However, transaction patterns can potentially be analyzed
- Consider using multiple accounts for enhanced privacy

## Browser Extension Permissions

The Wallet requests the following browser permissions:

- **storage** - To save wallet preferences and session data locally
- **activeTab** - To inject the Nexus provider into dApp websites (only when you explicitly connect)
- **notifications** (optional) - To notify you of transaction confirmations

These permissions are used solely for Wallet functionality and not for tracking or data collection.

## Data Security

### Your Responsibility

Since this is a non-custodial wallet:
- **You** are responsible for securing your username, password, and PIN
- **You** control access to your funds
- **We** cannot recover your credentials if you forget them
- Always keep secure offline backups of your credentials and recovery phrase

### Security Best Practices

1. Use strong, unique passwords (minimum 8 characters)
2. Never share your password or PIN with anyone
3. Only connect to trusted Nexus nodes
4. Only approve dApp connections from websites you trust
5. Keep your credentials and recovery phrase backed up safely offline
6. Lock your wallet when not in use

## International Users

The Wallet operates on your local device and does not transmit data to our servers. When you connect to Nexus nodes, be aware that:
- Node operators may be located in different countries
- Different data protection laws may apply to node operators
- You are responsible for choosing which nodes to trust

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Changes will be reflected in the "Last Updated" date at the top of this document. Continued use of the Wallet after changes constitutes acceptance of the updated policy.

## Open Source

The Wallet is open-source software. You can review the complete source code at:
https://github.com/AkstonCap/q-wallet

This allows independent verification that:
- No data collection code is hidden in the application
- The Wallet functions exactly as described
- Security can be audited by the community

## Your Rights

Since we do not collect or store your personal data:
- There is no personal data to request, modify, or delete from our systems
- All data is stored locally on your device
- You can clear all Wallet data by uninstalling the extension

## Contact Information

For questions about this Privacy Policy or the Wallet:

- **GitHub Repository:** https://github.com/AkstonCap/q-wallet
- **Issues/Support:** Submit an issue on our GitHub repository

## Disclaimer

This Wallet manages cryptocurrency. Use at your own risk. We are not liable for:
- Loss of funds due to forgotten credentials
- Security breaches of connected Nexus nodes
- Blockchain transactions that cannot be reversed
- dApp interactions or third-party services

---

## Summary

**In Plain English:**

✅ Your data stays on your device  
✅ We don't track you  
✅ No servers collect your information  
✅ Your credentials are never stored  
✅ You control your own funds  
✅ Open-source for transparency  

**The Only Data Trail:**

The only way your usage of this Wallet could be identified is through the service fees sent to our blockchain address. These transactions are public on the Nexus blockchain, as are all your other transactions, but this is inherent to blockchain technology.

---

**Built with privacy in mind for the Nexus Blockchain Community**
