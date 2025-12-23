import { useState, useEffect } from 'react';
import { lotteryService, LotteryRound } from '../services/lottery';
import { betsService } from '../services/bets';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Type for block statistics (optional overlay data)
type BlockStats = {
  buyers: number;
  totalKyat: number;
};

export const useLotteryData = () => {
  const [activeRound, setActiveRound] = useState<LotteryRound | null>(null);
  const [blockStats, setBlockStats] = useState<Map<number, BlockStats>>(new Map());
  const [userStake, setUserStake] = useState<number>(0);
  const [loading, setLoading] = useState(false); // Start as false - don't block UI
  const [error, setError] = useState<string | null>(null);
  const { isAuthReady } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch active round - don't require auth for this
      const round = await lotteryService.getActiveRound();
      
      // Only clear error if we successfully got a round
      if (round) {
        setError(null);
        setActiveRound(round);

        // Get round stats to populate buyers and totalKyat per block
        // This is optional - if it fails, blocks still render with default stats
        try {
          const statsResponse = await api.get(`/lottery/round/${round.id}/stats`);
          const blockStatsArray = statsResponse.data.blockStats || [];

          const statsMap = new Map<number, BlockStats>();
          blockStatsArray.forEach((stat: any, index: number) => {
            statsMap.set(index + 1, {
              buyers: stat.totalBets || 0,
              totalKyat: stat.totalAmount || 0,
            });
          });

          setBlockStats(statsMap);
        } catch (err) {
          // Stats fetch failed - not critical, blocks still render with default stats
          console.warn('[useLotteryData] Stats fetch failed, blocks will show with default values:', err);
          setBlockStats(new Map()); // Clear stats, use defaults
        }

        // Get user bets for this round to calculate stake
        // Only fetch if authenticated - this is optional
        if (isAuthReady) {
          try {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
            if (token) {
              const userBets = await betsService.getUserBets(100);
              const roundBets = userBets.filter(bet => bet.lotteryRoundId === round.id);
              const stake = roundBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
              setUserStake(stake);
            }
          } catch (err) {
            // User bets fetch failed - not critical, stake stays 0
            console.warn('[useLotteryData] User bets fetch failed:', err);
          }
        }
      } else {
        // No active round - clear stats, blocks still render
        setBlockStats(new Map());
        // Only set error if we don't have a cached round
        // If we already have activeRound, don't show error (might be temporary backend issue)
        if (!activeRound) {
          setError('No active round available');
        } else {
          // We have cached data, clear error
          setError(null);
        }
      }
    } catch (err: any) {
      // Only set error if we don't have cached round data
      // If we already have activeRound, this is a non-critical refetch failure
      if (!activeRound) {
        setError(err.response?.data?.message || 'Failed to load lottery data');
        console.error('[useLotteryData] Error fetching lottery data:', err);
      } else {
        // We have cached data, don't show error for refetch failures
        console.warn('[useLotteryData] Refetch failed but using cached data:', err);
        setError(null);
      }
      // Don't throw - blocks still render even if API fails
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch immediately - don't wait for auth
    // Blocks render instantly, stats update when API responds
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []); // Remove isAuthReady dependency - blocks don't need auth

  // Re-fetch user stake when auth becomes ready (optional enhancement)
  useEffect(() => {
    if (isAuthReady && activeRound) {
      // Only fetch user stake, not blocking block rendering
      const fetchUserStake = async () => {
        try {
          const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
          if (token) {
            const userBets = await betsService.getUserBets(100);
            const roundBets = userBets.filter(bet => bet.lotteryRoundId === activeRound.id);
            const stake = roundBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
            setUserStake(stake);
          }
        } catch (err) {
          // Silent fail - not critical
          console.warn('[useLotteryData] User stake fetch failed:', err);
        }
      };
      fetchUserStake();
    }
  }, [isAuthReady, activeRound?.id]);

  return {
    activeRound,
    blockStats, // Return stats map instead of numbers array
    userStake,
    loading,
    error,
    refetch: fetchData,
  };
};

