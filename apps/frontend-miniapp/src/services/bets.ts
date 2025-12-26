import api from './api';
import { guardFetch } from '../utils/fetchGuard';

export interface Bet {
  id: string;
  userId: string;
  lotteryRoundId: string;
  blockNumber: number;
  amount: number;
  payout: number | null;
  isWinner: boolean;
  createdAt: string;
}

export interface CreateBetDto {
  blockNumber: number;
  amount: number;
}

// Guarded fetch function to prevent duplicate simultaneous calls
const guardedGetUserBets = guardFetch(
  'getUserBets',
  async (limit: number = 50): Promise<Bet[]> => {
    const response = await api.get('/bets/my', { params: { limit } });
    return response.data;
  }
);

export const betsService = {
  async placeBet(blockNumber: number, amount: number): Promise<Bet> {
    const response = await api.post('/bets', { blockNumber, amount });
    return response.data;
  },

  async getUserBets(limit = 50): Promise<Bet[]> {
    return guardedGetUserBets(limit);
  },
};

