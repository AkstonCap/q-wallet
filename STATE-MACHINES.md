# Q-Wallet State Machine Diagrams

This document describes the various state machines in Q-Wallet's architecture.

## 1. Wallet Session State Machine

The wallet has three primary states related to user authentication and session management:

```mermaid
stateDiagram-v2
    [*] --> LoggedOut
    
    LoggedOut --> LoggingIn: login(username, password, pin)
    LoggingIn --> Locked: Session created
    LoggingIn --> LoggedOut: Login failed
    
    Locked --> Unlocking: unlock(pin)
    Unlocking --> Unlocked: PIN valid
    Unlocking --> Locked: PIN invalid
    
    Unlocked --> Locking: lock(pin)
    Locking --> Locked: Lock successful
    Locking --> Unlocked: Lock failed
    
    Locked --> LoggingOut: logout(pin)
    Unlocked --> LoggingOut: logout(pin)
    LoggingOut --> LoggedOut: Session terminated
    
    LoggedOut --> Creating: createWallet(username, password, pin)
    Creating --> Locked: Profile created + Session started
    Creating --> LoggedOut: Creation failed
    
    note right of LoggedOut
        - No session exists
        - No user data in storage
        - Login screen visible
    end note
    
    note right of Locked
        - Session exists
        - Wallet data visible (read-only)
        - Transactions disabled
        - dApp interactions require unlock
    end note
    
    note right of Unlocked
        - Session exists and unlocked
        - Full transaction capabilities
        - dApp interactions enabled
        - Auto-refresh active
    end note
```

### State Properties

| State | session | isLocked | Capabilities |
|-------|---------|----------|-------------|
| **LoggedOut** | `null` | `true` | View login screen only |
| **Locked** | `<session-id>` | `true` | View balances, accounts, history (read-only) |
| **Unlocked** | `<session-id>` | `false` | Full wallet operations, transactions, dApp interactions |

### Key Transitions

- **Login**: Creates new session on Nexus blockchain, attempts auto-unlock with PIN
- **Unlock**: Calls `sessions/unlock/local` API, saves PIN to session storage
- **Lock**: Calls `sessions/lock/local` API, maintains session but disables transactions
- **Logout**: Calls `sessions/terminate/local` API, clears all local session data
- **Lock Status Sync**: On initialization, `verifyLockStatus()` queries blockchain and syncs local state

---

## 2. dApp Connection Approval State Machine

Handles dApp connection requests with approval workflow:

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> CheckingConnection: dapp.connect() called
    
    CheckingConnection --> AlreadyConnected: Domain in approved list
    CheckingConnection --> Blocked: Domain in blocked list
    CheckingConnection --> PendingApproval: New connection request
    
    AlreadyConnected --> [*]: Return existing connection
    Blocked --> [*]: Throw error
    
    PendingApproval --> DisplayingModal: Open approval window
    DisplayingModal --> AwaitingUserInput: Show origin + fee info
    
    AwaitingUserInput --> ValidatingPayment: User approves (with fee)
    AwaitingUserInput --> StoringApproval: User approves (no fee)
    AwaitingUserInput --> Denied: User denies
    AwaitingUserInput --> BlockedByUser: User blocks domain
    
    ValidatingPayment --> ProcessingPayment: Fee account selected
    ProcessingPayment --> StoringApproval: Payment successful
    ProcessingPayment --> PaymentFailed: Insufficient balance / Error
    
    PaymentFailed --> AwaitingUserInput: Retry or buy tokens
    
    StoringApproval --> Connected: Save to chrome.storage
    Connected --> [*]: Resolve promise
    
    Denied --> [*]: Reject promise
    BlockedByUser --> StoringBlock: Add to blocked list
    StoringBlock --> [*]: Reject promise
    
    note right of PendingApproval
        - Generate unique requestId
        - Store in pendingApprovals Map
        - Includes origin, resolve, reject callbacks
    end note
    
    note right of ValidatingPayment
        - Check token balance
        - Validate fee account
        - Show buy tokens option if insufficient
    end note
```

### Connection States

| State | Storage | Window | Promise |
|-------|---------|--------|---------|
| **Idle** | None | None | N/A |
| **PendingApproval** | `pendingApprovals` Map | Opening | Pending |
| **AwaitingUserInput** | `pendingApprovals` Map | Open | Pending |
| **Connected** | `approvedDomains` (chrome.storage) | Closed | Resolved |
| **Blocked** | `blockedDomains` (chrome.storage) | Closed | Rejected |

### Message Flow

1. **dApp → inpage.js**: `nexus.connect({fee: {...}})`
2. **inpage.js → content.js**: Forward request
3. **content.js → background.js**: `{method: 'dapp.connect', params: {...}}`
4. **background.js**: Check approved/blocked lists
5. **background.js → approve-connection.html**: Open window with URL params
6. **approve-connection.js → background.js**: `{type: 'CONNECTION_RESPONSE', approved: true/false}`
7. **background.js**: Resolve/reject promise, store decision
8. **background.js → inpage.js**: Return result
9. **inpage.js → dApp**: Promise resolves/rejects

---

## 3. Transaction Approval State Machine

Handles dApp transaction requests with PIN validation:

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> ValidatingRequest: nexus.send() called
    
    ValidatingRequest --> CheckingWalletState: Validate parameters
    ValidatingRequest --> [*]: Invalid params (reject)
    
    CheckingWalletState --> RequiresUnlock: Wallet locked
    CheckingWalletState --> PendingApproval: Wallet unlocked
    
    RequiresUnlock --> [*]: Reject with "Wallet locked"
    
    PendingApproval --> DisplayingModal: Open approval window
    DisplayingModal --> AwaitingPIN: Show transaction details
    
    AwaitingPIN --> ValidatingPIN: User enters PIN + approves
    AwaitingPIN --> Denied: User denies
    
    ValidatingPIN --> ExecutingTransaction: PIN format valid
    ValidatingPIN --> AwaitingPIN: Invalid PIN format
    
    ExecutingTransaction --> VerifyingPIN: Call finance/debit/account
    VerifyingPIN --> Success: Transaction confirmed
    VerifyingPIN --> Failed: Invalid PIN / Insufficient balance
    
    Success --> DisplayingResult: Show txid in window
    Failed --> DisplayingResult: Show error in window
    
    DisplayingResult --> AwaitingClose: User reads result
    AwaitingClose --> [*]: User closes window
    
    Denied --> [*]: Reject promise
    
    note right of PendingApproval
        - Generate unique requestId
        - Store in pendingTransactionApprovals Map
        - Window stays open to show result
    end note
    
    note right of ExecutingTransaction
        - Sends PIN to Nexus API
        - API validates PIN server-side
        - No PIN validation in extension
    end note
```

### Transaction Request Flow

```mermaid
sequenceDiagram
    participant dApp
    participant inpage.js
    participant content.js
    participant background.js
    participant approve-transaction.html
    participant Nexus API
    
    dApp->>inpage.js: nexus.send({from, to, amount, reference})
    inpage.js->>content.js: Forward request
    content.js->>background.js: {method: 'dapp.send', params: {...}}
    
    alt Wallet Locked
        background.js-->>dApp: Reject: "Wallet locked"
    else Wallet Unlocked
        background.js->>approve-transaction.html: Open window (requestId in URL)
        approve-transaction.html->>background.js: Display transaction details
        
        Note over approve-transaction.html: User enters PIN
        
        approve-transaction.html->>background.js: {type: 'TRANSACTION_APPROVAL_RESPONSE', approved: true, pin}
        
        background.js->>Nexus API: finance/debit/account (with PIN)
        
        alt Transaction Success
            Nexus API-->>background.js: {txid: "..."}
            background.js->>approve-transaction.html: {type: 'TRANSACTION_RESULT', success: true, result: {...}}
            approve-transaction.html->>approve-transaction.html: Display success + txid
        else Transaction Failed
            Nexus API-->>background.js: Error
            background.js->>approve-transaction.html: {type: 'TRANSACTION_RESULT', success: false, error: "..."}
            approve-transaction.html->>approve-transaction.html: Display error
        end
        
        Note over approve-transaction.html: User reads result and closes window
        
        background.js-->>dApp: Resolve/Reject promise
    end
```

---

## 4. Popup UI Screen State Machine

The popup.html uses screen-based navigation:

```mermaid
stateDiagram-v2
    [*] --> CheckingAuth
    
    CheckingAuth --> LoginScreen: !isLoggedIn()
    CheckingAuth --> WalletScreen: isLoggedIn()
    
    LoginScreen --> WalletScreen: Successful login
    
    WalletScreen --> SendScreen: Click "Send"
    WalletScreen --> ReceiveScreen: Click "Receive"
    WalletScreen --> SettingsScreen: Click "Settings"
    
    SendScreen --> WalletScreen: Click "Back"
    SendScreen --> TransactionModal: Click "Confirm Send"
    
    TransactionModal --> SendScreen: Cancel
    TransactionModal --> WalletScreen: Success (auto-close)
    TransactionModal --> SendScreen: Error (retry)
    
    ReceiveScreen --> WalletScreen: Click "Back"
    
    SettingsScreen --> WalletScreen: Click "Back"
    SettingsScreen --> LoginScreen: Logout
    
    state WalletScreen {
        [*] --> CheckingLock
        CheckingLock --> LockedView: isLocked = true
        CheckingLock --> UnlockedView: isLocked = false
        
        LockedView --> UnlockModal: Click "Unlock"
        UnlockModal --> UnlockedView: PIN valid
        UnlockModal --> LockedView: PIN invalid / Cancel
        
        UnlockedView --> LockingWallet: Click "Lock"
        LockingWallet --> LockedView: Lock successful
        
        note right of LockedView
            - Show locked overlay
            - Display balance/accounts (read-only)
            - Disable Send button
        end note
        
        note right of UnlockedView
            - Full UI enabled
            - Auto-refresh active (10s)
            - Send/Receive enabled
        end note
    }
    
    note right of LoginScreen
        - Username input
        - Password input
        - PIN input
        - "Create Wallet" link
        - Node status check
    end note
```

### Screen Visibility Matrix

| Screen | Condition | Elements Shown |
|--------|-----------|----------------|
| **LoginScreen** | `!wallet.isLoggedIn()` | Username, password, PIN inputs, node selector |
| **WalletScreen** | `wallet.isLoggedIn()` | Balance, accounts, transactions, lock state |
| **WalletScreen (Locked)** | `wallet.isLoggedIn() && wallet.isLocked` | + Locked overlay, unlock button |
| **WalletScreen (Unlocked)** | `wallet.isLoggedIn() && !wallet.isLocked` | + Send/Receive buttons active, auto-refresh |
| **SendScreen** | User navigation | From account, to address, amount, reference fields |
| **ReceiveScreen** | User navigation | Account address, QR code |
| **SettingsScreen** | User navigation | Node URL, logout, version info |

---

## 5. Storage State Synchronization

Q-Wallet uses multiple storage layers with priority ordering:

```mermaid
stateDiagram-v2
    [*] --> Initializing
    
    Initializing --> CheckingSessionStorage: Load session data
    
    CheckingSessionStorage --> SessionFound: chrome.storage.session available
    CheckingSessionStorage --> CheckingLocalStorage: No session data
    
    SessionFound --> VerifyingSession: Load session, genesis, username
    
    CheckingLocalStorage --> LocalFound: Encrypted data in chrome.storage.local
    CheckingLocalStorage --> NoSession: No stored data
    
    LocalFound --> DecryptingLocal: Decrypt with memory-only key
    DecryptingLocal --> VerifyingSession: Decryption successful
    DecryptingLocal --> NoSession: Decryption failed
    
    VerifyingSession --> ValidatingWithBlockchain: Call sessions/status/local
    
    ValidatingWithBlockchain --> SyncingLockState: Session valid
    ValidatingWithBlockchain --> NoSession: Session expired
    
    SyncingLockState --> Active: Sync isLocked with blockchain
    NoSession --> Active: Clean state
    
    Active --> WritingSession: State changes (login/unlock/lock)
    WritingSession --> UpdatingSessionStorage: Try chrome.storage.session
    UpdatingSessionStorage --> Active: Write successful
    UpdatingSessionStorage --> UpdatingLocalStorage: Fallback to local
    
    UpdatingLocalStorage --> EncryptingData: Encrypt with memory key
    EncryptingData --> Active: Write successful
    
    Active --> ClearingSession: Logout
    ClearingSession --> [*]: Clear all storage layers
    
    note right of SessionFound
        PRIORITY 1: chrome.storage.session
        - RAM only, never disk
        - Cleared on browser close
        - Most secure option
    end note
    
    note right of LocalFound
        PRIORITY 2: chrome.storage.local
        - Encrypted with memory-only key
        - Persists browser restarts
        - Fallback for session storage
    end note
    
    note right of SyncingLockState
        CRITICAL: Blockchain is source of truth
        - Query sessions/status/local
        - Sync isLocked locally
        - Prevents desync issues
    end note
```

### Storage Priority System

1. **chrome.storage.session** (Preferred)
   - RAM-only storage (Manifest V3 feature)
   - Automatically cleared when browser closes
   - No disk persistence
   - Used for: session, genesis, username, isLocked, pin

2. **chrome.storage.local** (Fallback)
   - Persistent storage (survives browser restart)
   - Data encrypted with memory-only key
   - Used for: Encrypted session data, approved/blocked domains, node URL

3. **Nexus Blockchain** (Source of Truth)
   - Session lock state queried on initialization
   - `verifyLockStatus()` syncs local state with blockchain
   - Prevents state desynchronization

### Storage Data Flow

```
User Action (Login/Unlock/Lock)
    ↓
Wallet State Change (this.isLocked = true/false)
    ↓
Storage.saveSession({session, genesis, username, isLocked})
    ↓
Try chrome.storage.session.set() → Success ✓
    ↓ (Fallback)
Try chrome.storage.local.set(encrypted) → Success ✓
    ↓
State Persisted
```

---

## 6. Message Passing Architecture

The extension uses a hub-and-spoke message passing model:

```mermaid
stateDiagram-v2
    state "background.js (Hub)" as bg {
        [*] --> ListeningForMessages
        
        ListeningForMessages --> RoutingMessage: Message received
        
        RoutingMessage --> WalletNamespace: method: 'wallet.*'
        RoutingMessage --> AccountNamespace: method: 'account.*'
        RoutingMessage --> TransactionNamespace: method: 'transaction.*'
        RoutingMessage --> DAppNamespace: method: 'dapp.*'
        RoutingMessage --> SettingsNamespace: method: 'settings.*'
        
        WalletNamespace --> ExecutingWalletService: Call WalletService methods
        AccountNamespace --> ExecutingWalletService: Call WalletService methods
        TransactionNamespace --> ExecutingWalletService: Call WalletService methods
        DAppNamespace --> ExecutingDAppHandler: Custom dApp logic
        SettingsNamespace --> ExecutingSettings: Storage operations
        
        ExecutingWalletService --> SendingResponse: {result: ...}
        ExecutingDAppHandler --> SendingResponse: {result: ...}
        ExecutingSettings --> SendingResponse: {result: ...}
        
        ExecutingWalletService --> SendingError: {error: ...}
        ExecutingDAppHandler --> SendingError: {error: ...}
        ExecutingSettings --> SendingError: {error: ...}
        
        SendingResponse --> ListeningForMessages
        SendingError --> ListeningForMessages
    }
    
    state "popup.js" as popup {
        [*] --> UIEvent
        UIEvent --> SendingMessage: chrome.runtime.sendMessage()
        SendingMessage --> AwaitingResponse
        AwaitingResponse --> UpdateUI: Response received
        UpdateUI --> [*]
    }
    
    state "content.js" as content {
        [*] --> PageEvent
        PageEvent --> ForwardingToBG: From inpage.js
        ForwardingToBG --> AwaitingBGResponse
        AwaitingBGResponse --> ForwardingToPage: Response received
        ForwardingToPage --> [*]
    }
    
    state "inpage.js" as inpage {
        [*] --> DAppCall
        DAppCall --> PostingMessage: window.postMessage()
        PostingMessage --> AwaitingContentResponse
        AwaitingContentResponse --> ResolvingPromise: Response received
        ResolvingPromise --> [*]
    }
    
    popup --> bg: chrome.runtime.sendMessage
    bg --> popup: sendResponse()
    
    inpage --> content: window.postMessage
    content --> inpage: window.postMessage
    
    content --> bg: chrome.runtime.sendMessage
    bg --> content: sendResponse()
```

### Message Namespaces

| Namespace | Methods | Handler |
|-----------|---------|---------|
| **wallet.*** | login, logout, unlock, lock, create | WalletService |
| **account.*** | getBalance, listAccounts, getAccount | WalletService |
| **transaction.*** | send, getHistory, getStakeInfo | WalletService |
| **dapp.*** | connect, connectWithFee, send, getInfo | Custom handlers in background.js |
| **settings.*** | setNodeUrl, getNodeUrl | StorageService |

### Example Message Flow

```javascript
// popup.js sends
{
  method: 'wallet.login',
  params: {username: 'alice', password: '***', pin: '***'}
}

// background.js receives → routes to WalletService.login()

// background.js responds
{
  result: {success: true, genesis: '0x...', username: 'alice', isLocked: false}
}
// OR
{
  error: 'Invalid credentials'
}
```

---

## 7. Security State Transitions

Critical security boundaries and state transitions:

```mermaid
stateDiagram-v2
    [*] --> Untrusted
    
    state "Memory-Only Zone" as memory {
        [*] --> PINInMemory
        PINInMemory --> PINUsed: Transaction/Unlock
        PINUsed --> PINCleared: Operation complete
        PINCleared --> [*]
        
        note right of PINInMemory
            PIN only in:
            - chrome.storage.session (RAM)
            - Function parameters
            - Never logged
            - Cleared on logout
        end note
    }
    
    state "Encrypted Zone" as encrypted {
        [*] --> SessionEncrypted
        SessionEncrypted --> SessionDecrypted: Memory-only key
        SessionDecrypted --> SessionEncrypted: Browser close
        
        note right of SessionEncrypted
            Fallback storage:
            - chrome.storage.local
            - Encrypted with memory key
            - Key never persisted
        end note
    }
    
    state "Blockchain Validation" as blockchain {
        [*] --> ValidatingSession
        ValidatingSession --> SessionValid: sessions/status/local
        ValidatingSession --> SessionExpired: Invalid response
        
        SessionValid --> CheckingLockState
        CheckingLockState --> UnlockedOnChain: unlocked.transactions = true
        CheckingLockState --> LockedOnChain: unlocked.transactions = false
        
        note right of blockchain
            Source of truth:
            - Session validity
            - Lock state
            - Transaction authorization
        end note
    }
    
    state "dApp Security Boundary" as dapp {
        [*] --> CheckingOrigin
        CheckingOrigin --> Blocked: In blocked list
        CheckingOrigin --> Approved: In approved list
        CheckingOrigin --> RequiresApproval: New origin
        
        RequiresApproval --> UserApproval: Open modal
        UserApproval --> Approved: User approves
        UserApproval --> Blocked: User blocks
        
        Approved --> EnforcingHTTPS: All dApp calls
        EnforcingHTTPS --> AllowRequest: HTTPS enforced
        EnforcingHTTPS --> BlockRequest: HTTP detected
        
        note right of dapp
            Domain isolation:
            - Per-origin approval
            - HTTPS enforced
            - Content Security Policy
            - No eval() allowed
        end note
    }
    
    Untrusted --> memory: Login/Unlock
    memory --> encrypted: Fallback storage
    memory --> blockchain: Validate session
    blockchain --> dapp: Authorize dApp
```

### Security Guarantees by State

| State | PIN Location | Session Storage | dApp Access | Blockchain Auth |
|-------|-------------|-----------------|-------------|-----------------|
| **Logged Out** | None | None | Blocked | None |
| **Locked** | session storage | session/local (encrypted) | Blocked | Read-only |
| **Unlocked** | session storage | session/local (encrypted) | Requires approval | Full |

### Critical Security Rules

1. **PIN Handling**
   - NEVER logged (auto-redacted by Logger)
   - Only in chrome.storage.session (RAM)
   - Passed by value, never referenced
   - Cleared on logout

2. **Session Management**
   - Blockchain is source of truth
   - Local state synced on init
   - Sessions expire server-side
   - PIN required for termination

3. **dApp Isolation**
   - Per-origin approval required
   - HTTPS enforced for remote nodes
   - CSP prevents inline scripts
   - Message passing boundary (no shared objects)

4. **Storage Priority**
   - Prefer session storage (RAM-only)
   - Encrypt local storage with memory-only key
   - Clear all data on logout
   - Never persist PIN to disk

---

## State Transition Summary

### Key State Variables

```javascript
// In WalletService
this.session      // null | <session-id>
this.genesis      // null | <genesis-hash>
this.username     // null | <string>
this.isLocked     // boolean

// In background.js
pendingApprovals               // Map<requestId, {origin, resolve, reject}>
pendingTransactionApprovals    // Map<requestId, {origin, resolve, reject, windowId}>
recentConnectionRequests       // Map<origin, timestamp> (anti-duplicate)
recentTransactionRequests      // Map<txKey, timestamp> (anti-duplicate)

// In chrome.storage.session
{
  session: <session-id>,
  genesis: <genesis-hash>,
  username: <string>,
  isLocked: <boolean>,
  pin: <string>  // SECURITY: Only in session storage (RAM)
}

// In chrome.storage.local
approvedDomains: [origin1, origin2, ...]
blockedDomains: [origin3, origin4, ...]
nodeUrl: <string>
```

### State Invariants

1. `session !== null` ⟺ User is logged in
2. `isLocked === false` ⟹ `session !== null` (can't be unlocked without session)
3. `pin in storage` ⟹ `isLocked === false` (PIN only saved when unlocked)
4. `dApp connected` ⟹ `origin in approvedDomains && origin not in blockedDomains`
5. `transaction executing` ⟹ `isLocked === false && wallet.isLoggedIn()`

### Concurrent State Handling

Q-Wallet handles multiple concurrent operations:

- **Multiple dApp connections**: Each stored in `pendingApprovals` with unique requestId
- **Multiple transactions**: Each stored in `pendingTransactionApprovals` with unique requestId
- **Duplicate prevention**: `recentConnectionRequests` and `recentTransactionRequests` track recent operations
- **Window management**: Each approval window linked to requestId, closed after resolution

---

## Implementation Notes

### State Persistence

- **Session state**: Survives page navigation, cleared on browser close
- **Approval state**: Cleared on window close or user decision
- **Connection state**: Persists indefinitely until user blocks/removes

### Error Recovery

- **Session expired**: Wallet detects expired sessions, prompts re-login
- **Lock desync**: `verifyLockStatus()` queries blockchain and syncs
- **Orphaned approvals**: 5-minute timeout removes stale approval requests
- **Network errors**: User-friendly errors, no silent failures

### Performance Considerations

- **Auto-refresh**: Only enabled when unlocked (10s interval)
- **Lazy initialization**: Wallet service created on-demand
- **Batch operations**: Multiple account queries batched into single API call
- **Storage caching**: Node URL cached, only updated on user change

---

## Testing State Transitions

To test state machines:

1. **Wallet States**: Login → Unlock → Lock → Logout sequence
2. **dApp Connection**: Connect (approve) → Connect (already approved) → Block → Connect (blocked)
3. **Transaction**: Approve with valid PIN → Deny → Approve with invalid PIN
4. **Lock Sync**: Unlock in wallet → Lock via API → Reload extension (should show locked)
5. **Storage Fallback**: Disable session storage → Login → Verify local storage used

Use example-dapp.html for dApp flow testing.

---

## Diagram Legend

- **Solid arrow**: State transition
- **Dashed arrow**: Return/response flow
- **[*]**: Initial/terminal pseudo-state
- **note right/left**: Additional context
- **state nesting**: Sub-state machines

---

*Generated for Q-Wallet v1.0 - Quantum-Resistant Cryptocurrency Wallet*
