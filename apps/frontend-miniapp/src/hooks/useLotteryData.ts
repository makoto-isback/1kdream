import { useState, useEffect } from 'react';
import { lotteryService, LotteryRound } from '../services/lottery';
import { betsService } from '../services/bets';
import { NumberStats } from '../types/ui';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const useLotteryData = () => {
  const [activeRound, setActiveRound] = useState<LotteryRound | null>(null);
  const [numbers, setNumbers] = useState<NumberStats[]>([]);
  const [userStake, setUserStake] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthReady } = useAuth();

  const fetchData = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!isAuthReady || !token) {
        // If auth isn't ready yet, don't attempt to fetch. We'll try again
        // once auth becomes ready. Avoid flipping loading back to true here
        // to prevent infinite skeleton state.
        return;
      }

      setLoading(true);
      setError(null);

      const round = await lotteryService.getActiveRound();
      setActiveRound(round);

      if (round) {
        // Get user bets for this round to calculate stake
        const userBets = await betsService.getUserBets(100);
        const roundBets = userBets.filter(bet => bet.lotteryRoundId === round.id);
        // Ensure numeric addition (bet.amount may be string from API)
        const stake = roundBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
        setUserStake(stake);

        // Get round stats to populate buyers and totalKyat per block
        try {
          const statsResponse = await api.get(`/lottery/round/${round.id}/stats`);
          const blockStats = statsResponse.data.blockStats || [];

          const initialNumbers: NumberStats[] = Array.from({ length: 25 }, (_, i) => {
            const blockStat = blockStats[i] || { totalBets: 0, totalAmount: 0 };
            return {
              id: i + 1,
              buyers: blockStat.totalBets || 0,
              totalKyat: blockStat.totalAmount || 0,
              isSelected: false,
              isDisabled: false,
            };
          });

          setNumbers(initialNumbers);
        } catch (err) {
          // Fallback to empty stats if stats endpoint fails
          const initialNumbers: NumberStats[] = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            buyers: 0,
            totalKyat: 0,
            isSelected: false,
            isDisabled: false,
          }));
          setNumbers(initialNumbers);
        }
      } else {
        setNumbers(Array.from({ length: 25 }, (_, i) => ({
          id: i + 1,
          buyers: 0,
          totalKyat: 0,
          isSelected: false,
          isDisabled: false,
        })));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load lottery data');
      console.error('Error fetching lottery data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!isAuthReady || !token) {
      // Do not start polling until auth is fully ready and we have a token.
      setLoading(false);
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthReady]);

  return {
    activeRound,
    numbers,
    userStake,
    loading,
    error,
    refetch: fetchData,
  };
};

