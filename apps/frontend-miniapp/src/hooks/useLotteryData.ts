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
  const [loading, setLoading] = useState(false);
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
    
    // Connect to WebSocket for real-time updates
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      socketService.connect(token);

      // Subscribe to UserDataSync for active round
      const unsubscribeRound = userDataSync.subscribe('activeRound', (round: LotteryRound | null) => {
        if (round) {
          console.log('[useLotteryData] Active round updated from UserDataSync');
          setActiveRound(round);
          activeRoundRef.current = round;
          hasLoadedRoundRef.current = true;
          setError(null);
        }
      });

      // Subscribe to UserDataSync for user bets
      const unsubscribeBets = userDataSync.subscribe('bets', (bets: Bet[]) => {
        console.log('[useLotteryData] User bets updated from UserDataSync');
        userBetsRef.current = bets;
        if (activeRoundRef.current) {
          updateUserStakeFromBets(activeRoundRef.current.id);
        }
      });

      // Subscribe to bet:placed events - update pool and stats immediately (SOCKET-FIRST)
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
      const unsubscribeRoundSocket = socketService.onActiveRoundUpdated((data) => {
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
          drawTime: data.drawTime,
          winningBlock: data.winningBlock,
          drawnAt: data.drawnAt || null,
        } as LotteryRound;
        
        setActiveRound(newRound);
        activeRoundRef.current = newRound; // Update ref
        hasLoadedRoundRef.current = true;
        setError(null);

        // Update UserDataSync
        userDataSync.updateActiveRoundFromSocket(newRound);

        // If round changed, reset user bets for NEW round only
        // Don't reset during auth transitions - only when round actually changes
        if (isAuthReady && user && activeRoundRef.current?.id !== newRound.id) {
          userBetsRef.current = [];
          setUserStake(0);
        }
      });

      // Cleanup on unmount
      return () => {
        unsubscribeRound();
        unsubscribeBets();
        unsubscribeBet();
        unsubscribeStats();
        unsubscribeRoundSocket();
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
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    activeRound,
    blockStats,
    userStake,
    loading,
    error,
    refetch,
  };
};
