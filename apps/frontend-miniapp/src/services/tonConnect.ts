import TonConnectSDK from '@tonconnect/sdk';

export interface WalletInfo {
  address: string;
  walletType: string;
  connected: boolean;
}

class TonConnectService {
  private connector: TonConnectSDK | null = null;
  private walletInfo: WalletInfo | null = null;
  private readonly STORAGE_KEY = 'ton_wallet_info';
  private initialized: boolean = false;

  // Lazy initialization - only when window is available
  private ensureInitialized(): void {
    if (this.initialized || typeof window === 'undefined') {
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

      // Listen for connection events
      this.connector.onStatusChange((wallet) => {
        if (wallet) {
          const walletInfo: WalletInfo = {
            address: wallet.account.address,
            walletType: wallet.account.walletAppName || 'unknown',
            connected: true,
          };
          this.walletInfo = walletInfo;
          this.saveWalletToStorage(walletInfo);
        } else {
          this.walletInfo = null;
          this.saveWalletToStorage(null);
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
        this.walletInfo = JSON.parse(stored);
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

  async connect(): Promise<WalletInfo> {
    this.ensureInitialized();

    if (!this.connector) {
      throw new Error('TON Connect not initialized - window not available');
    }

    try {
      // Check if already connected
      if (this.connector.connected) {
        const account = this.connector.account!;
        const walletInfo: WalletInfo = {
          address: account.address,
          walletType: account.walletAppName || 'unknown',
          connected: true,
        };
        this.walletInfo = walletInfo;
        this.saveWalletToStorage(walletInfo);
        return walletInfo;
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
      // After first connection, subsequent transactions can be signed silently if wallet supports it
      const connectionSource = {
        universalLink: walletToConnect.universalLink,
        bridgeUrl: walletToConnect.bridgeUrl,
      };

      await this.connector.connect(connectionSource);

      // Get account info after connection
      const account = this.connector.account!;
      const walletInfo: WalletInfo = {
        address: account.address,
        walletType: account.walletAppName || walletToConnect.name,
        connected: true,
      };

      this.walletInfo = walletInfo;
      this.saveWalletToStorage(walletInfo);
      return walletInfo;
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

  async signTransaction(transaction: any): Promise<string> {
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

  // Helper to create 1 TON transfer transaction (for activation fee)
  createTonTransferTransaction(
    toAddress: string,
    amount: string = '1', // 1 TON
  ): any {
    return {
      address: toAddress,
      amount: amount,
    };
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
