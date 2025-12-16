import React, { useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';
import { usersService } from '../services/users';

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const TonAddressModal: React.FC<Props> = ({ language, isOpen, onClose, onSuccess }) => {
  const [tonAddress, setTonAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!tonAddress.trim()) {
      setError(language === 'my' ? 'ကျေးဇူးပြု၍ TON လိပ်စာထည့်သွင်းပါ' : 'Please enter TON address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await usersService.updateTonAddress(tonAddress.trim());
      await onSuccess();
      onClose();
      setTonAddress('');
    } catch (err: any) {
      setError(err.response?.data?.message || (language === 'my' ? 'မအောင်မြင်ပါ' : 'Failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-sm">
        <GlassCard className="bg-ios-gray6 border-white/5 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[17px] font-semibold text-white flex items-center gap-2">
              <Icons.Wallet className="text-ios-blue" size={20} />
              {language === 'my' ? 'TON လိပ်စာ မှတ်ပုံတင်ရန်' : 'Register TON Address'}
            </h2>
            <button onClick={onClose} className="p-2 bg-ios-gray5 hover:bg-ios-gray4 rounded-full text-ios-label-secondary hover:text-white transition-colors">
              <Icons.Close size={16} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-ios-red/10 border border-ios-red/20">
              <p className="text-[13px] text-ios-red">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
              {language === 'my' ? 'TON လိပ်စာ' : 'TON Address'}
            </label>
            <input
              type="text"
              value={tonAddress}
              onChange={(e) => setTonAddress(e.target.value)}
              placeholder={language === 'my' ? 'TON လိပ်စာထည့်သွင်းပါ' : 'Enter TON address'}
              disabled={loading}
              className="w-full bg-ios-gray5 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-sm transition-all disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !tonAddress.trim()}
            className="w-full py-3.5 rounded-xl bg-ios-blue text-white font-semibold text-[15px] hover:bg-ios-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? TRANSLATIONS.loading[language] : (language === 'my' ? 'မှတ်ပုံတင်ရန်' : 'Register')}
          </button>
        </GlassCard>
      </div>
    </div>
  );
};

