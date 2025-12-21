import React, { useEffect, useMemo, useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { lotteryService, RecentRound } from '../services/lottery';

interface Props {
  language: Language;
  limit?: number;
  refreshKey?: number;
  recentWinners?: WinnerRound[]; // Direct state from socket events
}

export type WinnerRound = {
  roundNumber: number;
  winningBlock: number | null;
  winnersCount: number;
};

export const WinningHistoryBar: React.FC<Props> = ({ language, limit = 10, refreshKey, recentWinners }) => {
  const [recentRounds, setRecentRounds] = useState<RecentRound[]>([]);

  // Fetch ALL recent rounds (not just winners)
  useEffect(() => {
    loadRecentRounds();
    const interval = setInterval(loadRecentRounds, 30000);
    return () => clearInterval(interval);
  }, [limit, refreshKey]);

  const loadRecentRounds = async () => {
    try {
      const data = await lotteryService.getRecentRounds(limit);
      setRecentRounds(data || []);
    } catch (error) {
      console.error('Error loading recent rounds:', error);
    }
  };

  const rounds: WinnerRound[] = useMemo(() => {
    // Merge socket updates with API data
    // Socket events take priority for fresh data
    const mergedMap = new Map<number, WinnerRound>();
    
    // First, add all API data
    recentRounds.forEach((r) => {
      mergedMap.set(r.roundNumber, {
        roundNumber: r.roundNumber,
        winningBlock: r.winningBlock,
        winnersCount: r.winnersCount,
      });
    });
    
    // Then, overlay with socket data (if any)
    if (recentWinners && recentWinners.length > 0) {
      recentWinners.forEach((r) => {
        mergedMap.set(r.roundNumber, r);
      });
    }
    
    return Array.from(mergedMap.values())
      .sort((a, b) => b.roundNumber - a.roundNumber)
      .slice(0, limit);
  }, [recentRounds, limit, recentWinners]);

  const isEmpty = rounds.length === 0;

  return (
    <GlassCard className="w-full mb-4 overflow-hidden">
      <div className="flex items-center space-x-2 mb-3 px-1">
        <div className="p-1.5 bg-ios-yellow/15 rounded-full text-ios-yellow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <h3 className="text-xs font-semibold text-white">
          {language === 'en' ? 'Recent Winners' : 'လက်ရှိ အနိုင်ရရှိသူများ'}
        </h3>
      </div>
      
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {isEmpty && (
          [...Array(5)].map((_, idx) => (
            <div
              key={`placeholder-${idx}`}
              className="flex-shrink-0 px-3 py-2 rounded-lg bg-ios-gray5/60 border border-white/5 min-w-[90px] animate-pulse"
            >
              <div className="h-3 w-12 bg-white/10 rounded mb-2" />
              <div className="h-5 w-10 bg-white/15 rounded mb-2" />
              <div className="h-3 w-16 bg-white/8 rounded" />
            </div>
          ))
        )}

        {!isEmpty && rounds.map((item) => (
          <div
            key={item.roundNumber}
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-ios-gray5 border border-white/5 min-w-[100px]"
          >
            <div className="text-center">
              <div className="text-[10px] text-ios-label-secondary mb-1">
                {language === 'en' ? 'Round' : 'ပွဲ'} #{item.roundNumber}
              </div>
              <div className="text-lg font-bold text-ios-yellow mb-1">
                {(item.winningBlock ?? 0).toString().padStart(2, '0')}
              </div>
              <div className="text-[9px] text-ios-label-secondary truncate max-w-[90px]">
                {language === 'en'
                  ? `${item.winnersCount} winner${item.winnersCount === 1 ? '' : 's'}`
                  : `${item.winnersCount} အနိုင်ရ`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

