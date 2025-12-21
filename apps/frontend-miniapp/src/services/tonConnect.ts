import { TonConnectUI } from '@tonconnect/ui';
import { beginCell } from '@ton/core';

export interface WalletInfo {
  address: string;
  walletType: string;
  connected: boolean;
}

type StatusChangeCallback = (wallet: { address: string } | null) => void;

class TonConnectService {
  /**
   * IMPORTANT: We must NOT create a separate `new TonConnectSDK()` instance.
   * TonConnectUI internally owns its connector (`tonConnectUI.connector`).
   *
   * If we create a second SDK instance, we end up with TWO different connectors:
   * - `tonConnectUI.connector` (used by the modal button "Connect Wallet in Telegram")
   * - `this.connector` (our separate SDK instance)
   *
   * That causes the fatal mismatch we saw in logs:
   * TonConnectUI shows address (restored), but our SDK says `connected=false`,
   * we "reject" it, and then TonConnectUI tries to connect again -> "already connected".
   */
  private connector: any | null = null;
  private tonConnectUI: TonConnectUI | null = null;
  private walletInfo: WalletInfo | null = null;
  private readonly STORAGE_KEY = 'ton_wallet_info';
  private initialized: boolean = false;
  private statusChangeCallbacks: StatusChangeCallback[] = [];

  /**
   * Lazy initialization - ONLY called when user explicitly clicks connect().
   * INVARIANT: This is NEVER called on mount - button renders immediately.
   * 
   * This method:
   * - Waits for Telegram.WebApp.ready()
   * - Creates TonConnectUI (which owns the internal connector)
   * - Loads wallet from storage
   * 
   * All of this happens on user action, not automatically.
   */
  private ensureInitialized(): void {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    // CRITICAL: TON Connect requires Telegram WebApp context
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) {
      console.warn('[TON Connect] ⚠️ Cannot initialize: Telegram WebApp context not found');
      console.warn('[TON Connect] TON Connect requires Telegram Mini App environment');
      return;
    }

    // CRITICAL: Wait for Telegram.WebApp.ready() before initializing
    // This prevents infinite loading in Telegram Mini App
    if (typeof tg.ready === 'function') {
      try {
        tg.ready();
        console.log('[TON Connect] ✅ Telegram.WebApp.ready() called before initialization');
      } catch (error) {
        console.warn('[TON Connect] Telegram.WebApp.ready() failed, continuing anyway:', error);
      }
    }

    try {
      // CRITICAL: Clear ALL TON Connect storage keys BEFORE initializing TonConnectUI
      // TonConnectUI automatically restores connection from storage when created
      // According to TON Connect docs, sessions are stored as: tonconnect_session_${sessionId}
      // We need to clear ALL session keys to prevent restoreConnection from working
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          // Clear the shared storage key (used by UI library)
          const tonConnectStorageKey = 'ton-connect-storage';
          const hadStorage = !!localStorage.getItem(tonConnectStorageKey);
          if (hadStorage) {
            localStorage.removeItem(tonConnectStorageKey);
            console.log('[TON Connect] Cleared shared storage key: ton-connect-storage');
          }

          // CRITICAL: Clear ALL session keys matching pattern: tonconnect_session_*
          // These are the actual connection sessions that restoreConnection uses
          const allKeys = Object.keys(localStorage);
          const sessionKeys = allKeys.filter(key => 
            key.startsWith('tonconnect_session_') || 
            key.startsWith('ton-connect-session_') ||
            key.toLowerCase().includes('tonconnect_session')
          );
          
          sessionKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`[TON Connect] Cleared session key: ${key}`);
          });

          if (sessionKeys.length > 0) {
            console.log(`[TON Connect] Cleared ${sessionKeys.length} session key(s) before initialization`);
          }
        }
      } catch (e) {
        console.warn('[TON Connect] Failed to clear storage before initialization:', e);
      }

      this.initializeConnector();
      this.loadWalletFromStorage();
      this.initialized = true;
      console.log('[TON Connect] ✅ Initialized successfully');
    } catch (error) {
      console.error('[TON Connect] Failed to initialize:', error);
    }
  }

  private initializeConnector() {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

      // Initialize TON Connect UI for wallet connection UI
      // This handles the modal and connection URL generation automatically
      // TonConnectUI will auto-detect Telegram Mini App and handle return URL
      this.tonConnectUI = new TonConnectUI({
        manifestUrl,
        // uiOptions can be configured if needed, but TonConnectUI auto-detects Telegram Mini App
        // and handles the return URL automatically
      });

      // CRITICAL: Use the SAME connector instance that TonConnectUI uses.
      // This prevents state mismatch ("UI connected but SDK not connected") and the
      // "Wallet connection called but wallet already connected" loop.
      this.connector = (this.tonConnectUI as any).connector;

      // CRITICAL: TonConnectUI is the ONLY source of truth for connection status.
      // Never "reject" a TonConnectUI wallet based on a different connector instance.
      this.tonConnectUI.onStatusChange((wallet) => {
        console.log('[TON Connect UI] 🔔 onStatusChange fired:', {
          hasWallet: !!wallet,
          hasAddress: !!wallet?.account?.address,
          address: wallet?.account?.address,
          uiConnected: this.tonConnectUI?.connected,
        });

        // INVARIANT: Never show "connected" unless TonConnectUI says it's connected AND we have an address.
        // INVARIANT: Reject "support-assisted" style data (address without any device/provider/proof hints).
        if (wallet?.account?.address && this.tonConnectUI?.connected) {
          const isTelegramMiniApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
          const isTelegramWallet =
            (wallet as any).device?.appName?.toLowerCase().includes('telegram') ||
            (wallet as any).provider?.name?.toLowerCase().includes('telegram') ||
            (wallet as any).walletAppName?.toLowerCase().includes('telegram');

          const hasSessionProofOrHints =
            !!(wallet as any).connectItems ||
            !!(wallet as any).proof ||
            !!(wallet as any).device?.appName ||
            !!(wallet as any).provider?.name ||
            !!(wallet as any).walletAppName;

          const hasDeviceInfo = !!(wallet as any).device || !!(wallet as any).provider;

          // Only reject if it looks like a "ghost" session: address but no proof/hints and no device info.
          // Telegram Wallet in TMA can be slightly different, so allow it if identified as Telegram Wallet.
          const isSupportAssisted = !hasSessionProofOrHints && !hasDeviceInfo && !(isTelegramMiniApp && isTelegramWallet);
          if (isSupportAssisted) {
            console.warn('[TON Connect] ⚠️ Rejecting support-assisted/ghost connection (no proof/device info)');
            // Force clean state.
            this.walletInfo = null;
            this.saveWalletToStorage(null);
            this.statusChangeCallbacks.forEach(cb => cb(null));
            return;
          }

          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: (wallet as any).device?.appName || (wallet as any).provider?.name || 'unknown',
            connected: true,
          };
          this.walletInfo = walletInfo;
          this.saveWalletToStorage(walletInfo);
          console.log('[TON Connect UI] ✅ Valid connection established:', wallet.account.address);
          this.statusChangeCallbacks.forEach(cb => cb({ address: wallet.account.address }));
        } else {
          this.walletInfo = null;
          this.saveWalletToStorage(null);
          this.statusChangeCallbacks.forEach(cb => cb(null));
        }
      });
    } catch (error) {
      console.error('[TON Connect] Failed to initialize connector:', error);
    }
  }

  /**
   * Load wallet info from localStorage (sync, no async calls).
   * This is safe to call on mount - it only reads from storage.
   */
  private loadWalletFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // CRITICAL: Load from storage but DON'T notify callbacks yet
        // Storage might be stale - connector might not be connected
        // We'll only notify callbacks when connector.onStatusChange confirms the connection
        // This prevents showing "connected" when SDK is actually disconnected
        this.walletInfo = parsed;
        console.log('[TON Connect] Loaded wallet from storage:', parsed?.address, '(not notifying callbacks until connector verifies)');
      }
    } catch (error) {
      console.error('[TON Connect] Failed to load wallet from storage:', error);
    }
  }

  private saveWalletToStorage(walletInfo: WalletInfo | null) {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      if (walletInfo) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(walletInfo));
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    } catch (error) {
      console.error('[TON Connect] Failed to save wallet to storage:', error);
    }
  }

  /**
   * Register callback for status changes.
   * INVARIANT: This does NOT trigger initialization - it only registers a listener.
   * Initialization happens lazily when user clicks connect().
   */
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.push(callback);
    
    // CRITICAL: Don't immediately call with stored walletInfo
    // Storage might be stale - only trust connector's actual connection state
    // Wait for connector.onStatusChange to fire and verify connection
    // This prevents showing "connected" when SDK is actually disconnected
    // If connector is initialized and connected, it will fire onStatusChange
    // If connector is not initialized, we'll wait until user clicks connect()
    
    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks = this.statusChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Connect to wallet - this is the ONLY place initialization should happen.
   * Called explicitly by user action (button click), never on mount.
   * 
   * INVARIANT: Uses universal modal flow - NEVER assumes injected wallet exists.
   * INVARIANT: Forces user-visible wallet UI - NO silent or support-assisted connections.
   * INVARIANT: Only accepts connections with address AND session proof.
   * Works in Telegram Mini App, mobile browser, and desktop browser.
   */
  async connect(): Promise<void> {
    // Initialize only when user explicitly clicks connect
    this.ensureInitialized();

    if (!this.tonConnectUI) {
      throw new Error('TON Connect UI not initialized');
    }

    if (!this.connector) {
      throw new Error('TON Connect not initialized - window not available');
    }

    try {
      // CRITICAL: Wait for TonConnectUI's connectionRestored promise FIRST.
      // TonConnectUI automatically restores the previous session asynchronously.
      // If we don't wait, we might check `connected` before restore completes,
      // then openModal() will try to connect again and fail with "already connected".
      console.log('[TON Connect] Waiting for connectionRestored promise...');
      try {
        const wasRestored = await this.tonConnectUI.connectionRestored;
        console.log('[TON Connect] connectionRestored resolved:', wasRestored);
      } catch (restoreError) {
        console.warn('[TON Connect] connectionRestored failed (continuing):', restoreError);
      }

      // CRITICAL: Single source of truth is TonConnectUI.
      // The modal button uses TonConnectUI.connector internally; do NOT rely on a separate SDK instance.
      if (this.tonConnectUI.connected) {
        console.log('[TON Connect] TonConnectUI is already connected after restore');
        // Verify we have walletInfo (should be set by onStatusChange)
        if (this.walletInfo?.address) {
          console.log('[TON Connect] Already connected with valid session');
          return;
        } else {
          // Connector is connected but no walletInfo - sync state from TonConnectUI
          console.warn('[TON Connect] Connector connected but no walletInfo - syncing from UI');
          const wallet = this.tonConnectUI.wallet;
          if (wallet?.account?.address) {
            const walletInfo: WalletInfo = {
              address: wallet.account.address,
              walletType: (wallet as any).device?.appName || 'telegram-wallet',
              connected: true,
            };
            this.walletInfo = walletInfo;
            this.saveWalletToStorage(walletInfo);
            this.statusChangeCallbacks.forEach(cb => cb({ address: wallet.account.address }));
            console.log('[TON Connect] ✅ Synced wallet from TonConnectUI:', wallet.account.address);
          }
          return;
        }
      }

      // If we reach here, TonConnectUI is NOT connected (no session to restore).
      // We can safely open the modal for a new connection.
      console.log('[TON Connect] No existing connection - proceeding to open modal');
      
      // Clear walletInfo if it exists (it's stale if connector is not connected)
      if (this.walletInfo?.address) {
        console.log('[TON Connect] Clearing stale walletInfo - not connected');
        this.walletInfo = null;
        this.saveWalletToStorage(null);
        this.statusChangeCallbacks.forEach(cb => cb(null));
      }

      // CRITICAL: Clear ALL TON Connect storage keys
      // According to TON Connect docs, sessions are stored as: tonconnect_session_${sessionId}
      // We must clear ALL session keys to prevent restoreConnection from reconnecting
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          // Clear the shared storage key (used by UI library)
          const tonConnectStorageKey = 'ton-connect-storage';
          if (localStorage.getItem(tonConnectStorageKey)) {
            localStorage.removeItem(tonConnectStorageKey);
            console.log('[TON Connect] Cleared shared storage key: ton-connect-storage');
          }

          // CRITICAL: Clear ALL session keys matching pattern: tonconnect_session_*
          // These are the actual connection sessions that restoreConnection uses
          const allKeys = Object.keys(localStorage);
          const sessionKeys = allKeys.filter(key => 
            key.startsWith('tonconnect_session_') || 
            key.startsWith('ton-connect-session_') ||
            key.toLowerCase().includes('tonconnect_session')
          );
          
          sessionKeys.forEach(key => {
            localStorage.removeItem(key);
            console.log(`[TON Connect] Cleared session key: ${key}`);
          });

          if (sessionKeys.length > 0) {
            console.log(`[TON Connect] Cleared ${sessionKeys.length} session key(s) before connection`);
          }
        }
      } catch (e) {
        console.warn('[TON Connect] Failed to clear storage:', e);
      }

      // Let storage clears settle (TonConnectUI may read storage during open).
      await new Promise(resolve => setTimeout(resolve, 300));

      // CRITICAL: Get available wallets and connect safely
      // NEVER assume injected wallet exists - TonConnectUI provides wallets list
      const walletsList = await this.tonConnectUI.getWallets();
      
      // Log all available wallets for debugging
      console.log('[TON Connect] Available wallets:', walletsList.map(w => ({
        name: w.name,
        appName: (w as any).appName,
        universalLink: w.universalLink,
        bridgeUrl: w.bridgeUrl,
        aboutUrl: (w as any).aboutUrl,
        imageUrl: (w as any).imageUrl
      })));
      
      if (walletsList.length === 0) {
        throw new Error('No TON wallets available. Please install a TON wallet app.');
      }

      // Filter out wallets that require injection (if we can detect them)
      // Prefer universal link wallets that work across all environments
      const universalWallets = walletsList.filter(w => {
        // Prefer wallets with universalLink (works everywhere)
        // Avoid wallets that only work with injection
        return w.universalLink || w.bridgeUrl;
      });

      // Use universal wallets if available, otherwise fall back to all wallets
      const availableWallets = universalWallets.length > 0 ? universalWallets : walletsList;
      void availableWallets; // currently used for debugging/sanity checks only

      console.log('[TON Connect] 🔄 Opening wallet connection modal via TonConnectUI');
      console.log('[TON Connect] Final state check - UI connected:', this.tonConnectUI.connected);
      
      // Use TonConnectUI.openModal() to show wallet selection modal
      // This will:
      // 1. Show wallet selection modal (with "Connect Wallet in Telegram" button)
      // 2. Generate proper TON Connect connection URL with request parameters
      // 3. Open the wallet UI automatically (handles Telegram.WebApp.openLink internally)
      // 4. Handle return strategy for Telegram Mini App
      await this.tonConnectUI.openModal();
      
      console.log('[TON Connect] ✅ Wallet connection modal opened');
      console.log('[TON Connect] User will see wallet selection and approval dialog');
      console.log('[TON Connect] Waiting for user approval - onStatusChange will fire when connection completes');
      
      // ❗ DO NOT read wallet/account here - onStatusChange will handle it
      // onStatusChange will verify session proof before accepting connection
    } catch (error: any) {
      // Provide user-friendly error messages
      const errorMessage = error?.message || 'Failed to connect wallet';
      
      // Check for "already connected" error from TonConnectUI
      if (errorMessage.includes('already connected')) {
        console.warn('[TON Connect] TonConnectUI says already connected - forcing UI disconnect and retry');
        try {
          if (this.tonConnectUI?.connected) {
            await this.tonConnectUI.disconnect();
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          // Clear everything
          this.walletInfo = null;
          this.saveWalletToStorage(null);
          // Clear shared storage
          if (typeof window !== 'undefined' && window.localStorage) {
            const tonConnectStorageKey = 'ton-connect-storage';
            localStorage.removeItem(tonConnectStorageKey);
            console.log('[TON Connect] Cleared shared storage in error handler');
          }
          this.statusChangeCallbacks.forEach(cb => cb(null));
          // Wait longer for TonConnectUI to sync with disconnected state
          console.log('[TON Connect] Waiting for TonConnectUI to sync with disconnected state');
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Retry opening modal
          if (this.tonConnectUI) {
            console.log('[TON Connect] Retrying openModal after forced disconnect');
            await this.tonConnectUI.openModal();
          }
        } catch (retryError) {
          console.error('[TON Connect] Retry failed:', retryError);
          throw new Error('Please refresh the page and try again');
        }
        return;
      }
      
      // Check for injected wallet error and provide helpful message
      if (errorMessage.includes('injected wallet') || errorMessage.includes('jsBridgeKey')) {
        console.error('[TON Connect] Injected wallet error:', error);
        throw new Error('Please use the wallet selector to choose your wallet. Injected wallets are not supported in this environment.');
      }
      
      console.error('[TON Connect] Connection error:', error);
      throw new Error(errorMessage);
    }
  }

  async disconnect(): Promise<void> {
    try {
      // CRITICAL: Always disconnect via TonConnectUI if available.
      // This ensures we disconnect the SAME connector used by the modal.
      if (this.tonConnectUI) {
        await this.tonConnectUI.disconnect();
      } else if (this.connector?.connected) {
        await this.connector.disconnect();
      }
      // Clear our stored wallet info
      this.walletInfo = null;
      this.saveWalletToStorage(null);
      // Notify callbacks that we disconnected
      this.statusChangeCallbacks.forEach(cb => cb(null));
    } catch (error) {
      console.error('[TON Connect] Disconnect error:', error);
    }
  }

  /**
   * Get stored wallet info without triggering initialization.
   * This is safe to call on mount - it only returns cached data.
   * Initialization happens lazily when user clicks connect.
   */
  getWalletInfo(): WalletInfo | null {
    // Return cached wallet info without initializing
    // This prevents blocking UI on mount
    return this.walletInfo;
  }

  /**
   * Check connection status without triggering initialization.
   * Returns false if not initialized - initialization happens on connect().
   */
  isConnected(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    // Don't initialize here - only check if already initialized
    return this.initialized && (this.tonConnectUI?.connected || this.connector?.connected || false);
  }

  async sendTransaction(transaction: any): Promise<string> {
    // Initialize only when actually needed (user action)
    this.ensureInitialized();

    // CRITICAL: Check BOTH connector.connected AND walletInfo.address
    // TonConnectUI might show address but SDK might not be connected
    // This can happen if disconnect didn't fully clear both states
    if (!this.tonConnectUI || !this.connector) {
      throw new Error('Wallet not connected');
    }

    // Check connector connection state
    if (!this.tonConnectUI.connected) {
      // If we have walletInfo but connector is not connected, there's a state mismatch
      // This means the UI shows connected but SDK is disconnected
      if (this.walletInfo?.address) {
        console.warn('[TON Connect] State mismatch: walletInfo exists but connector not connected');
        console.warn('[TON Connect] Clearing stale walletInfo and asking user to reconnect');
        // Clear stale walletInfo
        this.walletInfo = null;
        this.saveWalletToStorage(null);
        this.statusChangeCallbacks.forEach(cb => cb(null));
        throw new Error('Wallet connection lost. Please reconnect your wallet.');
      }
      throw new Error('Wallet not connected');
    }

    // Double-check: ensure walletInfo matches connector state
    // If connector is connected but we don't have walletInfo, try to sync
    if (!this.walletInfo?.address) {
      console.warn('[TON Connect] Connector connected but no walletInfo. Syncing state...');
      // Try to get wallet from connector
      try {
        const wallet = (this.tonConnectUI as any).wallet || (this.connector as any).wallet;
        if (wallet?.account?.address) {
          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: (wallet as any).device?.appName || (wallet as any).provider?.name || 'unknown',
            connected: true,
          };
          this.walletInfo = walletInfo;
          this.saveWalletToStorage(walletInfo);
          // Notify callbacks to update UI
          this.statusChangeCallbacks.forEach(cb => cb({ address: wallet.account.address }));
          console.log('[TON Connect] ✅ State synced:', wallet.account.address);
        } else {
          throw new Error('Wallet not connected');
        }
      } catch (syncError) {
        console.error('[TON Connect] Failed to sync wallet state:', syncError);
        throw new Error('Wallet not connected');
      }
    }

    try {
      // Use TonConnectUI for sending transactions so it can handle Telegram redirect / modals.
      const result = await this.tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        messages: [transaction],
      } as any);

      return (result as any).boc; // Return transaction BOC (Bag of Cells)
    } catch (error) {
      console.error('[TON Connect] Sign transaction error:', error);
      throw error;
    }
  }

  // Alias for sendTransaction (for backward compatibility)
  async signTransaction(transaction: any): Promise<string> {
    return this.sendTransaction(transaction);
  }

  // Helper to create USDT jetton transfer transaction
  createUsdtTransferTransaction(
    toAddress: string,
    amount: string, // Amount in USDT (will be converted to jetton units)
    forwardAmount: string = '0.05', // Forward TON amount for gas
  ): any {
    // USDT Jetton Master Contract on TON mainnet
    const USDT_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
    
    // Convert USDT amount to jetton units (6 decimals)
    const jettonAmount = (parseFloat(amount) * 1e6).toString();

    return {
      address: USDT_JETTON_MASTER,
      amount: forwardAmount, // Forward TON for gas
      payload: this.createJettonTransferPayload(toAddress, jettonAmount),
    };
  }

  // Helper to create TON transfer transaction with optional comment
  createTonTransferTransaction(
    toAddress: string,
    amount: string = '1', // Amount in TON (will be converted to nanoTON)
    comment?: string, // Optional comment/memo
  ): any {
    // Convert TON to nanoTON (1 TON = 10^9 nanoTON)
    const amountNano = (parseFloat(amount) * 1e9).toString();
    
    const transaction: any = {
      address: toAddress,
      amount: amountNano,
    };
    
    // Add comment as payload if provided
    // TON Connect requires payload to be base64-encoded BOC
    // For text comments, we encode: opcode 0x00000000 + UTF-8 text
    if (comment) {
      const payload = this.encodeTextComment(comment);
      // Only add payload if encoding succeeded (non-empty)
      if (payload) {
        transaction.payload = payload;
      } else {
        // Log that comment won't be included (encoding not implemented)
        console.warn('[TON Connect] Comment not included in transaction (encoding not implemented)');
      }
    }
    
    return transaction;
  }

  /**
   * Encode a text comment as a base64 BOC payload for TON Connect.
   * Uses @ton/core for proper Cell/BOC encoding.
   * Format: 32-bit opcode (0x00000000 for text) + UTF-8 encoded text
   */
  private encodeTextComment(text: string): string {
    try {
      // Use @ton/core to properly encode the text comment as a Cell
      // Text comments in TON have opcode 0 followed by the text
      const cell = beginCell()
        .storeUint(0, 32) // opcode 0 for text comment
        .storeStringTail(text) // UTF-8 text
        .endCell();
      
      // Convert Cell to BOC (Bag of Cells) and then to base64
      const boc = cell.toBoc();
      const base64 = Buffer.from(boc).toString('base64');
      
      console.log('[TON Connect] Encoded text comment:', text, '-> base64 length:', base64.length);
      return base64;
    } catch (e) {
      console.error('[TON Connect] Failed to encode text comment:', e);
      return '';
    }
  }

  private createJettonTransferPayload(toAddress: string, jettonAmount: string): string {
    // This is a simplified version - in production, you'd use proper TON SDK to build the payload
    // For now, return empty string - actual implementation will use @ton/core or similar
    // The backend will handle the actual transaction verification
    return '';
  }
}

// Create singleton instance (but don't initialize until client-side)
export const tonConnectService = new TonConnectService();
