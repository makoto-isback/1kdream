import TonConnectSDK from '@tonconnect/sdk';

export interface WalletInfo {
  address: string;
  walletType: string;
  connected: boolean;
}

type StatusChangeCallback = (wallet: { address: string } | null) => void;

class TonConnectService {
  private connector: TonConnectSDK | null = null;
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
      // Create manifest for TON Connect
      const manifest = {
        url: window.location.origin,
        name: '1K Dream',
        iconUrl: `${window.location.origin}/icon.png`,
      };

      this.connector = new TonConnectSDK({
        manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
      });

      // Listen for connection events - this is the ONLY place we read account.address
      this.connector.onStatusChange((wallet) => {
        if (wallet?.account?.address) {
          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: (wallet as any).device?.appName || (wallet as any).provider?.name || 'unknown',
            connected: true,
          };
          this.walletInfo = walletInfo;
          this.saveWalletToStorage(walletInfo);
          
          // Notify all callbacks
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
        this.walletInfo = parsed;
        // Notify callbacks if we have stored wallet info (sync, no initialization)
        if (parsed?.address) {
          this.statusChangeCallbacks.forEach(cb => cb({ address: parsed.address }));
        }
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
    
    // Immediately call with current state if available (from storage, no initialization)
    // This is safe - it only reads cached walletInfo, doesn't trigger ensureInitialized()
    if (this.walletInfo?.address) {
      callback({ address: this.walletInfo.address });
    }
    
    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks = this.statusChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Connect to wallet - this is the ONLY place initialization should happen.
   * Called explicitly by user action (button click), never on mount.
   */
  async connect(): Promise<void> {
    // Initialize only when user explicitly clicks connect
    this.ensureInitialized();

    if (!this.connector) {
      throw new Error('TON Connect not initialized - window not available');
    }

    try {
      // Check if already connected - but don't read account.address here
      if (this.connector.connected) {
        console.log('[TON Connect] Already connected, waiting for onStatusChange');
        // Don't read account.address - let onStatusChange handle it
        return;
      }

      // Get available wallets
      const walletsList = await this.connector.getWallets();
      
      if (walletsList.length === 0) {
        throw new Error('No TON wallets available');
      }

      // For Telegram Mini App, prefer Telegram Wallet
      const telegramWallet = walletsList.find(w => 
        w.name.toLowerCase().includes('telegram') || 
        w.name.toLowerCase().includes('tonkeeper')
      );
      const walletToConnect = telegramWallet || walletsList[0];

      // Connect to wallet
      // Note: This will open the wallet app for connection
      // After connection, onStatusChange will fire with wallet info
      await this.connector.connect(walletToConnect);
      console.log('[TON Connect] connect() triggered');
      // ❗ DO NOT read wallet/account here - onStatusChange will handle it
    } catch (error) {
      console.error('[TON Connect] Connection error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connector) {
      return;
    }

    try {
      if (this.connector.connected) {
        await this.connector.disconnect();
      }
      this.walletInfo = null;
      this.saveWalletToStorage(null);
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

    if (!this.connector || !this.connector.connected) {
      throw new Error('Wallet not connected');
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
