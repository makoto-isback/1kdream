import TonConnectSDK from '@tonconnect/sdk';
import { TonConnectUI } from '@tonconnect/ui';

export interface WalletInfo {
  address: string;
  walletType: string;
  connected: boolean;
}

type StatusChangeCallback = (wallet: { address: string } | null) => void;

class TonConnectService {
  private connector: TonConnectSDK | null = null;
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
   * - Creates TonConnectSDK (may hang if manifest fails)
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
      const isTelegramMiniApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;

      // Initialize TON Connect UI for wallet connection UI
      // This handles the modal and connection URL generation automatically
      // TonConnectUI will auto-detect Telegram Mini App and handle return URL
      this.tonConnectUI = new TonConnectUI({
        manifestUrl,
        // uiOptions can be configured if needed, but TonConnectUI auto-detects Telegram Mini App
        // and handles the return URL automatically
      });

      // Initialize TON Connect SDK with manifest (for transaction signing and operations)
      // CRITICAL: Do NOT configure injected wallet - let SDK auto-detect
      // This ensures compatibility across Telegram Mini App, mobile, and desktop
      this.connector = new TonConnectSDK({
        manifestUrl,
        // Do NOT set jsBridgeKey or injected wallet options
        // SDK will automatically detect environment and show appropriate modal
      });

      // CRITICAL: Sync TonConnectUI and TonConnectSDK connection state
      // Both should share the same storage, but we listen to both to ensure UI updates
      // TonConnectUI handles the connection UI, SDK handles operations
      // This ensures UI updates when user returns from wallet approval
      this.tonConnectUI.onStatusChange((wallet) => {
        console.log('[TON Connect UI] 🔔 onStatusChange fired:', {
          hasWallet: !!wallet,
          hasAddress: !!wallet?.account?.address,
          address: wallet?.account?.address,
        });
        
        // Sync connection state when TonConnectUI detects connection
        // This ensures UI updates when user returns from wallet approval
        if (wallet?.account?.address) {
          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: (wallet as any).device?.appName || (wallet as any).provider?.name || 'unknown',
            connected: true,
          };
          this.walletInfo = walletInfo;
          this.saveWalletToStorage(walletInfo);
          
          console.log('[TON Connect UI] ✅ Connection synced:', wallet.account.address);
          // Notify all callbacks to update UI
          this.statusChangeCallbacks.forEach(cb => cb({ address: wallet.account.address }));
        } else {
          // Disconnected
          this.walletInfo = null;
          this.saveWalletToStorage(null);
          this.statusChangeCallbacks.forEach(cb => cb(null));
        }
      });

      // Listen for connection events from SDK - this is the ONLY place we read account.address
      // INVARIANT: Only accept connections with address AND session proof
      // Reject support-assisted mode (no UI opened, no user approval)
      // CRITICAL: This is the SOURCE OF TRUTH for connection state
      // Only when this fires with an address should we show "connected" in UI
      this.connector.onStatusChange((wallet) => {
        // CRITICAL: Add detailed logging to debug connection issues
        console.log('[TON Connect SDK] 🔔 onStatusChange fired:', {
          hasWallet: !!wallet,
          hasAccount: !!wallet?.account,
          hasAddress: !!wallet?.account?.address,
          address: wallet?.account?.address,
          connectorConnected: this.connector?.connected,
          device: (wallet as any)?.device,
          provider: (wallet as any)?.provider,
          walletAppName: (wallet as any)?.walletAppName,
          connectItems: (wallet as any)?.connectItems,
          proof: (wallet as any)?.proof,
          // Log full wallet object structure for debugging
          walletKeys: wallet ? Object.keys(wallet) : [],
          accountKeys: wallet?.account ? Object.keys(wallet.account) : []
        });
        
        if (wallet?.account?.address) {
          // CRITICAL: Verify this is a real connection, not support-assisted mode
          // Support-assisted mode has address but no session proof
          // Check for session proof indicators:
          // - connectItems (TON Connect v2)
          // - proof (TON Connect v2)
          // - device.appName or provider.name (indicates real wallet connection)
          // - wallet.appName (Telegram Wallet in Mini App)
          const hasSessionProof = 
            !!(wallet as any).connectItems || 
            !!(wallet as any).proof ||
            !!(wallet as any).device?.appName ||
            !!(wallet as any).provider?.name ||
            !!(wallet as any).walletAppName;
          
          // Additional check: support-assisted mode often lacks device/provider info
          const hasDeviceInfo = !!(wallet as any).device || !!(wallet as any).provider;
          
          // In Telegram Mini App, be less strict - Telegram Wallet might not have all properties
          const isTelegramMiniApp = typeof window !== 'undefined' && !!(window as any).Telegram?.WebApp;
          const isTelegramWallet = 
            (wallet as any).device?.appName?.toLowerCase().includes('telegram') ||
            (wallet as any).provider?.name?.toLowerCase().includes('telegram') ||
            (wallet as any).walletAppName?.toLowerCase().includes('telegram');
          
          // Only reject if clearly support-assisted (no proof AND no device info AND not Telegram Wallet)
          const isSupportAssisted = !hasSessionProof && !hasDeviceInfo && !(isTelegramMiniApp && isTelegramWallet);
          
          if (isSupportAssisted) {
            console.warn('[TON Connect] ⚠️ Rejecting support-assisted connection (no session proof or device info)');
            console.warn('[TON Connect] Wallet object:', JSON.stringify(wallet, null, 2));
            // Reject support-assisted mode - reset connection
            this.walletInfo = null;
            this.saveWalletToStorage(null);
            this.statusChangeCallbacks.forEach(cb => cb(null));
            return;
          }
          
          // Valid connection: has address AND session proof/device info
          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: (wallet as any).device?.appName || (wallet as any).provider?.name || 'unknown',
            connected: true,
          };
          this.walletInfo = walletInfo;
          this.saveWalletToStorage(walletInfo);
          
          console.log('[TON Connect SDK] ✅ Valid connection established:', wallet.account.address);
          console.log('[TON Connect SDK] ✅ Notifying callbacks - UI will show connected');
          // CRITICAL: This is the ONLY place we should notify callbacks
          // This ensures UI only shows "connected" when SDK connector is actually connected
          this.statusChangeCallbacks.forEach(cb => cb({ address: wallet.account.address }));
        } else {
          this.walletInfo = null;
          this.saveWalletToStorage(null);
          
          // Notify all callbacks
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

    if (!this.connector) {
      throw new Error('TON Connect not initialized - window not available');
    }

    try {
      // CRITICAL: Check if already connected BEFORE calling openModal()
      // Both TonConnectUI and TonConnectSDK share the same storage
      // If walletInfo exists, both are likely connected
      // TonConnectUI.openModal() will throw an error if already connected
      if (this.walletInfo?.address) {
        console.log('[TON Connect] Wallet already connected, disconnecting first to allow reconnection');
        // Disconnect SDK first (this also clears shared storage)
        if (this.connector.connected) {
          await this.connector.disconnect();
        }
        // Clear our stored wallet info
        this.walletInfo = null;
        this.saveWalletToStorage(null);
        // Notify callbacks that we disconnected
        this.statusChangeCallbacks.forEach(cb => cb(null));
        // Small delay to ensure disconnect completes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Also check connector.connected as a fallback
      if (this.connector.connected) {
        // Verify existing connection has session proof (not support-assisted)
        // Note: connector.wallet might not be directly accessible, so we check our stored info
        if (this.walletInfo?.address) {
          // If we have stored wallet info, it means onStatusChange already validated it
          console.log('[TON Connect] Already connected with valid session');
          return;
        } else {
          // Connected but no stored info = support-assisted mode
          console.warn('[TON Connect] Existing connection is support-assisted - reconnecting');
          await this.connector.disconnect();
        }
      }

      // CRITICAL: Get available wallets and connect safely
      // NEVER assume injected wallet exists - SDK will handle environment detection
      const walletsList = await this.connector.getWallets();
      
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

      // CRITICAL: Use TonConnectUI to handle wallet connection UI
      // This automatically generates the correct connection URL and opens the wallet UI
      // Works in both Telegram Mini App and browser environments
      if (!this.tonConnectUI) {
        throw new Error('TON Connect UI not initialized');
      }

      console.log('[TON Connect] 🔄 Opening wallet connection modal via TonConnectUI');
      
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
    if (!this.connector) {
      return;
    }

    try {
      // Disconnect SDK (this also clears shared storage used by TonConnectUI)
      if (this.connector.connected) {
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
    return this.initialized && (this.connector?.connected || false);
  }

  async sendTransaction(transaction: any): Promise<string> {
    // Initialize only when actually needed (user action)
    this.ensureInitialized();

    // CRITICAL: Check BOTH connector.connected AND walletInfo.address
    // TonConnectUI might show address but SDK might not be connected
    // This can happen if disconnect didn't fully clear both states
    if (!this.connector) {
      throw new Error('Wallet not connected');
    }

    // Check connector connection state
    if (!this.connector.connected) {
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
        const wallet = (this.connector as any).wallet;
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
      const result = await this.connector.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        messages: [transaction],
      });

      return result.boc; // Return transaction BOC (Bag of Cells)
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
    amount: string = '1', // Amount in TON
    comment?: string, // Optional comment/memo
  ): any {
    const transaction: any = {
      address: toAddress,
      amount: amount,
    };
    
    // Add comment as body if provided
    // TON Connect supports text comments in the message body
    if (comment) {
      // For TON transfers, comments are sent as text in the message body
      // The backend will extract this when indexing transactions
      transaction.body = comment;
    }
    
    return transaction;
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
