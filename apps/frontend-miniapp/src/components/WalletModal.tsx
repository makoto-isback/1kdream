import React, { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { Language, WalletTab } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';
import { User } from '../services/users';
import { useWallet } from '../contexts/WalletContext';
import { TON_TREASURY_ADDRESS, USDT_TREASURY_ADDRESS } from '../constants/treasury';
import { walletService } from '../services/wallet';
import { KBZPayLogo, WaveMoneyLogo } from './PaymentLogos';

// Exchange rate constant
const KYAT_PER_USDT = 5000;

// Fetch TON price from CoinGecko API
async function fetchTonPriceUsd(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
    );
    if (!response.ok) {
      throw new Error('Failed to fetch TON price');
    }
    const data = await response.json();
    const price = data['the-open-network']?.usd;
    if (typeof price !== 'number' || price <= 0) {
      throw new Error('Invalid TON price received');
    }
    console.log('[TON Price] Fetched:', price, 'USD');
    return price;
  } catch (error) {
    console.error('[TON Price] Failed to fetch:', error);
    // Fallback to a reasonable default (will be updated when API is available)
    return 5.5; // ~$5.50 as fallback
  }
}

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  user: User | null;
  onRefresh: () => Promise<void>;
}

export const WalletModal: React.FC<Props> = ({ language, isOpen, onClose, balance, user, onRefresh }) => {
  // Debug: log user state on every render
  console.log('[WALLET MODAL] User state:', { hasUser: !!user, userId: user?.id, balance });
  
  // Wallet context
  const {
    isWalletConnected,
    walletAddress,
    connectWallet,
    isLoading: walletLoading,
    isTelegramContext,
    signTransaction,
    createUsdtTransferTransaction,
    createTonTransferTransaction,
  } = useWallet();

  const [activeTab, setActiveTab] = useState<WalletTab>(WalletTab.BALANCE);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositUsdtAmount, setDepositUsdtAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawUsdtAmount, setWithdrawUsdtAmount] = useState<string>('');
  const [tonAddress, setTonAddress] = useState<string>('');
  
  // Deposit transaction state
  const [isSendingTx, setIsSendingTx] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'TON' | 'USDT' | null>(null);
  
  // Withdraw transaction state (separate from deposit)
  const [isSendingWithdrawTx, setIsSendingWithdrawTx] = useState(false);
  const [withdrawTxError, setWithdrawTxError] = useState<string | null>(null);
  const [withdrawTxSuccess, setWithdrawTxSuccess] = useState(false);
  
  // Withdrawal status tracking
  const [userWithdrawals, setUserWithdrawals] = useState<any[]>([]);
  const [countdownTime, setCountdownTime] = useState<{ [key: string]: number }>({});

  // TON price state for deposit calculations
  const [tonPriceUsd, setTonPriceUsd] = useState<number>(5.5); // Default fallback
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);

  // Define loadUserWithdrawals before useEffect
  const loadUserWithdrawals = React.useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const withdrawals = await walletService.getUserWithdrawals();
      setUserWithdrawals(withdrawals || []);
    } catch (error) {
      console.error('[WALLET MODAL] Failed to load withdrawals:', error);
      // Don't throw - just log the error
    }
  }, [user?.id]);

  // Fetch TON price on mount and when deposit tab is active
  useEffect(() => {
    if (isOpen && activeTab === WalletTab.DEPOSIT) {
      setIsFetchingPrice(true);
      fetchTonPriceUsd()
        .then(price => setTonPriceUsd(price))
        .finally(() => setIsFetchingPrice(false));
    }
  }, [isOpen, activeTab]);

  // NO HTTP FETCHES - Wallet UI is purely passive and socket-driven
  // Withdrawals come from UserDataSync subscriptions (if needed)
  // Removed: loadUserWithdrawals() and polling interval

  // Update countdown timer every second for pending withdrawals
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newCountdowns: { [key: string]: number } = {};
      
      userWithdrawals.forEach((withdrawal) => {
        if (withdrawal.status === 'pending' && withdrawal.requestTime) {
          const requestTime = new Date(withdrawal.requestTime).getTime();
          const elapsed = now - requestTime;
          const oneHour = 60 * 60 * 1000;
          const remaining = Math.max(0, oneHour - elapsed);
          newCountdowns[withdrawal.id] = remaining;
        }
      });
      
      setCountdownTime(newCountdowns);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [userWithdrawals]);

  const formatCountdown = (remaining: number): string => {
    if (remaining <= 0) {
      return language === 'my' ? 'Ready to process' : 'Ready to process';
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getWithdrawalStatusDisplay = (withdrawal: any) => {
    if (withdrawal.status === 'completed') {
      return {
        text: language === 'my' ? 'Completed' : 'Completed',
        color: 'text-ios-green',
        bg: 'bg-ios-green/10',
        border: 'border-ios-green/20'
      };
    }
    if (withdrawal.status === 'processing') {
      return {
        text: language === 'my' ? 'Processing...' : 'Processing...',
        color: 'text-ios-blue',
        bg: 'bg-ios-blue/10',
        border: 'border-ios-blue/20'
      };
    }
    if (withdrawal.status === 'rejected') {
      return {
        text: language === 'my' ? 'Rejected' : 'Rejected',
        color: 'text-ios-red',
        bg: 'bg-ios-red/10',
        border: 'border-ios-red/20'
      };
    }
    
    // Pending status
    const remaining = countdownTime[withdrawal.id] ?? 0;
    const isReady = remaining <= 0;
    
    return {
      text: isReady 
        ? (language === 'my' ? 'Ready to process' : 'Ready to process')
        : `${language === 'my' ? 'Processing in' : 'Processing in'}: ${formatCountdown(remaining)}`,
      color: isReady ? 'text-ios-yellow' : 'text-ios-label-secondary',
      bg: isReady ? 'bg-ios-yellow/10' : 'bg-ios-gray5',
      border: isReady ? 'border-ios-yellow/20' : 'border-white/5'
    };
  };

  // Contact Support helper
  const handleContactSupport = () => {
    const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
    if (tg) {
      // Use Telegram Mini App method
      tg.openTelegramLink('https://t.me/onekadmin');
    } else {
      // Fallback for non-Telegram environments
      window.open('https://t.me/onekadmin', '_blank');
    }
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      setTxError(null);
      await connectWallet();
      console.log('[WALLET CONNECT] connected');
    } catch (error: any) {
      console.error('[WALLET CONNECT] connection failed:', error);
      setTxError(error?.message || (language === 'my' ? 'Wallet ချိတ်ဆက်မှု မအောင်မြင်ပါ' : 'Failed to connect wallet'));
    }
  };

  // Handle withdraw request - calls API directly (no TON transaction needed)
  const handleRequestWithdraw = async () => {
    if (!user?.id) {
      setWithdrawTxError(language === 'my' ? 'User ID မရှိပါ' : 'User ID not found');
      return;
    }

    const kyatAmount = parseFloat(withdrawAmount);
    const destinationAddress = user.tonAddress || tonAddress;

    // Validation
    if (!withdrawAmount || kyatAmount <= 0) {
      setWithdrawTxError(language === 'my' ? 'ပမာဏ ထည့်သွင်းပါ' : 'Please enter amount');
      return;
    }

    if (kyatAmount < 10000) {
      setWithdrawTxError(language === 'my' ? 'အနည်းဆုံး 10,000 KYAT လိုအပ်ပါသည်' : 'Minimum withdrawal is 10,000 KYAT');
      return;
    }

    if (kyatAmount > 5000000) {
      setWithdrawTxError(language === 'my' ? 'အများဆုံး 5,000,000 KYAT ဖြစ်ပါသည်' : 'Maximum withdrawal is 5,000,000 KYAT');
      return;
    }

    if (!destinationAddress || destinationAddress.trim() === '') {
      setWithdrawTxError(language === 'my' ? 'TON လိပ်စာ ထည့်သွင်းပါ' : 'Please enter TON address');
      return;
    }

    try {
      setIsSendingWithdrawTx(true);
      setWithdrawTxError(null);
      setWithdrawTxSuccess(false);

      console.log('[WITHDRAW] request started', { userId: user.id, kyatAmount, destinationAddress });

      // Call API to create withdrawal request
      // No TON transaction needed - balance is deducted immediately
      // Funds will be sent after 1 hour delay
      
      const withdrawal = await walletService.createWithdrawalRequest({
        kyatAmount,
        tonAddress: destinationAddress.trim(),
      });

      console.log('[WITHDRAW] request created', withdrawal);

      setWithdrawTxSuccess(true);
      setWithdrawTxError(null);
      
      // Clear form after successful send
      setWithdrawAmount('');
      setWithdrawUsdtAmount('');
      setTonAddress('');
      
      // Refresh withdrawals list and user balance
      await loadUserWithdrawals();
      await onRefresh();
    } catch (error: any) {
      console.error('[WITHDRAW] request failed', error);
      setWithdrawTxError(error?.message || (language === 'my' ? 'Withdraw request ပို့ဆောင်မှု မအောင်မြင်ပါ' : 'Withdraw request failed'));
      setWithdrawTxSuccess(false);
    } finally {
      setIsSendingWithdrawTx(false);
    }
  };

  // Handle deposit transaction
  const handleSendDeposit = async (asset: 'TON' | 'USDT') => {
    // Debug: log user object to diagnose "User ID not found" issue
    console.log('[DEPOSIT] User object:', user, 'ID:', user?.id);
    
    if (!user?.id) {
      console.error('[DEPOSIT] User ID missing. Full user object:', JSON.stringify(user));
      setTxError(language === 'my' ? 'User ID မရှိပါ - ပြန်လည် Login ဝင်ပါ' : 'User ID not found - please re-login');
      return;
    }

    // For TON deposits: convert KYAT -> USDT -> TON
    // For USDT deposits: use USDT amount directly
    let sendAmount: string;
    
    if (asset === 'TON') {
      const kyatAmount = parseFloat(depositAmount);
      if (!depositAmount || isNaN(kyatAmount) || kyatAmount <= 0) {
        setTxError(language === 'my' ? 'ပမာဏ ထည့်သွင်းပါ' : 'Please enter amount');
        return;
      }
      // Convert KYAT -> USDT -> TON
      const usdtAmount = kyatAmount / KYAT_PER_USDT;
      const tonAmount = usdtAmount / tonPriceUsd;
      // Round to 9 decimals (nanoTON precision)
      sendAmount = tonAmount.toFixed(9);
      console.log('[DEPOSIT] Amount conversion:', { 
        kyatAmount, 
        usdtAmount, 
        tonPriceUsd, 
        tonAmount: sendAmount 
      });
    } else {
      // USDT deposit - use USDT amount directly
      if (!depositUsdtAmount || parseFloat(depositUsdtAmount) <= 0) {
        setTxError(language === 'my' ? 'ပမာဏ ထည့်သွင်းပါ' : 'Please enter amount');
        return;
      }
      sendAmount = depositUsdtAmount;
    }

    try {
      setIsSendingTx(true);
      setTxError(null);
      setTxSuccess(false);
      setSelectedAsset(asset);

      console.log('[DEPOSIT] sending tx', { asset, sendAmount, userId: user.id });

      let transaction;
      const memo = `deposit:${user.id}`;

      if (asset === 'TON') {
        // Create TON transfer with comment/memo
        // sendAmount is now the correct TON amount (converted from KYAT)
        transaction = await createTonTransferTransaction(TON_TREASURY_ADDRESS, sendAmount, memo);
      } else {
        // Create USDT jetton transfer
        transaction = createUsdtTransferTransaction(USDT_TREASURY_ADDRESS, sendAmount);
        // Note: USDT jetton transfers may need memo in payload - backend will handle verification
      }

      // Sign and send transaction
      await signTransaction(transaction);

      console.log('[DEPOSIT] tx sent');
      setTxSuccess(true);
      setTxError(null);
      
      // Clear amounts after successful send
      setTimeout(() => {
        setDepositAmount('');
        setDepositUsdtAmount('');
        setTxSuccess(false);
        setSelectedAsset(null);
      }, 5000);
    } catch (error: any) {
      console.error('[DEPOSIT] tx failed', error);
      setTxError(error?.message || (language === 'my' ? 'Transaction ပို့ဆောင်မှု မအောင်မြင်ပါ' : 'Transaction failed'));
      setTxSuccess(false);
    } finally {
      setIsSendingTx(false);
    }
  };

  // Sync USDT amount when KYAT changes (deposit)
  React.useEffect(() => {
    if (depositAmount) {
      const amount = parseFloat(depositAmount);
      if (!isNaN(amount) && amount > 0) {
        setDepositUsdtAmount((amount / 5000).toFixed(6));
      } else {
        setDepositUsdtAmount('');
      }
    } else {
      setDepositUsdtAmount('');
    }
  }, [depositAmount]);

  // Sync KYAT amount when USDT changes (deposit)
  React.useEffect(() => {
    if (depositUsdtAmount) {
      const amount = parseFloat(depositUsdtAmount);
      if (!isNaN(amount) && amount > 0) {
        setDepositAmount((amount * 5000).toFixed(0));
      } else {
        setDepositAmount('');
      }
    } else {
      setDepositAmount('');
    }
  }, [depositUsdtAmount]);

  // Sync USDT amount when KYAT changes (withdraw)
  React.useEffect(() => {
    if (withdrawAmount) {
      const amount = parseFloat(withdrawAmount);
      if (!isNaN(amount) && amount > 0) {
        setWithdrawUsdtAmount((amount / 5000).toFixed(6));
      } else {
        setWithdrawUsdtAmount('');
      }
    } else {
      setWithdrawUsdtAmount('');
    }
  }, [withdrawAmount]);

  // Sync KYAT amount when USDT changes (withdraw)
  React.useEffect(() => {
    if (withdrawUsdtAmount) {
      const amount = parseFloat(withdrawUsdtAmount);
      if (!isNaN(amount) && amount > 0) {
        setWithdrawAmount((amount * 5000).toFixed(0));
      } else {
        setWithdrawAmount('');
      }
    } else {
      setWithdrawAmount('');
    }
  }, [withdrawUsdtAmount]);

  if (!isOpen) return null;

  const renderContent = () => {
    switch(activeTab) {
        case WalletTab.DEPOSIT:
            return (
                <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-ios-gray5 border border-white/5 space-y-3">
                        <div>
                            <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
                                {language === 'my' ? 'ပမာဏ (KYAT)' : 'Amount (KYAT)'}
                            </label>
                            <input
                                type="number"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                placeholder="1000"
                                min="0"
                                disabled={isSendingTx}
                                className="w-full bg-ios-gray4 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50"
                            />
                            {depositAmount && parseFloat(depositAmount) > 0 && (
                                <div className="text-[12px] text-ios-label-secondary mt-2 space-y-1">
                                    <p>= {depositUsdtAmount} USDT</p>
                                    <p className="text-ios-blue">
                                        ≈ {(parseFloat(depositAmount) / KYAT_PER_USDT / tonPriceUsd).toFixed(6)} TON
                                        {isFetchingPrice && ' (loading...)'}
                                    </p>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
                                {language === 'my' ? 'ပမာဏ (USDT)' : 'Amount (USDT)'}
                            </label>
                            <input
                                type="number"
                                value={depositUsdtAmount}
                                onChange={(e) => setDepositUsdtAmount(e.target.value)}
                                placeholder="0.2"
                                min="0"
                                step="0.000001"
                                disabled={isSendingTx}
                                className="w-full bg-ios-gray4 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50"
                            />
                            {depositUsdtAmount && (
                                <p className="text-[12px] text-ios-label-secondary mt-2">
                                    = {depositAmount} KYAT
                                </p>
                            )}
                        </div>
                        <div className="pt-2 border-t border-white/5 space-y-1">
                            <p className="text-[10px] text-ios-label-secondary text-center">
                                {language === 'my' 
                                  ? 'ပမာဏ ထည့်သွင်းပြီး wallet ချိတ်ဆက်ပါ' 
                                  : 'Enter amount and connect wallet'}
                            </p>
                            <p className="text-[10px] text-ios-label-tertiary text-center">
                                1 TON ≈ ${tonPriceUsd.toFixed(2)} USD
                            </p>
                        </div>
                    </div>

                    {/* Wallet Connection / Send Buttons */}
                    {!isWalletConnected ? (
                        <button 
                            onClick={handleConnectWallet}
                            disabled={walletLoading || isSendingTx}
                            className="w-full py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {walletLoading ? TRANSLATIONS.loading[language] : (language === 'my' ? 'Wallet ချိတ်ဆက်ရန်' : 'Connect Wallet')}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            {walletAddress && (
                                <div className="p-2 rounded-lg bg-ios-gray4 text-[11px] text-ios-label-secondary text-center font-mono">
                                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                </div>
                            )}
                            {depositAmount && parseFloat(depositAmount) > 0 && (
                                <button 
                                    onClick={() => handleSendDeposit('TON')}
                                    disabled={isSendingTx || isFetchingPrice}
                                    className="w-full py-3.5 bg-ios-blue text-white font-semibold rounded-xl hover:bg-ios-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSendingTx && selectedAsset === 'TON' 
                                      ? TRANSLATIONS.loading[language] 
                                      : `${language === 'my' ? 'TON ပို့ရန်' : 'Send'} ${(parseFloat(depositAmount) / KYAT_PER_USDT / tonPriceUsd).toFixed(6)} TON`}
                                </button>
                            )}
                            {depositUsdtAmount && parseFloat(depositUsdtAmount) > 0 && (
                                <button 
                                    onClick={() => handleSendDeposit('USDT')}
                                    disabled={isSendingTx}
                                    className="w-full py-3.5 bg-ios-green text-white font-semibold rounded-xl hover:bg-ios-green/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSendingTx && selectedAsset === 'USDT' ? TRANSLATIONS.loading[language] : (language === 'my' ? 'USDT ပို့ရန်' : 'Send USDT')}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {txError && (
                        <div className="p-3 rounded-xl bg-ios-red/10 border border-ios-red/20">
                            <p className="text-[13px] text-ios-red">{txError}</p>
                        </div>
                    )}

                    {/* Success Message */}
                    {txSuccess && (
                        <div className="p-3 rounded-xl bg-ios-green/10 border border-ios-green/20">
                            <p className="text-[13px] text-ios-green">
                                {language === 'my' 
                                  ? 'Transaction ပို့ပြီးပါပြီ။ Balance အတည်ပြုပြီးနောက် update ဖြစ်ပါမည်။' 
                                  : 'Transaction sent. Balance will update after confirmation.'}
                            </p>
                        </div>
                    )}

                    {/* Contact Support Button */}
                    <button 
                      onClick={handleContactSupport}
                      className="w-full p-4 rounded-xl bg-ios-gray5 flex items-center justify-between group hover:bg-ios-gray4 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-white font-medium text-[15px]">{TRANSLATIONS.contact_support[language]}</span>
                            <div className="flex items-center gap-2">
                                <KBZPayLogo size={20} />
                                <WaveMoneyLogo size={20} />
                            </div>
                        </div>
                        <Icons.User className="text-ios-blue" size={20} />
                    </button>
                </div>
            )
        case WalletTab.WITHDRAW:
             return (
                <div className="space-y-3">
                    <div className="text-center py-4">
                        <p className="text-ios-label-secondary text-sm mb-1">
                            {language === 'my' ? 'ငွေထုတ်ယူနိုင်သော ပမာဏ' : 'Available for withdrawal'}
                        </p>
                        <h3 className="text-3xl font-bold text-white tracking-tight mb-2">{balance.toLocaleString()} Ks</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-ios-gray5 border border-white/5 space-y-3">
                        {!user?.tonAddress && (
                            <div>
                                <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
                                    {language === 'my' ? 'TON လိပ်စာ' : 'TON Address'}
                                </label>
                                <input
                                    type="text"
                                    value={tonAddress}
                                    onChange={(e) => setTonAddress(e.target.value)}
                                    placeholder={language === 'my' ? 'TON လိပ်စာထည့်သွင်းပါ' : 'Enter TON address'}
                                    disabled={isSendingWithdrawTx}
                                    className="w-full bg-ios-gray4 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-sm transition-all disabled:opacity-50"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
                                {language === 'my' ? 'ပမာဏ (KYAT)' : 'Amount (KYAT)'}
                            </label>
                            <input
                                type="number"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                placeholder="10000"
                                min="10000"
                                max="5000000"
                                disabled={isSendingWithdrawTx}
                                className="w-full bg-ios-gray4 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50"
                            />
                            {withdrawAmount && (
                                <p className="text-[12px] text-ios-label-secondary mt-2">
                                    = {withdrawUsdtAmount} USDT
                                </p>
                            )}
                            <p className="text-[10px] text-ios-label-secondary mt-1">
                                {language === 'my' 
                                  ? 'အနည်းဆုံး 10,000 KYAT၊ အများဆုံး 5,000,000 KYAT' 
                                  : 'Min: 10,000 KYAT, Max: 5,000,000 KYAT'}
                            </p>
                        </div>
                        <div>
                            <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
                                {language === 'my' ? 'ပမာဏ (USDT)' : 'Amount (USDT)'}
                            </label>
                            <input
                                type="number"
                                value={withdrawUsdtAmount}
                                onChange={(e) => setWithdrawUsdtAmount(e.target.value)}
                                placeholder="2.0"
                                min="2"
                                max="1000"
                                step="0.000001"
                                disabled={isSendingWithdrawTx}
                                className="w-full bg-ios-gray4 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50"
                            />
                            {withdrawUsdtAmount && (
                                <p className="text-[12px] text-ios-label-secondary mt-2">
                                    = {withdrawAmount} KYAT
                                </p>
                            )}
                        </div>
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-[10px] text-ios-label-secondary text-center">
                                {language === 'my' 
                                  ? 'Withdraw request ပို့ပြီးနောက် 1 နာရီအတွင်း process လုပ်ပါမည်' 
                                  : 'Withdraw requests are processed within 1 hour'}
                            </p>
                        </div>
                    </div>

                    {/* Wallet Connection / Request Withdraw Button */}
                    {!isWalletConnected ? (
                        <button 
                            onClick={handleConnectWallet}
                            disabled={walletLoading || isSendingWithdrawTx}
                            className="w-full py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {walletLoading ? TRANSLATIONS.loading[language] : (language === 'my' ? 'Wallet ချိတ်ဆက်ရန်' : 'Connect Wallet')}
                        </button>
                    ) : (
                        <button 
                            onClick={handleRequestWithdraw}
                            disabled={
                                isSendingWithdrawTx || 
                                !withdrawAmount || 
                                parseFloat(withdrawAmount) < 10000 || 
                                parseFloat(withdrawAmount) > 5000000 ||
                                (!user?.tonAddress && !tonAddress)
                            }
                            className="w-full py-3.5 bg-ios-red text-white font-semibold rounded-xl hover:bg-ios-red/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSendingWithdrawTx ? TRANSLATIONS.loading[language] : (language === 'my' ? 'Withdraw Request ပို့ရန်' : 'Request Withdraw')}
                        </button>
                    )}

                    {/* Withdraw Error Message */}
                    {withdrawTxError && (
                        <div className="p-3 rounded-xl bg-ios-red/10 border border-ios-red/20">
                            <p className="text-[13px] text-ios-red">{withdrawTxError}</p>
                        </div>
                    )}

                    {/* Withdraw Success Message */}
                    {withdrawTxSuccess && (
                        <div className="p-3 rounded-xl bg-ios-green/10 border border-ios-green/20">
                            <p className="text-[13px] text-ios-green">
                                {language === 'my' 
                                  ? 'Withdraw request ပို့ပြီးပါပြီ။ 1 နာရီအတွင်း process လုပ်ပါမည်။' 
                                  : 'Withdraw request submitted. Funds will be processed within 1 hour.'}
                            </p>
                        </div>
                    )}

                    {/* Withdrawal Status List - Show only most recent */}
                    {userWithdrawals.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-[13px] font-semibold text-ios-label-secondary uppercase tracking-wide px-1">
                                {language === 'my' ? 'ငွေထုတ်ယူမှု မှတ်တမ်း' : 'Withdrawal History'}
                            </h4>
                            {(() => {
                                // Sort by date descending and show only the most recent one
                                const sorted = [...userWithdrawals].sort((a, b) => {
                                    const dateA = new Date(a.requestTime || a.createdAt).getTime();
                                    const dateB = new Date(b.requestTime || b.createdAt).getTime();
                                    return dateB - dateA;
                                });
                                const mostRecent = sorted[0];
                                const statusDisplay = getWithdrawalStatusDisplay(mostRecent);
                                const requestTime = new Date(mostRecent.requestTime || mostRecent.createdAt);
                                const readyTime = new Date(requestTime.getTime() + 60 * 60 * 1000);
                                
                                return (
                                    <div 
                                        key={mostRecent.id}
                                        className={`p-3 rounded-xl ${statusDisplay.bg} border ${statusDisplay.border}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <div className="text-white font-semibold text-[14px]">
                                                    {Number(mostRecent.kyatAmount).toLocaleString()} KYAT
                                                </div>
                                                <div className="text-[11px] text-ios-label-secondary mt-1">
                                                    {requestTime.toLocaleString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-[12px] font-medium ${statusDisplay.color}`}>
                                                    {statusDisplay.text}
                                                </div>
                                                {mostRecent.status === 'pending' && (
                                                    <div className="text-[10px] text-ios-label-tertiary mt-1">
                                                        {language === 'my' ? 'Ready at' : 'Ready at'}: {readyTime.toLocaleTimeString('en-US', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {mostRecent.tonTxHash && (
                                            <div className="text-[10px] text-ios-label-tertiary font-mono mt-2 pt-2 border-t border-white/5">
                                                TX: {mostRecent.tonTxHash.slice(0, 16)}...
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Contact Support Button */}
                    <button 
                      onClick={handleContactSupport}
                      className="w-full p-4 rounded-xl bg-ios-gray5 flex items-center justify-between group hover:bg-ios-gray4 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-white font-medium text-[15px]">{TRANSLATIONS.contact_support[language]}</span>
                            <div className="flex items-center gap-2">
                                <KBZPayLogo size={20} />
                                <WaveMoneyLogo size={20} />
                            </div>
                        </div>
                        <Icons.User className="text-ios-blue" size={20} />
                    </button>
                </div>
            )
        default:
            return (
                <div className="text-center py-6">
                    <p className="text-ios-label-secondary text-[13px] mb-2 font-medium">{TRANSLATIONS.balance[language]}</p>
                    <h2 className="text-[34px] font-bold text-white mb-8 tracking-tight">{balance.toLocaleString()} <span className="text-lg font-normal text-ios-label-secondary">KYAT</span></h2>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setActiveTab(WalletTab.DEPOSIT)} className="flex flex-col items-center justify-center p-4 bg-ios-gray5 hover:bg-ios-gray4 rounded-xl transition-all">
                            <div className="w-10 h-10 rounded-full bg-ios-green/10 flex items-center justify-center mb-3 text-ios-green">
                                <Icons.Deposit size={20} />
                            </div>
                            <span className="text-[13px] font-medium text-white">{TRANSLATIONS.deposit[language]}</span>
                        </button>
                        <button onClick={() => setActiveTab(WalletTab.WITHDRAW)} className="flex flex-col items-center justify-center p-4 bg-ios-gray5 hover:bg-ios-gray4 rounded-xl transition-all">
                            <div className="w-10 h-10 rounded-full bg-ios-red/10 flex items-center justify-center mb-3 text-ios-red">
                                <Icons.Withdraw size={20} />
                            </div>
                            <span className="text-[13px] font-medium text-white">{TRANSLATIONS.withdraw[language]}</span>
                        </button>
                    </div>
                </div>
            );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-sm">
        <GlassCard className="bg-ios-gray6 border-white/5 shadow-2xl">
             {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-[17px] font-semibold text-white flex items-center gap-2">
                    <Icons.Wallet className="text-ios-blue" size={20} />
                    {TRANSLATIONS.wallet[language]}
                </h2>
                <button onClick={onClose} className="p-2 bg-ios-gray5 hover:bg-ios-gray4 rounded-full text-ios-label-secondary hover:text-white transition-colors">
                    <Icons.Close size={16} />
                </button>
            </div>

            {/* Tabs for Navigation */}
            {activeTab !== WalletTab.BALANCE && (
                <button onClick={() => setActiveTab(WalletTab.BALANCE)} className="mb-4 text-[13px] text-ios-blue hover:text-ios-blue/80 flex items-center gap-1 font-medium">
                    ← {language === 'my' ? 'လက်ကျန်ငွေသို့ ပြန်သွားရန်' : 'Back to Balance'}
                </button>
            )}

            {renderContent()}

        </GlassCard>
      </div>
    </div>
  );
};
