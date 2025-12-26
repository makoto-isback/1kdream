import React, { useEffect, useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { LotteryRound, lotteryService } from '../services/lottery';
import { useUserData } from '../hooks/useUserData';
import { userDataSync } from '../services/userDataSync';

interface Props {
  language: Language;
  round: LotteryRound | null;
  winningBlockOverride?: number | null;
  winnersCount?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WinningPopup: React.FC<Props> = ({
  language,
  round,
  winningBlockOverride,
  winnersCount: winnersCountProp,
  isOpen,
  onClose,
}) => {
  const { user } = useUserData();
  const [userWon, setUserWon] = useState(false);
  const [userPayout, setUserPayout] = useState(0);
  const [checking, setChecking] = useState(true);
  const [roundWithWinner, setRoundWithWinner] = useState<LotteryRound | null>(null);
  const [localWinnersCount, setLocalWinnersCount] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && round && user) {
      fetchRoundWithWinner();
    }
  }, [isOpen, round, user]);

  const fetchRoundWithWinner = async () => {
    if (!round) return;
    
    setChecking(true);
    try {
      // If we already have winningBlockOverride, use it directly
      if (winningBlockOverride) {
        const roundWithWinnerData: LotteryRound = {
          ...round,
          winningBlock: winningBlockOverride,
          status: 'completed',
        };
        setRoundWithWinner(roundWithWinnerData);
        if (winnersCountProp !== undefined) {
          setLocalWinnersCount(winnersCountProp ?? null);
        }
        await checkUserWin(roundWithWinnerData);
        return;
      }

      // Try to fetch round stats to get winning block and winners count
      const stats = await lotteryService.getRoundStats(round.id);
      if (stats?.winningBlock) {
        const winnersForBlock = stats.blockStats?.[stats.winningBlock - 1]?.totalBets ?? null;
        setLocalWinnersCount(winnersForBlock);

        const roundWithWinnerData: LotteryRound = {
          ...round,
          winningBlock: stats.winningBlock,
          status: stats.status || round.status,
        };
        setRoundWithWinner(roundWithWinnerData);
        await checkUserWin(roundWithWinnerData);
        return;
      }

      // Fallback: Fetch pool info to get latest completed round with winning block
      const poolInfo = await lotteryService.getPoolInfo();
      if (poolInfo.latestRound && poolInfo.latestRound.roundNumber === round.roundNumber && poolInfo.latestRound.winningBlock) {
        const roundWithWinnerData: LotteryRound = {
          ...round,
          winningBlock: poolInfo.latestRound.winningBlock,
          status: poolInfo.latestRound.status,
        };
        setRoundWithWinner(roundWithWinnerData);
        await checkUserWin(roundWithWinnerData);
      } else {
        setRoundWithWinner(round);
        await checkUserWin(round);
      }
    } catch (error) {
      console.error('Error fetching round with winner:', error);
      setRoundWithWinner(round);
      await checkUserWin(round);
    } finally {
      setChecking(false);
    }
  };

  const checkUserWin = async (roundData: LotteryRound | null) => {
    if (!roundData || !roundData.winningBlock || !user) {
      setUserWon(false);
      return;
    }

    try {
      // Get user bets from UserDataSync (socket-first, no HTTP)
      const userBets: any[] = userDataSync.getData('bets') || [];
      const roundBets = userBets.filter((bet: any) => bet.lotteryRoundId === roundData.id);
      const winningBets = roundBets.filter((bet: any) => bet.blockNumber === roundData.winningBlock);
      
      if (winningBets.length > 0) {
        setUserWon(true);
        // Calculate user's share of the winner pool
        const totalWinningAmount = roundBets
          .filter((bet: any) => bet.blockNumber === roundData.winningBlock)
          .reduce((sum: number, bet: any) => sum + bet.amount, 0);
        
        const userWinningAmount = winningBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
        const winnerPool = parseFloat(String(roundData.winnerPool || 0));
        const payout = (userWinningAmount / totalWinningAmount) * winnerPool;
        setUserPayout(payout);
      } else {
        setUserWon(false);
      }
    } catch (error) {
      console.error('Error checking user win:', error);
      setUserWon(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Auto close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !round) {
    return null;
  }

  const displayRound = roundWithWinner || round;
  const winningBlock = displayRound?.winningBlock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm mx-4 animate-scaleIn">
        <GlassCard className="p-6 text-center border-2 border-white/20">
          {checking ? (
            <div className="py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ios-yellow mx-auto mb-4"></div>
              <p className="text-ios-label-secondary">{TRANSLATIONS.loading[language]}</p>
            </div>
          ) : (
            <>
              {/* Confetti effect for winners */}
              {userWon && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute animate-confetti"
                      style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${2 + Math.random() * 2}s`,
                      }}
                    >
                      <span className="text-2xl">🎉</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative z-10">
                {winningBlock ? (
                  <>
                    <div className={`text-6xl font-bold mb-4 ${userWon ? 'text-ios-yellow' : 'text-white'}`}>
                      {winningBlock.toString().padStart(2, '0')}
                    </div>

                    <h2 className="text-xl font-bold text-white mb-2">
                      {userWon
                        ? (language === 'en' ? '🎉 You Won! 🎉' : '🎉 သင်အနိုင်ရရှိပါသည်! 🎉')
                        : (language === 'en' ? 'Round Complete' : 'ပွဲပြီးဆုံးပါပြီ')
                      }
                    </h2>

                    <p className="text-ios-label-secondary mb-4">
                      {language === 'en' 
                        ? `Round #${displayRound.roundNumber} - Winning Number`
                        : `ပွဲ #${displayRound.roundNumber} - အနိုင်ရ နံပါတ်`
                      }
                    </p>

                    {localWinnersCount !== null && (
                      <p className="text-[12px] text-ios-label-secondary mb-2">
                        {language === 'en'
                          ? `${localWinnersCount} winner${localWinnersCount === 1 ? '' : 's'}`
                          : `${localWinnersCount} အနိုင်ရ`}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-4xl font-bold mb-4 text-white">
                      {language === 'en' ? 'Round Complete' : 'ပွဲပြီးဆုံးပါပြီ'}
                    </div>
                    <p className="text-ios-label-secondary mb-4">
                      {language === 'en' 
                        ? `Round #${displayRound.roundNumber} - Results pending...`
                        : `ပွဲ #${displayRound.roundNumber} - ရလဒ်များ စောင့်ဆိုင်းနေသည်...`
                      }
                    </p>
                  </>
                )}

                {userWon && (
                  <div className="mt-4 p-4 rounded-xl bg-ios-yellow/10 border border-ios-yellow/20">
                    <p className="text-sm text-ios-label-secondary mb-1">
                      {language === 'en' ? 'Your Payout' : 'သင်ရရှိသော ငွေ'}
                    </p>
                    <p className="text-2xl font-bold text-ios-yellow">
                      {userPayout.toLocaleString()} Ks
                    </p>
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="mt-6 px-6 py-2 bg-ios-blue/20 hover:bg-ios-blue/30 rounded-lg text-white text-sm font-medium transition-colors"
                >
                  {language === 'en' ? 'Continue' : 'ဆက်လုပ်မည်'}
                </button>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

