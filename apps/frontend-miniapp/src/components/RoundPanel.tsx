import React from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';
import { LotteryRound } from '../services/lottery';

interface Props {
  language: Language;
  round: LotteryRound | null;
  countdown: string;
  userStake: number;
  loading?: boolean;
}

export const RoundPanel: React.FC<Props> = ({ language, round, countdown, userStake, loading = false }) => {
  if (loading || !round) {
    return (
      <GlassCard className="w-full mb-4">
        <div className="flex justify-center items-center py-8">
          <span className="text-ios-label-secondary text-sm">{TRANSLATIONS.loading[language]}</span>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-3">
           <div className="p-2 bg-ios-blue/15 rounded-full text-ios-blue">
             <Icons.Clock size={20} />
           </div>
           <div>
             <p className="text-[11px] text-ios-label-secondary uppercase tracking-wide font-medium">
                {TRANSLATIONS.ends_in[language]}
             </p>
             <p className="text-xl font-mono font-medium text-white tracking-tight">{countdown}</p>
           </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ios-label-secondary uppercase tracking-wide font-medium">
            {TRANSLATIONS.round[language]}
          </p>
          <p className="text-xl font-medium text-white tracking-tight">#{round.roundNumber}</p>
        </div>
      </div>
      
      <div className="p-4 rounded-2xl bg-ios-gray5 border border-white/5">
         <div className="flex justify-between items-end">
            <div>
              <p className="text-[11px] text-ios-label-secondary mb-1">{TRANSLATIONS.pool[language]}</p>
              <p className="text-2xl font-bold text-ios-yellow tracking-tight">
                {parseFloat(String(round.totalPool || 0)).toLocaleString()} <span className="text-lg">K</span>
              </p>
            </div>
            <div className="text-right">
                <p className="text-[11px] text-ios-label-secondary mb-1">{TRANSLATIONS.your_stake[language]}</p>
                <p className="text-lg font-medium text-white">{userStake.toLocaleString()} <span className="text-sm">K</span></p>
            </div>
         </div>
      </div>
    </GlassCard>
  );
};

