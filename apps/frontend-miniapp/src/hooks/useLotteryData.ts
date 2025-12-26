/**
 * useLotteryData Hook
 * 
 * SOCKET-FIRST: Only uses socket events for data
 * HTTP is completely disabled when socket is connected
 * Subscribes to UserDataSync for state management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { LotteryRound } from '../services/lottery';
import { Bet } from '../services/bets';
import { useUserData } from './useUserData';
import { socketService } from '../services/socket';
import { userDataSync } from '../services/userDataSync';

// Type for block statistics (optional overlay data)
type BlockStats = {
  buyers: number;
  totalKyat: number;
};

export const useLotteryData = () => {
  const [activeRound, setActiveRound] = useState<LotteryRound | null>(null);
  const [blockStats, setBlockStats] = useState<Map<number, BlockStats>>(new Map());
  const [userStake, setUserStake] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const { isAuthReady, user } = useUserData();
  
  // Track if we've ever successfully loaded a round (prevents showing error if we have cached data)
  const hasLoadedRoundRef = useRef(false);
  // Track user bets for current round (socket-first, HTTP sync only)
  const userBetsRef = useRef<Bet[]>([]);
  // Refs for socket handlers to avoid stale closures
  const activeRoundRef = useRef<LotteryRound | null>(null);
  const userRef = useRef(user);

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

  useEffect(() => {
    // NO INITIAL HTTP FETCH - wait for socket events or UserDataSync
    
    // Sync initial state immediately from UserDataSync
    const initialRound = userDataSync.getData('activeRound');
    const initialBets = userDataSync.getData('bets') || [];
    console.log('[useLotteryData] Initial sync:', { hasRound: !!initialRound, betsCount: initialBets.length });
    if (initialRound) {
      setActiveRound(initialRound);
      activeRoundRef.current = initialRound;
      hasLoadedRoundRef.current = true;
    }
    if (initialBets.length > 0) {
      userBetsRef.current = initialBets;
      if (initialRound) {
        updateUserStakeFromBets(initialRound.id);
      }
    }
    
    // Connect to WebSocket for real-time updates
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      socketService.connect(token);

      // Subscribe to UserDataSync for active round
      // ALWAYS call setState to trigger React re-render
      const unsubscribeRound = userDataSync.subscribe('activeRound', (round: LotteryRound | null) => {
        console.log('[useLotteryData] Active round subscription callback fired:', round ? `round ${round.id}` : 'null');
        // ALWAYS update state to trigger re-render
        setActiveRound(round);
        activeRoundRef.current = round;
        if (round) {
          hasLoadedRoundRef.current = true;
          setError(null);
        }
      });

      // Subscribe to UserDataSync for user bets
      // ALWAYS call setState to trigger React re-render
      const unsubscribeBets = userDataSync.subscribe('bets', (bets: Bet[]) => {
        console.log('[useLotteryData] Bets subscription callback fired:', bets.length, 'bets');
        // ALWAYS update ref and state to trigger re-render
        userBetsRef.current = bets;
        if (activeRoundRef.current) {
          updateUserStakeFromBets(activeRoundRef.current.id);
        }
      });

      // Subscribe to UserDataSync for round stats
      // Round stats are updated by UserDataSync from socket events (bet:placed, round:stats:updated)
      // PERSISTENT: Socket subscriptions live in UserDataSync, never unsubscribe here
      // ALWAYS update - roundStats can exist even if activeRound is null
      const unsubscribeRoundStats = userDataSync.subscribe('roundStats', (roundStatsData: { roundId: string; stats: Record<number, { buyers: number; totalKyat: number }> } | null) => {
        console.log('[useLotteryData] Round stats subscription callback fired:', roundStatsData ? `round ${roundStatsData.roundId}, ${Object.keys(roundStatsData.stats || {}).length} blocks` : 'null');
        if (roundStatsData && roundStatsData.stats) {
          // Convert object back to Map
          const statsMap = new Map<number, BlockStats>();
          Object.entries(roundStatsData.stats).forEach(([blockNum, stat]) => {
            statsMap.set(parseInt(blockNum), {
              buyers: stat.buyers,
              totalKyat: stat.totalKyat,
            });
          });
          console.log('[useLotteryData] ✅ Updating blockStats Map:', { blockCount: statsMap.size });
          setBlockStats(statsMap);
        } else {
          console.log('[useLotteryData] ⚠️ roundStats is null or missing stats');
        }
      });

      // Sync initial round stats from UserDataSync
      const initialRoundStats = userDataSync.getData('roundStats');
      if (initialRoundStats && initialRoundStats.stats) {
        const statsMap = new Map<number, BlockStats>();
        Object.entries(initialRoundStats.stats).forEach(([blockNum, stat]: [string, any]) => {
          statsMap.set(parseInt(blockNum), {
            buyers: stat.buyers,
            totalKyat: stat.totalKyat,
          });
        });
        setBlockStats(statsMap);
      }

      // Cleanup on unmount
      // NOTE: Socket subscriptions (bet:placed, round:stats:updated, round:active:updated) 
      // are handled by UserDataSync and persist for app lifetime - do NOT unsubscribe here
      return () => {
        unsubscribeRound();
        unsubscribeBets();
        unsubscribeRoundStats();
        // DO NOT unsubscribe socket events - they live in UserDataSync
      };
    }

    // NO POLLING - socket is the only source of truth when connected
  }, [updateUserStakeFromBets, isAuthReady, user]);

  // Update refs when values change
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // NO useEffect for authReady/activeRound changes - socket handles all updates

  // Manual refetch (only for fallback when socket is disconnected)
  const refetch = useCallback(async () => {
    if (socketService.isConnected()) {
      console.log('[useLotteryData] Refetch blocked - socket is connected (socket-first rule)');
      return;
    }

    console.log('[useLotteryData] Manual refetch (socket disconnected, fallback mode)');
    try {
      // Use UserDataSync for fallback HTTP
      const round = await userDataSync.syncActiveRound();
      if (round) {
        setActiveRound(round);
        activeRoundRef.current = round;
        hasLoadedRoundRef.current = true;
        setError(null);
      }
    } catch (err: any) {
      if (!hasLoadedRoundRef.current) {
        setError(err.response?.data?.message || 'Failed to load lottery data');
      }
    }
  }, []);

  return {
    activeRound,
    blockStats,
    userStake,
    error,
    refetch,
  };
};
