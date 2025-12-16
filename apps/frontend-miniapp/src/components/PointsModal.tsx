import React, { useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';
import { pointsService } from '../services/points';
import { User } from '../services/users';
import { validatePointsRedemption, MIN_REDEMPTION_POINTS } from '../utils/validation';

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
  points: number;
  user: User | null;
  onRefresh: () => Promise<void>;
}

export const PointsModal: React.FC<Props> = ({ language, isOpen, onClose, points, user, onRefresh }) => {
  const [redeemAmount, setRedeemAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nextReward = 10000; // Next redemption threshold
  const progress = Math.min((points / nextReward) * 100, 100);

  const handleRedeem = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const pointsToRedeem = parseInt(redeemAmount);
      
      // Validate
      const validation = validatePointsRedemption(pointsToRedeem, user.points, language);
      if (!validation.valid) {
        setError(validation.error || 'Invalid redemption');
        setLoading(false);
        return;
      }

      await pointsService.redeemPoints(pointsToRedeem);
      
      setSuccess(language === 'my' ? 'အမှတ်များ အောင်မြင်စွာ ပြန်လည်ထုတ်ယူပြီး' : 'Points redeemed successfully');
      await onRefresh();
      setRedeemAmount('');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || (language === 'my' ? 'အမှတ် ပြန်လည်ထုတ်ယူမှု မအောင်မြင်ပါ' : 'Redemption failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-sm animate-fade-in-up">
        <GlassCard className="bg-ios-gray6 border-white/5 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-[17px] font-semibold text-white flex items-center gap-2">
                    <Icons.Gift className="text-ios-pink" size={20} />
                    {TRANSLATIONS.points[language]}
                </h2>
                <button onClick={onClose} className="p-2 bg-ios-gray5 hover:bg-ios-gray4 rounded-full text-ios-label-secondary hover:text-white transition-colors">
                    <Icons.Close size={16} />
                </button>
            </div>

            <div className="flex flex-col items-center mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-ios-pink to-ios-red p-[3px] mb-4 shadow-xl shadow-ios-pink/20">
                    <div className="w-full h-full rounded-full bg-ios-gray6 flex items-center justify-center flex-col">
                        <span className="text-3xl font-bold text-white">{points.toLocaleString()}</span>
                        <span className="text-[10px] text-ios-label-secondary uppercase tracking-widest font-semibold">PTS</span>
                    </div>
                </div>
                
                <div className="w-full bg-ios-gray5 rounded-full h-1.5 mb-2">
                    <div className="bg-ios-pink h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[11px] text-ios-label-secondary font-medium">
                  {points.toLocaleString()} / {nextReward.toLocaleString()} {language === 'my' ? 'ပြန်လည်ထုတ်ယူရန်' : 'to next redemption'}
                </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-ios-red/10 border border-ios-red/20">
                <p className="text-[13px] text-ios-red">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 rounded-xl bg-ios-green/10 border border-ios-green/20">
                <p className="text-[13px] text-ios-green">{success}</p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">
                {language === 'my' ? 'ပြန်လည်ထုတ်ယူမည့် အမှတ်' : 'Points to Redeem'}
              </label>
              <input
                type="number"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                min={MIN_REDEMPTION_POINTS}
                placeholder={MIN_REDEMPTION_POINTS.toString()}
                disabled={loading}
                className="w-full bg-ios-gray5 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50"
              />
              <p className="text-[10px] text-ios-label-secondary mt-1 ml-1">
                {language === 'my' 
                  ? `အနည်းဆုံး: ${MIN_REDEMPTION_POINTS.toLocaleString()} အမှတ် (1,000 အမှတ် = 1,000 KYAT)`
                  : `Minimum: ${MIN_REDEMPTION_POINTS.toLocaleString()} points (1,000 points = 1,000 KYAT)`}
              </p>
            </div>

            <button 
              onClick={handleRedeem}
              disabled={loading || !redeemAmount || parseInt(redeemAmount) < MIN_REDEMPTION_POINTS || parseInt(redeemAmount) > (user?.points || 0)}
              className="w-full py-3.5 rounded-xl bg-ios-gray5 hover:bg-ios-gray4 text-ios-blue font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? TRANSLATIONS.loading[language] : TRANSLATIONS.redeem[language]}
            </button>
        </GlassCard>
      </div>
    </div>
  );
};

