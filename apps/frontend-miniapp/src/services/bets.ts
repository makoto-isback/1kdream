import api from './api';

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

export const betsService = {
  async placeBet(blockNumber: number, amount: number): Promise<Bet> {
    const response = await api.post('/bets', { blockNumber, amount });
    return response.data;
  },

  async getUserBets(limit = 50): Promise<Bet[]> {
    const response = await api.get('/bets/my', { params: { limit } });
    return response.data;
  },
};

