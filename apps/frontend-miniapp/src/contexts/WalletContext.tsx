import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tonConnectService } from '../services/tonConnect';
import { useClientReady } from '../hooks/useClientReady';

interface WalletContextType {
  walletInfo: { address: string; walletType: string; connected: boolean } | null;
  isConnected: boolean;
  isWalletConnected: boolean; // Alias for isConnected
  walletAddress: string | null; // Convenience property
  isLoading: boolean;
  isClientReady: boolean;
  isTelegramContext: boolean | null; // null = checking, true = Telegram exists, false = not in Telegram
  connect: () => Promise<void>;
  connectWallet: () => Promise<void>; // Alias for connect
  disconnect: () => Promise<void>;
  signTransaction: (transaction: any) => Promise<string>;
  createUsdtTransferTransaction: (toAddress: string, amount: string) => any;
  createTonTransferTransaction: (toAddress: string, amount?: string, comment?: string) => any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const isClientReady = useClientReady();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string>('unknown');
  const [isConnecting, setIsConnecting] = useState(false); // Separate state for actual connection attempt
  const [isTelegramContext, setIsTelegramContext] = useState<boolean | null>(null);
  const [isTelegramReady, setIsTelegramReady] = useState(false); // Track Telegram.WebApp.ready() state

  /**
   * INVARIANT: Wallet button must NEVER depend on async initialization.
   * Button renders immediately, initialization happens only on user click.
   * 
   * This effect:
   * - Checks Telegram context (sync)
   * - Registers status change listener (sync, no initialization)
   * - Does NOT initialize TON Connect (lazy, on connect() only)
   */
  useEffect(() => {
    if (!isClientReady) {
      return;
    }

    // Defensive: Wrap Telegram checks in try/catch
    const checkTelegram = () => {
      try {
        const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
        const hasTelegram = !!tg;
        setIsTelegramContext(hasTelegram);
        
        if (!hasTelegram) {
          console.warn('[Wallet Context] ⚠️ Telegram WebApp context not found');
          console.warn('[Wallet Context] TON Connect requires Telegram Mini App environment');
          setIsTelegramReady(false);
          return false;
        }
        
        console.log('[Wallet Context] ✅ Telegram WebApp context detected');
        
        // Call ready() but don't wait for it - button renders immediately
        if (typeof tg.ready === 'function') {
          try {
            tg.ready();
            console.log('[Wallet Context] ✅ Telegram.WebApp.ready() called (fire-and-forget)');
          } catch (error) {
            console.warn('[Wallet Context] Telegram.WebApp.ready() failed (non-fatal):', error);
          }
        }
        
        setIsTelegramReady(true);
        return true;
      } catch (error) {
        // Telegram WebView API access failed - log but don't crash
        console.error('[Wallet Context] Telegram check error (non-fatal):', error);
        setIsTelegramContext(false);
        setIsTelegramReady(false);
        return false;
      }
    };

    checkTelegram();

    // CRITICAL: Register status change listener WITHOUT initializing TON Connect
    // This allows wallet state updates without blocking UI
    // Initialization happens lazily when user clicks connect()
    const unsubscribe = tonConnectService.onStatusChange((wallet) => {
      // Add detailed logging to debug connection flow
      console.log('[Wallet Context] 🔔 onStatusChange callback:', {
        hasWallet: !!wallet,
        hasAddress: !!wallet?.address,
        address: wallet?.address,
        isConnecting: isConnecting
      });
      
      if (wallet?.address) {
        console.log('[Wallet Context] ✅ Wallet connected:', wallet.address);
        setWalletAddress(wallet.address);
        // Get wallet type from stored info (doesn't trigger initialization)
        const storedInfo = tonConnectService.getWalletInfo();
        if (storedInfo) {
          setWalletType(storedInfo.walletType);
          console.log('[Wallet Context] Wallet type:', storedInfo.walletType);
        }
        // CRITICAL: Reset connecting state when connection succeeds
        setIsConnecting(false);
        console.log('[Wallet Context] ✅ Connection complete - isConnecting set to false');
      } else {
        console.log('[Wallet Context] ⚠️ Wallet disconnected or no address');
        setWalletAddress(null);
        setWalletType('unknown');
        // CRITICAL: Reset connecting state when connection fails or disconnects
        setIsConnecting(false);
        console.log('[Wallet Context] ⚠️ Connection failed/disconnected - isConnecting set to false');
      }
      // No need to set isLoading here - it's only for connection attempts
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [isClientReady]);

  /**
   * Connect wallet - this is the ONLY place TON Connect initialization happens.
   * Called explicitly by user action (button click), never automatically.
   */
  const connect = async () => {
    if (!isClientReady) {
      throw new Error('Wallet connection not available during SSR');
    }

    if (isTelegramContext === false) {
      throw new Error('TON Connect requires Telegram Mini App. Please open this app from within Telegram.');
    }

    if (isTelegramContext === null) {
      throw new Error('Checking Telegram context... Please wait.');
    }

    // Wait for Telegram to be ready before connecting
    if (!isTelegramReady) {
      throw new Error('Telegram is not ready yet. Please wait a moment and try again.');
    }

    try {
      setIsConnecting(true); // Use separate state for connection attempt
      // This is where TON Connect initializes (lazy, on user action)
      await tonConnectService.connect();
      // ❗ DO NOT read wallet address here - onStatusChange will update state
      console.log('[Wallet Context] Connect triggered, waiting for onStatusChange');
      
      // CRITICAL: Don't reset isConnecting immediately
      // onStatusChange will fire when connection succeeds or fails
      // We'll reset isConnecting in the onStatusChange handler
      // But set a timeout as fallback (in case onStatusChange never fires)
      setTimeout(() => {
        setIsConnecting(false);
      }, 30000); // 30 second timeout - user should have approved by then
    } catch (error) {
      // Log error but rethrow so UI can show error message
      console.error('[Wallet Context] Connect error:', error);
      setIsConnecting(false);
      throw error;
    }
  };

  const disconnect = async () => {
    if (!isClientReady) {
      return;
    }

    try {
      setIsConnecting(true);
      await tonConnectService.disconnect();
      // onStatusChange will update walletAddress to null
    } catch (error) {
      console.error('[Wallet Context] Disconnect error:', error);
      setIsConnecting(false);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const signTransaction = async (transaction: any) => {
    if (!isClientReady) {
      throw new Error('Transaction signing not available during SSR');
    }
    return await tonConnectService.signTransaction(transaction);
  };

  const createUsdtTransferTransaction = (toAddress: string, amount: string) => {
    return tonConnectService.createUsdtTransferTransaction(toAddress, amount);
  };

  const createTonTransferTransaction = (toAddress: string, amount?: string, comment?: string) => {
    return tonConnectService.createTonTransferTransaction(toAddress, amount, comment);
  };

  const isConnected = !!walletAddress;
  const walletInfo = walletAddress ? {
    address: walletAddress,
    walletType,
    connected: true,
  } : null;

  /**
   * INVARIANT: isLoading is ONLY true during user-initiated connection attempts.
   * It is NEVER true on mount, during initialization, or while waiting for async calls.
   * This guarantees the wallet button renders immediately.
   */
  const isLoading = isConnecting;

  return (
    <WalletContext.Provider
      value={{
        walletInfo,
        isConnected,
        isWalletConnected: isConnected, // Alias
        walletAddress, // Convenience property
        isLoading, // Only true during connect/disconnect, not initialization
        isClientReady,
        isTelegramContext, // Expose Telegram context check
        connect,
        connectWallet: connect, // Alias
        disconnect,
        signTransaction,
        createUsdtTransferTransaction,
        createTonTransferTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
