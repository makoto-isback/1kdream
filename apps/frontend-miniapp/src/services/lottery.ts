import api from './api';

export interface LotteryRound {
  id: string;
  roundNumber: number;
  status: string;
  winningBlock: number | null;
  totalPool: number;
  adminFee: number;
  winnerPool: number;
  totalBets: number;
  drawTime: string;
  drawnAt: string | null;
}

export interface PoolInfo {
  activeRound: {
    roundNumber: number;
    totalPool: number;
    winnerPool: number;
    adminFee: number;
    totalBets: number;
    drawTime: string;
  } | null;
  latestRound: {
    roundNumber: number;
    winningBlock: number | null;
    totalPool: number;
    status: string;
    drawnAt: string | null;
  } | null;
}

export interface Winner {
  roundNumber: number;
  block: number;
  username: string;
  payout: number;
  drawnAt: string;
}

export interface RecentRound {
  roundNumber: number;
  winningBlock: number | null;
  winnersCount: number;
  totalPool: number;
  winnerPool: number;
  totalPayout: number;
  drawnAt: string | null;
}

export const lotteryService = {
  async getActiveRound(): Promise<LotteryRound | null> {
    const response = await api.get('/lottery/active');
    return response.data;
  },

  async getRoundStats(roundId: string) {
    const response = await api.get(`/lottery/round/${roundId}/stats`);
    return response.data;
  },

  async getPoolInfo(): Promise<PoolInfo> {
    const response = await api.get('/lottery/pool-info');
    return response.data;
  },

  async getWinnersFeed(limit = 20): Promise<Winner[]> {
    const response = await api.get('/lottery/winners-feed', { params: { limit } });
    return response.data;
  },

  async getRecentRounds(limit = 20): Promise<RecentRound[]> {
    const response = await api.get('/lottery/recent-rounds', { params: { limit } });
    return response.data;
  },
};

