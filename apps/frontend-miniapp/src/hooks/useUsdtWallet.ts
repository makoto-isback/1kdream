import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useAuth } from '../contexts/AuthContext';
import { activationService, ActivationStatus } from '../services/activation';
import { usdtDepositService, UsdtDeposit } from '../services/usdtDeposit';
import { usdtWithdrawalService, UsdtWithdrawal } from '../services/usdtWithdrawal';
import { socketService } from '../services/socket';

const KYAT_PER_USDT = 5000;

export interface UsdtWalletState {
  // Wallet connection
  isWalletConnected: boolean;
  walletAddress: string | null;
  
  // Activation
  isActivated: boolean;
  activationLoading: boolean;
  
  // Deposits
  deposits: UsdtDeposit[];
  depositLoading: boolean;
  
  // Withdrawals
  withdrawals: UsdtWithdrawal[];
  withdrawalLoading: boolean;
  
  // Actions
  connectWallet: () => Promise<void>;
  checkActivation: () => Promise<void>;
  createDeposit: (kyatAmount: number, txHash: string) => Promise<void>;
  createWithdrawal: (kyatAmount: number, tonAddress: string) => Promise<void>;
  refreshDeposits: () => Promise<void>;
  refreshWithdrawals: () => Promise<void>;
}

export const useUsdtWallet = (): UsdtWalletState => {
  const { walletInfo, isConnected, connect: connectWalletFn, isLoading: walletLoading } = useWallet();
  const { user, refreshUser } = useAuth();
  
  const [activationStatus, setActivationStatus] = useState<ActivationStatus | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);
  const [deposits, setDeposits] = useState<UsdtDeposit[]>([]);
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawals, setWithdrawals] = useState<UsdtWithdrawal[]>([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // Check activation status
  const checkActivation = useCallback(async () => {
    if (!user) return;
    
    try {
      setActivationLoading(true);
      const status = await activationService.getStatus();
      setActivationStatus(status);
    } catch (error) {
      console.error('[USDT Wallet] Error checking activation:', error);
    } finally {
      setActivationLoading(false);
    }
  }, [user]);

  // Load deposits
  const refreshDeposits = useCallback(async () => {
    if (!user) return;
    
    try {
      setDepositLoading(true);
      const data = await usdtDepositService.getMyDeposits();
      setDeposits(data);
    } catch (error) {
      console.error('[USDT Wallet] Error loading deposits:', error);
    } finally {
      setDepositLoading(false);
    }
  }, [user]);

  // Load withdrawals
  const refreshWithdrawals = useCallback(async () => {
    if (!user) return;
    
    try {
      setWithdrawalLoading(true);
      const data = await usdtWithdrawalService.getMyWithdrawals();
      setWithdrawals(data);
    } catch (error) {
      console.error('[USDT Wallet] Error loading withdrawals:', error);
    } finally {
      setWithdrawalLoading(false);
    }
  }, [user]);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      await connectWalletFn();
    } catch (error) {
      console.error('[USDT Wallet] Error connecting wallet:', error);
      throw error;
    }
  }, [connectWalletFn]);

  // Create deposit
  const createDeposit = useCallback(async (kyatAmount: number, txHash: string) => {
    if (!walletInfo?.address) {
      throw new Error('Wallet not connected');
    }
    
    try {
      await usdtDepositService.createDeposit({
        txHash,
        kyatAmount,
        walletAddress: walletInfo.address,
      });
      
      // Refresh deposits and user balance
      await Promise.all([refreshDeposits(), refreshUser()]);
    } catch (error) {
      console.error('[USDT Wallet] Error creating deposit:', error);
      throw error;
    }
  }, [walletInfo, refreshDeposits, refreshUser]);

  // Create withdrawal
  const createWithdrawal = useCallback(async (kyatAmount: number, tonAddress: string) => {
    try {
      await usdtWithdrawalService.createWithdrawal({
        kyatAmount,
        tonAddress,
      });
      
      // Refresh withdrawals and user balance
      await Promise.all([refreshWithdrawals(), refreshUser()]);
    } catch (error) {
      console.error('[USDT Wallet] Error creating withdrawal:', error);
      throw error;
    }
  }, [refreshWithdrawals, refreshUser]);

  // Load initial data
  useEffect(() => {
    if (user) {
      checkActivation();
      refreshDeposits();
      refreshWithdrawals();
    }
  }, [user, checkActivation, refreshDeposits, refreshWithdrawals]);

  // Socket event listeners
  useEffect(() => {
    if (!user) return;

    const unsubscribeDeposit = socketService.onUsdtDepositConfirmed((data) => {
      console.log('[USDT Wallet] Deposit confirmed:', data);
      refreshDeposits();
      refreshUser();
    });

    const unsubscribeWithdrawalCreated = socketService.onUsdtWithdrawalCreated((data) => {
      console.log('[USDT Wallet] Withdrawal created:', data);
      refreshWithdrawals();
    });

    const unsubscribeWithdrawalSent = socketService.onUsdtWithdrawalSent((data) => {
      console.log('[USDT Wallet] Withdrawal sent:', data);
      refreshWithdrawals();
    });

    return () => {
      unsubscribeDeposit();
      unsubscribeWithdrawalCreated();
      unsubscribeWithdrawalSent();
    };
  }, [user, refreshDeposits, refreshWithdrawals, refreshUser]);

  return {
    isWalletConnected: isConnected,
    walletAddress: walletInfo?.address || null,
    isActivated: activationStatus?.isActivated || false,
    activationLoading,
    deposits,
    depositLoading,
    withdrawals,
    withdrawalLoading,
    connectWallet,
    checkActivation,
    createDeposit,
    createWithdrawal,
    refreshDeposits,
    refreshWithdrawals,
  };
};

/**
 * Helper to convert KYAT to USDT
 */
export const kyatToUsdt = (kyat: number): number => {
  return kyat / KYAT_PER_USDT;
};

/**
 * Helper to convert USDT to KYAT
 */
export const usdtToKyat = (usdt: number): number => {
  return usdt * KYAT_PER_USDT;
};

/**
 * Helper to calculate time remaining until withdrawal execution
 */
export const getWithdrawalTimeRemaining = (executeAfter: string): number => {
  const executeTime = new Date(executeAfter).getTime();
  const now = Date.now();
  const remaining = executeTime - now;
  return Math.max(0, Math.floor(remaining / 1000)); // Return seconds
};

/**
 * Helper to format countdown timer
 */
export const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return '00:00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

