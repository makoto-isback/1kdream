import React, { useEffect, useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { Bet as BetServiceType } from '../services/bets';
import { lotteryService } from '../services/lottery';
import { userDataSync } from '../services/userDataSync';

type Bet = {
  id: string;
  lotteryRoundId: string;
  blockNumber: number;
  amount: number;
  createdAt: string;
};

type RoundEntry = {
  roundId: string;
  roundNumber: number;
  winningBlock: number | null;
  userTotalBet: number;
  userWinningBet: number;
  status: 'win' | 'lose' | 'pending';
};

interface Props {
  language: Language;
  refreshKey?: number;
}

export const UserRoundHistory: React.FC<Props> = ({ language, refreshKey }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<RoundEntry[]>([]);

  useEffect(() => {
    loadHistory();
  }, [refreshKey]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      // Get user bets from UserDataSync (socket-first, no HTTP)
      const userBets: BetType[] = userDataSync.getData('bets') || [];
      // Group by round
      const byRound = new Map<string, Bet[]>();
      userBets.forEach((bet: BetType) => {
        const list = byRound.get(bet.lotteryRoundId) || [];
        list.push(bet);
        byRound.set(bet.lotteryRoundId, list);
      });

      // Fetch round stats for each round (sequential to stay light)
      const result: RoundEntry[] = [];
      for (const [roundId, bets] of byRound.entries()) {
        try {
          const stats = await lotteryService.getRoundStats(roundId);
          const winningBlock =
            stats?.winningBlock ??
            (stats?.round ? stats.round.winningBlock : null);
          const roundNumber =
            stats?.round?.roundNumber ?? stats?.roundNumber ?? 0;

          const userTotalBet = bets.reduce((sum, b) => sum + Number(b.amount), 0);
          const userWinningBet = bets
            .filter((b) => winningBlock !== null && b.blockNumber === winningBlock)
            .reduce((sum, b) => sum + Number(b.amount), 0);

          let status: 'win' | 'lose' | 'pending' = 'pending';
          if (winningBlock === null) {
            status = 'pending';
          } else if (userWinningBet > 0) {
            status = 'win';
          } else {
            status = 'lose';
          }

          result.push({
            roundId,
            roundNumber,
            winningBlock,
            userTotalBet,
            userWinningBet,
            status,
          });
        } catch (err) {
          // skip on error
          // console.error('Round stats error', err);
        }
      }

      // Sort by roundNumber desc
      result.sort((a, b) => b.roundNumber - a.roundNumber);
      setEntries(result.slice(0, 10));
    } catch (error) {
      console.error('Error loading user history:', error);
    } finally {
      setLoading(false);
    }
  };

  const title = language === 'en' ? 'Your Round History' : 'သင့် အတွေ့အကြုံ မှတ်တမ်း';

  if (loading && entries.length === 0) {
    return (
      <GlassCard className="w-full mb-4">
        <div className="py-4 text-center text-ios-label-secondary text-sm">
          {language === 'en' ? 'Loading history...' : 'မှတ်တမ်း ရယူနေသည်...'}
        </div>
      </GlassCard>
    );
  }

  if (entries.length === 0) {
    return (
      <GlassCard className="w-full mb-4">
        <div className="py-4 text-center text-ios-label-secondary text-sm">
          {language === 'en' ? 'No history yet' : 'မှတ်တမ်း မရှိသေးပါ'}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button
          onClick={loadHistory}
          className="text-[11px] text-ios-blue hover:text-white transition-colors"
        >
          {language === 'en' ? 'Refresh' : 'ပြန်လည် تازه'}
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((entry) => {
          const statusLabel =
            entry.status === 'win'
              ? language === 'en' ? 'Won' : 'အနိုင်ရ'
              : entry.status === 'lose'
                ? language === 'en' ? 'Lost' : 'ရှုံး'
                : language === 'en' ? 'Pending' : 'စောင့်ဆိုင်း中';

          const statusColor =
            entry.status === 'win'
              ? 'text-ios-green'
              : entry.status === 'lose'
                ? 'text-ios-red'
                : 'text-ios-label-secondary';

          return (
            <div
              key={entry.roundId}
              className="p-3 rounded-xl bg-ios-gray5 border border-white/5 flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-ios-label-secondary">
                  {language === 'en' ? 'Round' : 'ပွဲ'} #{entry.roundNumber}
                </div>
                <div className="text-sm text-white">
                  {language === 'en' ? 'Winning' : 'အနိုင်ရ'}:{' '}
                  <span className="font-semibold">
                    {entry.winningBlock ? entry.winningBlock.toString().padStart(2, '0') : '—'}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${statusColor}`}>
                  {statusLabel}
                </div>
                <div className="text-[11px] text-ios-label-secondary">
                  {language === 'en' ? 'Your bet' : 'သင့်ထိုးငွေ'}: {entry.userTotalBet.toLocaleString()} Ks
                </div>
                {entry.status === 'win' && (
                  <div className="text-[11px] text-ios-label-secondary">
                    {language === 'en' ? 'On winning #' : 'အနိုင်ရ နံပါတ်'}: {entry.userWinningBet.toLocaleString()} Ks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};

