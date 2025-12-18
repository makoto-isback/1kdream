import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { tonConnectService, WalletInfo } from '../services/tonConnect';

interface WalletContextType {
  walletInfo: WalletInfo | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: any) => Promise<string>;
  createUsdtTransferTransaction: (toAddress: string, amount: string) => any;
  createTonTransferTransaction: (toAddress: string, amount?: string) => any;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const connect = async () => {
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

  const signTransaction = async (transaction: any): Promise<string> => {
    return await tonConnectService.signTransaction(transaction);
  };

  const createUsdtTransferTransaction = (toAddress: string, amount: string) => {
    return tonConnectService.createUsdtTransferTransaction(toAddress, amount);
  };

  const createTonTransferTransaction = (toAddress: string, amount?: string) => {
    return tonConnectService.createTonTransferTransaction(toAddress, amount);
  };

  return (
    <WalletContext.Provider
      value={{
        walletInfo,
        isConnected: !!walletInfo?.connected,
        isLoading,
        connect,
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

