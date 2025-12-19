import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tonConnectService, WalletInfo } from '../services/tonConnect';
import { useClientReady } from '../hooks/useClientReady';

interface WalletContextType {
  walletInfo: WalletInfo | null;
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
  createTonTransferTransaction: (toAddress: string, amount?: string) => any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const isClientReady = useClientReady();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTelegramContext, setIsTelegramContext] = useState<boolean | null>(null);

  // Check for Telegram WebApp context
  useEffect(() => {
    if (!isClientReady) {
      return;
    }

    const checkTelegram = () => {
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
    };

    if (!checkTelegram()) {
      return;
    }

    // Load wallet info from storage on mount (only if Telegram context exists)
    const loadWallet = async () => {
      try {
        const info = tonConnectService.getWalletInfo();
        if (info && tonConnectService.isConnected()) {
          setWalletInfo(info);
        } else {
          setWalletInfo(null);
        }
      } catch (error) {
        console.error('[Wallet Context] Failed to load wallet:', error);
        setWalletInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadWallet();
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
      const info = await tonConnectService.connect();
      setWalletInfo(info);
    } catch (error) {
      console.error('[Wallet Context] Connect error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const disconnect = async () => {
    if (!isClientReady) {
      return;
    }

    try {
      setIsLoading(true);
      await tonConnectService.disconnect();
      setWalletInfo(null);
    } catch (error) {
      console.error('[Wallet Context] Disconnect error:', error);
      throw error;
    } finally {
      setIsLoading(false);
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

  const createTonTransferTransaction = (toAddress: string, amount?: string) => {
    return tonConnectService.createTonTransferTransaction(toAddress, amount);
  };

  const isConnected = !!walletInfo?.connected;
  const walletAddress = walletInfo?.address || null;

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
