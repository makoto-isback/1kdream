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

  // Lazy initialization - only when window and Telegram WebApp are available
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

    try {
      this.initializeConnector();
      this.loadWalletFromStorage();
      this.initialized = true;
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
        // Fallback to inline manifest if URL fails
        manifest: manifest as any,
      });

      // Listen for connection events - this is the ONLY place we read account.address
      this.connector.onStatusChange((wallet) => {
        if (wallet?.account?.address) {
          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: wallet.account.walletAppName || 'unknown',
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

  private loadWalletFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.walletInfo = parsed;
        // Notify callbacks if we have stored wallet info
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

  // Register callback for status changes
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.push(callback);
    
    // Immediately call with current state if available
    if (this.walletInfo?.address) {
      callback({ address: this.walletInfo.address });
    }
    
    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks = this.statusChangeCallbacks.filter(cb => cb !== callback);
    };
  }

  async connect(): Promise<void> {
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
      const connectionSource = {
        universalLink: walletToConnect.universalLink,
        bridgeUrl: walletToConnect.bridgeUrl,
      };

      await this.connector.connect(connectionSource);
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

  getWalletInfo(): WalletInfo | null {
    if (typeof window === 'undefined') {
      return null;
    }
    this.ensureInitialized();
    return this.walletInfo;
  }

  isConnected(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    this.ensureInitialized();
    return this.connector?.connected || false;
  }

  async sendTransaction(transaction: any): Promise<string> {
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
