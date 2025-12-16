import React, { useEffect, useMemo, useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { lotteryService, Winner } from '../services/lottery';

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
  const [winners, setWinners] = useState<Winner[]>([]);

  // Only fetch from API if recentWinners prop is not provided (fallback)
  useEffect(() => {
    if (!recentWinners || recentWinners.length === 0) {
      loadWinners();
      const interval = setInterval(loadWinners, 30000);
      return () => clearInterval(interval);
    }
  }, [limit, refreshKey, recentWinners]);

  const loadWinners = async () => {
    try {
      const data = await lotteryService.getWinnersFeed(limit * 2); // grab extra to aggregate per round
      setWinners(data || []);
    } catch (error) {
      console.error('Error loading winners:', error);
    } finally {
      // no-op
    }
  };

  const rounds: WinnerRound[] = useMemo(() => {
    // If recentWinners prop is provided, use it directly (from socket events)
    if (recentWinners && recentWinners.length > 0) {
      return recentWinners.slice(0, limit);
    }
    
    // Otherwise, aggregate from API winners data (fallback)
    if (!winners || winners.length === 0) return [];
    const map = new Map<number, WinnerRound>();
    winners.forEach((w) => {
      const existing = map.get(w.roundNumber);
      if (existing) {
        existing.winnersCount += 1;
        if (!existing.winningBlock && w.block) existing.winningBlock = w.block;
      } else {
        map.set(w.roundNumber, {
          roundNumber: w.roundNumber,
          winningBlock: w.block,
          winnersCount: 1,
        });
      }
    });
    return Array.from(map.values())
      .sort((a, b) => b.roundNumber - a.roundNumber)
      .slice(0, limit);
  }, [winners, limit, recentWinners]);

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

