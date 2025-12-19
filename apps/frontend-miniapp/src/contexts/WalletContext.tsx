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

  useEffect(() => {
    // Only load wallet info on client-side
    if (!isClientReady) {
      return;
    }

    // Load wallet info from storage on mount
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
