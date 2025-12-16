import React, { useState, useEffect } from 'react';
import { GlassCard } from './GlassCard';
import { Language, WalletTab } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';
import { walletService } from '../services/wallet';
import { User } from '../services/users';
import { validateWithdrawal } from '../utils/validation';
import WebApp from '@twa-dev/sdk';
import { TonAddressModal } from './TonAddressModal';

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  user: User | null;
  onRefresh: () => Promise<void>;
}

export const WalletModal: React.FC<Props> = ({ language, isOpen, onClose, balance, user, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<WalletTab>(WalletTab.BALANCE);
  const [depositAddress, setDepositAddress] = useState<string>('');
  const [depositMemo, setDepositMemo] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [tonAddress, setTonAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dailyWithdrawn, setDailyWithdrawn] = useState<number>(0);
  const [showTonAddressModal, setShowTonAddressModal] = useState(false);
  const [withdrawMode, setWithdrawMode] = useState<'request' | 'support' | null>(null);

  useEffect(() => {
    if (isOpen && activeTab === WalletTab.DEPOSIT) {
      fetchDepositAddress();
    }
    if (isOpen && activeTab === WalletTab.WITHDRAW) {
      fetchDailyWithdrawn();
    }
  }, [isOpen, activeTab]);

  const fetchDepositAddress = async () => {
    try {
      const response = await walletService.getDepositAddress();
      setDepositAddress(response.address);
      setDepositMemo(response.memo);
    } catch (err) {
      console.error('Error fetching deposit address:', err);
    }
  };

  const fetchDailyWithdrawn = async () => {
    try {
      const withdrawals = await walletService.getUserWithdrawals();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayWithdrawals = withdrawals.filter(w => {
        const createdAt = new Date(w.createdAt);
        return createdAt >= today && w.status === 'completed';
      });
      const total = todayWithdrawals.reduce((sum, w) => sum + w.kyatAmount, 0);
      setDailyWithdrawn(total);
    } catch (err) {
      console.error('Error fetching withdrawals:', err);
    }
  };

  const handleCopyAddress = () => {
    if (!depositAddress) return;
    navigator.clipboard.writeText(depositAddress);
    setSuccess(language === 'my' ? 'လိပ်စာ ကူးယူပြီးပါပြီ' : 'Address copied');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleCopyMemo = () => {
    if (!depositMemo) return;
    navigator.clipboard.writeText(depositMemo);
    setSuccess(language === 'my' ? 'Memo ကူးယူပြီးပါပြီ' : 'Memo copied');
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleWithdraw = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const amount = parseFloat(withdrawAmount);
      
      // Validate
      const validation = validateWithdrawal(amount, dailyWithdrawn, language);
      if (!validation.valid) {
        setError(validation.error || 'Invalid withdrawal');
        setLoading(false);
        return;
      }

      // Check if user has TON address registered
      if (!user.tonAddress && !tonAddress) {
        setError(language === 'my' ? 'ကျေးဇူးပြု၍ TON လိပ်စာထည့်သွင်းပါ' : 'Please enter your TON address');
        setLoading(false);
        return;
      }

      const addressToUse = user.tonAddress || tonAddress;

      await walletService.createWithdrawalRequest({
        kyatAmount: amount,
        tonAddress: addressToUse,
      });

      setSuccess(language === 'my' ? 'ငွေထုတ်ယူမှု တောင်းဆိုမှု အောင်မြင်ပါသည်' : 'Withdrawal requested successfully');
      await onRefresh();
      await fetchDailyWithdrawn();
      setWithdrawAmount('');
      setTonAddress('');
      setWithdrawMode(null);
      
      setTimeout(() => {
        setActiveTab(WalletTab.BALANCE);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || (language === 'my' ? 'ငွေထုတ်ယူမှု မအောင်မြင်ပါ' : 'Withdrawal failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    // Open Telegram support
    const supportUsername = 'your_support_bot'; // Replace with actual support bot
    WebApp.openTelegramLink(`https://t.me/${supportUsername}`);
  };

  if (!isOpen) return null;

  const renderContent = () => {
    switch(activeTab) {
        case WalletTab.DEPOSIT:
            return (
                <div className="space-y-3">
                    {!user?.tonAddress && (
                      <div className="p-3 rounded-xl bg-ios-yellow/10 border border-ios-yellow/20 mb-4">
                        <p className="text-[12px] text-ios-yellow mb-2">
                          {language === 'my' 
                            ? 'ကျေးဇူးပြု၍ TON လိပ်စာကို မှတ်ပုံတင်ပါ' 
                            : 'Please register your TON address first'}
                        </p>
                        <button
                          onClick={() => setShowTonAddressModal(true)}
                          className="w-full py-2 rounded-lg bg-ios-yellow/20 text-ios-yellow text-[12px] font-medium hover:bg-ios-yellow/30 transition-colors"
                        >
                          {language === 'my' ? 'မှတ်ပုံတင်ရန်' : 'Register Now'}
                        </button>
                      </div>
                    )}
                    {depositAddress && depositMemo && (
                      <div className="p-4 rounded-xl bg-ios-gray5 border border-white/5 space-y-3">
                        <div>
                          <p className="text-[11px] text-ios-label-secondary mb-2 uppercase">{language === 'my' ? 'TON လိပ်စာ' : 'TON Address'}</p>
                          <p className="text-[13px] font-mono text-white break-all mb-2">{depositAddress}</p>
                          <button 
                            onClick={handleCopyAddress}
                            className="w-full py-2 rounded-xl bg-ios-blue text-white font-medium text-[13px] hover:bg-ios-blue/90 transition-colors"
                          >
                            {language === 'my' ? 'လိပ်စာ ကူးယူရန်' : 'Copy Address'}
                          </button>
                        </div>
                        <div>
                          <p className="text-[11px] text-ios-label-secondary mb-2 uppercase">{language === 'my' ? 'Memo (အတွင်းသွင်းရန်)' : 'Memo (Required)'}</p>
                          <p className="text-[13px] font-mono text-white break-all mb-2">{depositMemo}</p>
                          <button 
                            onClick={handleCopyMemo}
                            className="w-full py-2 rounded-xl bg-ios-gray4 text-white font-medium text-[13px] hover:bg-ios-gray3 transition-colors"
                          >
                            {language === 'my' ? 'Memo ကူးယူရန်' : 'Copy Memo'}
                          </button>
                        </div>
                        <div className="pt-2 border-t border-white/5">
                          <p className="text-[10px] text-ios-label-secondary text-center">
                            {language === 'my' 
                              ? 'ကျေးဇူးပြု၍ TON USDT လွှဲပြောင်းရာတွင် memo ထည့်သွင်းပါ' 
                              : 'Please include the memo when sending TON USDT'}
                          </p>
                        </div>
                      </div>
                    )}
                    <button 
                      onClick={handleContactSupport}
                      className="w-full p-4 rounded-xl bg-ios-gray5 flex items-center justify-between group hover:bg-ios-gray4 transition-all"
                    >
                        <span className="text-white font-medium text-[15px]">{TRANSLATIONS.contact_support[language]}</span>
                        <Icons.User className="text-ios-blue" size={20} />
                    </button>
                    {success && (
                      <div className="p-3 rounded-xl bg-ios-green/10 border border-ios-green/20">
                        <p className="text-[13px] text-ios-green">{success}</p>
                      </div>
                    )}
                </div>
            )
        case WalletTab.WITHDRAW:
             return (
                <div className="space-y-3">
                    {withdrawMode === null ? (
                      <>
                        <div className="text-center py-4">
                          <p className="text-ios-label-secondary text-sm mb-1">
                            {language === 'my' ? 'ငွေထုတ်ယူနိုင်သော ပမာဏ' : 'Available for withdrawal'}
                          </p>
                          <h3 className="text-3xl font-bold text-white tracking-tight mb-2">{balance.toLocaleString()} K</h3>
                          {dailyWithdrawn > 0 && (
                            <p className="text-[11px] text-ios-label-secondary mb-4">
                              {language === 'my' 
                                ? `ယနေ့ ထုတ်ယူပြီး: ${dailyWithdrawn.toLocaleString()} KYAT`
                                : `Withdrawn today: ${dailyWithdrawn.toLocaleString()} KYAT`}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => setWithdrawMode('request')}
                          className="w-full p-4 rounded-xl bg-ios-gray5 flex items-center justify-between group hover:bg-ios-gray4 transition-all"
                        >
                          <span className="text-white font-medium text-[15px]">
                            {language === 'my' ? 'ငွေထုတ်ယူမှု တောင်းဆိုရန်' : 'Request Withdrawal'}
                          </span>
                          <Icons.CreditCard className="text-ios-green" size={20} />
                        </button>
                        <button 
                          onClick={handleContactSupport}
                          className="w-full p-4 rounded-xl bg-ios-gray5 flex items-center justify-between group hover:bg-ios-gray4 transition-all"
                        >
                          <span className="text-white font-medium text-[15px]">{TRANSLATIONS.contact_support[language]}</span>
                          <Icons.User className="text-ios-blue" size={20} />
                        </button>
                      </>
                    ) : withdrawMode === 'request' ? (
                      <>
                        <button 
                          onClick={() => setWithdrawMode(null)}
                          className="mb-2 text-[13px] text-ios-blue hover:text-ios-blue/80 flex items-center gap-1 font-medium"
                        >
                          ← {language === 'my' ? 'ပြန်သွားရန်' : 'Back'}
                        </button>
                        {error && (
                          <div className="p-3 rounded-xl bg-ios-red/10 border border-ios-red/20">
                            <p className="text-[13px] text-ios-red">{error}</p>
                          </div>
                        )}
                        {success && (
                          <div className="p-3 rounded-xl bg-ios-green/10 border border-ios-green/20">
                            <p className="text-[13px] text-ios-green">{success}</p>
                          </div>
                        )}
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
                              className="w-full bg-ios-gray5 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-sm transition-all"
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
                            min="5000"
                            placeholder="5000"
                            disabled={loading}
                            className="w-full bg-ios-gray5 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50"
                          />
                        </div>
                        <button 
                          onClick={handleWithdraw}
                          disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) < 5000}
                          className="w-full py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? TRANSLATIONS.loading[language] : (language === 'my' ? 'ငွေထုတ်ယူမှု တောင်းဆိုရန်' : 'Request Withdrawal')}
                        </button>
                      </>
                    ) : null}
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

      <TonAddressModal
        language={language}
        isOpen={showTonAddressModal}
        onClose={() => setShowTonAddressModal(false)}
        onSuccess={async () => {
          await onRefresh();
          await fetchDepositAddress();
        }}
      />
    </div>
  );
};

