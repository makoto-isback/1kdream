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
  const [isLoading, setIsLoading] = useState(true);
  const [isTelegramContext, setIsTelegramContext] = useState<boolean | null>(null);

  // Check for Telegram WebApp context - isolated to useEffect, never during render
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
          console.warn('[Wallet Context] Open this app from within Telegram to use wallet features');
          setIsLoading(false);
          return false;
        }
        
        console.log('[Wallet Context] ✅ Telegram WebApp context detected');
        return true;
      } catch (error) {
        // Telegram WebView API access failed - log but don't crash
        console.error('[Wallet Context] Telegram check error (non-fatal):', error);
        setIsTelegramContext(false);
        setIsLoading(false);
        return false;
      }
    };

    if (!checkTelegram()) {
      return;
    }

    // Listen to TON Connect status changes - this is the ONLY way to get wallet address
    const unsubscribe = tonConnectService.onStatusChange((wallet) => {
      if (wallet?.address) {
        console.log('[WALLET CONNECT] connected:', wallet.address);
        setWalletAddress(wallet.address);
        // Get wallet type from stored info
        const storedInfo = tonConnectService.getWalletInfo();
        if (storedInfo) {
          setWalletType(storedInfo.walletType);
        }
      } else {
        setWalletAddress(null);
        setWalletType('unknown');
      }
      setIsLoading(false);
    });

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [isClientReady]);

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

    try {
      setIsLoading(true);
      await tonConnectService.connect();
      // ❗ DO NOT read wallet address here - onStatusChange will update state
      console.log('[Wallet Context] Connect triggered, waiting for onStatusChange');
    } catch (error) {
      // Log error but rethrow so UI can show error message
      console.error('[Wallet Context] Connect error:', error);
      setIsLoading(false);
      throw error;
    }
  };

  const disconnect = async () => {
    if (!isClientReady) {
      return;
    }

    try {
      setIsLoading(true);
      await tonConnectService.disconnect();
      // onStatusChange will update walletAddress to null
    } catch (error) {
      console.error('[Wallet Context] Disconnect error:', error);
      setIsLoading(false);
      throw error;
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

  return (
    <WalletContext.Provider
      value={{
        walletInfo,
        isConnected,
        isWalletConnected: isConnected, // Alias
        walletAddress, // Convenience property
        isLoading,
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
