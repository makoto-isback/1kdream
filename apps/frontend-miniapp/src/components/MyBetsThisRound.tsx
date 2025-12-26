import React, { useEffect, useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { Bet } from '../services/bets';
import { useUserData } from '../hooks/useUserData';
import { userDataSync } from '../services/userDataSync';

interface Props {
  language: Language;
  roundId: string | null;
  refreshKey?: number;
}

export const MyBetsThisRound: React.FC<Props> = ({ language, roundId, refreshKey }) => {
  const { user, isAuthReady } = useUserData();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(false);

  // Subscribe to UserDataSync for bets (socket-first, no HTTP)
  useEffect(() => {
    if (!roundId || !isAuthReady || !user) {
      setBets([]);
      return;
    }

    // Subscribe to bets from UserDataSync
    const unsubscribe = userDataSync.subscribe('bets', (allBets: Bet[]) => {
      if (allBets && roundId) {
        const roundBets = allBets.filter(bet => bet.lotteryRoundId === roundId);
        setBets(roundBets);
        setLoading(false);
      }
    });

    // Get initial bets from cache
    const cachedBets = userDataSync.getData('bets') || [];
    if (cachedBets.length > 0 && roundId) {
      const roundBets = cachedBets.filter((bet: Bet) => bet.lotteryRoundId === roundId);
      setBets(roundBets);
    }

    return unsubscribe;
  }, [roundId, refreshKey, isAuthReady, user]);

  // Group bets by block number
  const groupedBets = bets.reduce((acc, bet) => {
    if (!acc[bet.blockNumber]) {
      acc[bet.blockNumber] = { count: 0, totalAmount: 0 };
    }
    acc[bet.blockNumber].count++;
    acc[bet.blockNumber].totalAmount += Number(bet.amount);
    return acc;
  }, {} as Record<number, { count: number; totalAmount: number }>);

  const totalBetsAmount = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
  const uniqueNumbers = Object.keys(groupedBets).length;

  if (!user || !roundId) {
    return null;
  }

  if (loading) {
    return (
      <GlassCard className="w-full mb-4">
        <div className="py-2 text-center text-ios-label-secondary text-xs">
          {language === 'en' ? 'Loading your bets...' : 'သင့်ထိုးချက်များ ဖတ်နေသည်...'}
        </div>
      </GlassCard>
    );
  }

  if (bets.length === 0) {
    return (
      <GlassCard className="w-full mb-4">
        <div className="py-3 text-center">
          <p className="text-ios-label-secondary text-xs mb-2">
            {language === 'en' ? 'You haven\'t placed any bets this round' : 'ဒီပွဲမှာ သင် ထိုးမထားသေးပါ'}
          </p>
          <p className="text-[10px] text-ios-label-tertiary">
            {language === 'en' ? 'Select numbers below to place your bet!' : 'အောက်က နံပါတ်တွေ ရွေးပြီး ထိုးလိုက်ပါ!'}
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-ios-green/15 rounded-full text-ios-green">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 className="text-xs font-semibold text-white">
            {language === 'en' ? 'Your Bets This Round' : 'ဒီပွဲမှာ သင့်ထိုးချက်'}
          </h3>
        </div>
        <div className="text-right">
          <span className="text-ios-green font-bold text-sm">
            {totalBetsAmount.toLocaleString()} Ks
          </span>
        </div>
      </div>
      
      {/* Display bought numbers - just numbers, no amounts */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(groupedBets)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([blockNum]) => (
            <div
              key={blockNum}
              className="px-4 py-2 rounded-lg bg-ios-green/10 border border-ios-green/30 text-center"
            >
              <div className="text-xl font-bold text-ios-green">
                {blockNum.toString().padStart(2, '0')}
              </div>
            </div>
          ))}
      </div>
      
      {/* Summary */}
      <div className="text-center pt-2 border-t border-white/5">
        <span className="text-[10px] text-ios-label-secondary">
          {language === 'en' 
            ? `${uniqueNumbers} number${uniqueNumbers > 1 ? 's' : ''} • ${bets.length} bet${bets.length > 1 ? 's' : ''}`
            : `နံပါတ် ${uniqueNumbers} ခု • ထိုးချက် ${bets.length} ခု`}
        </span>
      </div>
    </GlassCard>
  );
};

