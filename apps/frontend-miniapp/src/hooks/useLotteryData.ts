import { useState, useEffect, useRef, useCallback } from 'react';
import { lotteryService, LotteryRound } from '../services/lottery';
import { betsService, Bet } from '../services/bets';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { socketService } from '../services/socket';
import { createDebouncedFetch } from '../utils/debounce';
import { guardFetch } from '../utils/fetchGuard';

// Type for block statistics (optional overlay data)
type BlockStats = {
  buyers: number;
  totalKyat: number;
};

export const useLotteryData = () => {
  const [activeRound, setActiveRound] = useState<LotteryRound | null>(null);
  const [blockStats, setBlockStats] = useState<Map<number, BlockStats>>(new Map());
  const [userStake, setUserStake] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthReady, user } = useAuth();
  
  // Track if we've ever successfully loaded a round (prevents showing error if we have cached data)
  const hasLoadedRoundRef = useRef(false);
  // Track if there's a fetch in progress (prevents race conditions)
  const isFetchingRef = useRef(false);
  // Track user bets for current round (socket-first, HTTP sync only)
  const userBetsRef = useRef<Bet[]>([]);
  // Refs for socket handlers to avoid stale closures
  const activeRoundRef = useRef<LotteryRound | null>(null);
  const isAuthReadyRef = useRef(false);
  const userRef = useRef(user);

  // Debounced fetch for round stats (3 second debounce, shared across calls)
  const debouncedFetchRoundStats = useRef(
    createDebouncedFetch(
      guardFetch(
        'fetchRoundStats',
        async (roundId: string) => {
          const statsResponse = await api.get(`/lottery/round/${roundId}/stats`);
          return statsResponse.data;
        }
      ),
      3000
    )
  ).current;

  // Debounced fetch for user bets (3 second debounce, shared across calls)
  const debouncedFetchUserBets = useRef(
    createDebouncedFetch(
      guardFetch(
        'fetchUserBets',
        async () => {
          const userBets = await betsService.getUserBets(100);
          return userBets;
        }
      ),
      3000
    )
  ).current;

  // Update user stake from tracked bets
  const updateUserStakeFromBets = useCallback((roundId: string | null) => {
    if (!roundId) {
      setUserStake(0);
      return;
    }
    const roundBets = userBetsRef.current.filter(bet => bet.lotteryRoundId === roundId);
    const stake = roundBets.reduce((sum, bet) => sum + Number(bet.amount), 0);
    setUserStake(stake);
  }, []);

  // Sync user bets from server (debounced, only called when needed)
  const syncUserBets = useCallback(async (roundId: string) => {
    if (!isAuthReady) return;
    
    try {
      const userBets = await debouncedFetchUserBets();
      userBetsRef.current = userBets;
      updateUserStakeFromBets(roundId);
    } catch (err) {
      // Silent fail - socket updates will handle it
      console.warn('[useLotteryData] User bets sync failed (non-critical):', err);
    }
  }, [isAuthReady, debouncedFetchUserBets, updateUserStakeFromBets]);

  // Sync round stats from server (debounced, only called when needed)
  const syncRoundStats = useCallback(async (roundId: string) => {
    try {
      const statsData = await debouncedFetchRoundStats(roundId);
      const blockStatsArray = statsData.blockStats || [];
      
      const statsMap = new Map<number, BlockStats>();
      blockStatsArray.forEach((stat: any, index: number) => {
        statsMap.set(index + 1, {
          buyers: stat.totalBets || 0,
          totalKyat: stat.totalAmount || 0,
        });
      });
      
      setBlockStats(statsMap);
    } catch (err) {
      // Silent fail - socket updates will handle it
      console.warn('[useLotteryData] Round stats sync failed (non-critical):', err);
    }
  }, [debouncedFetchRoundStats]);

  const fetchData = async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('[useLotteryData] Fetch already in progress, skipping...');
      return;
    }

    isFetchingRef.current = true;
    
    try {
      setLoading(true);
      
      // Fetch active round - don't require auth for this
      const round = await lotteryService.getActiveRound();
      
      // Successfully got a response (even if null)
      if (round) {
        // We have a round - clear error and update state
        setError(null);
        setActiveRound(round);
        activeRoundRef.current = round; // Update ref for socket handlers
        hasLoadedRoundRef.current = true;

        // Sync stats and user bets (debounced, won't spam)
        syncRoundStats(round.id);
        if (isAuthReady) {
          syncUserBets(round.id);
        }
      } else {
        // API returned null (no active round exists)
        // Only show error if we've never successfully loaded a round
        // If we have cached data, keep using it and don't show error
        if (!hasLoadedRoundRef.current) {
          setError('No active round available');
        } else {
          // We have cached data, don't show error for temporary "no round" responses
          setError(null);
        }
        // Don't clear activeRound - keep using cached data
        setBlockStats(new Map());
      }
    } catch (err: any) {
      // API call failed (network error, timeout, 500, etc.)
      // Only set error if we've never successfully loaded a round
      if (!hasLoadedRoundRef.current) {
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
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Fetch immediately - don't wait for auth
    // Blocks render instantly, stats update when API responds
    fetchData();

    // Connect to WebSocket for real-time updates
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      socketService.connect(token);

      // Subscribe to bet:placed events - update pool, stats, and user stake immediately (SOCKET-FIRST)
      const unsubscribeBet = socketService.onBetPlaced((data) => {
        console.log('[useLotteryData] Received bet:placed event', data);
        
        // Use ref to avoid stale closure
        const currentRound = activeRoundRef.current;
        
        // Update active round pool if it's the current round
        if (currentRound?.id === data.roundId) {
          setActiveRound(prev => {
            const updated = prev ? {
              ...prev,
              totalPool: data.totalPool,
              winnerPool: data.winnerPool,
              adminFee: data.adminFee,
            } : null;
            activeRoundRef.current = updated; // Update ref
            return updated;
          });
          
          // Update block stats from socket (instant, no HTTP)
          const statsMap = new Map<number, BlockStats>();
          data.blockStats.forEach((stat) => {
            statsMap.set(stat.blockNumber, {
              buyers: stat.totalBets || 0,
              totalKyat: stat.totalAmount || 0,
            });
          });
          setBlockStats(statsMap);

          // Optimistically update user stake if this is the user's bet
          // We'll sync from server later (debounced) to get exact value
          // For now, we can't tell if it's the user's bet from the event, so we'll sync
          // But we do it debounced to avoid spam
          if (isAuthReadyRef.current && userRef.current) {
            // Schedule a debounced sync (won't trigger immediately)
            setTimeout(() => {
              syncUserBets(data.roundId);
            }, 100);
          }
        }
      });

      // Subscribe to round:stats:updated events (SOCKET-FIRST, no HTTP)
      const unsubscribeStats = socketService.onRoundStatsUpdated((data) => {
        console.log('[useLotteryData] Received round:stats:updated event', data);
        
        // Use ref to avoid stale closure
        const currentRound = activeRoundRef.current;
        
        if (currentRound?.id === data.roundId) {
          // Update block stats instantly from socket
          const statsMap = new Map<number, BlockStats>();
          data.blockStats.forEach((stat) => {
            statsMap.set(stat.blockNumber, {
              buyers: stat.totalBets || 0,
              totalKyat: stat.totalAmount || 0,
            });
          });
          setBlockStats(statsMap);
        }
      });

      // Subscribe to round:active:updated events (SOCKET-FIRST, no HTTP)
      const unsubscribeRound = socketService.onActiveRoundUpdated((data) => {
        console.log('[useLotteryData] Received round:active:updated event', data);
        
        // Update active round instantly from socket
        const newRound = {
          id: data.id,
          roundNumber: data.roundNumber,
          status: data.status,
          totalPool: data.totalPool,
          winnerPool: data.winnerPool,
          adminFee: data.adminFee,
          totalBets: data.totalBets,
          drawTime: data.drawTime, // Keep as string to match LotteryRound type
          winningBlock: data.winningBlock,
          drawnAt: data.drawnAt || null,
        } as LotteryRound;
        
        setActiveRound(newRound);
        activeRoundRef.current = newRound; // Update ref
        hasLoadedRoundRef.current = true;
        setError(null);

        // If round changed, reset user bets and sync (debounced)
        // Use refs to avoid stale closure
        if (isAuthReadyRef.current && userRef.current) {
          userBetsRef.current = [];
          setUserStake(0);
          // Sync user bets for new round (debounced)
          setTimeout(() => {
            syncUserBets(newRound.id);
          }, 100);
        }
      });

      // Cleanup on unmount
      return () => {
        unsubscribeBet();
        unsubscribeStats();
        unsubscribeRound();
      };
    }

    // Fallback: Keep a slow polling interval (60 seconds) as backup in case WebSocket fails
    const fallbackInterval = setInterval(fetchData, 60000);
    return () => clearInterval(fallbackInterval);
  }, [syncUserBets, syncRoundStats, updateUserStakeFromBets]); // Include dependencies for socket handlers

  // Update refs when values change
  useEffect(() => {
    isAuthReadyRef.current = isAuthReady;
  }, [isAuthReady]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync user bets when round changes (debounced, only if needed)
  useEffect(() => {
    if (isAuthReady && activeRound && user) {
      // Initial sync when round loads (debounced)
      syncUserBets(activeRound.id);
    }
  }, [isAuthReady, activeRound?.id, user, syncUserBets]);

  return {
    activeRound,
    blockStats, // Return stats map instead of numbers array
    userStake,
    loading,
    error,
    refetch: fetchData,
  };
};

