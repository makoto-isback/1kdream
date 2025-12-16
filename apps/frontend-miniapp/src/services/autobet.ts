import api from './api';

export interface AutoBetPlan {
  id: string;
  userId: string;
  blocks: number[];
  betAmountPerBlock: number;
  roundsRemaining: number;
  totalRounds: number;
  totalLockedAmount: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutoBetDto {
  blocks: number[];
  betAmountPerBlock: number;
  totalRounds: number;
}

export const autobetService = {
  async createPlan(data: CreateAutoBetDto): Promise<AutoBetPlan> {
    const response = await api.post('/autobet', data);
    return response.data;
  },

  async cancelPlan(planId: string): Promise<AutoBetPlan> {
    const response = await api.post(`/autobet/${planId}/cancel`);
    return response.data;
  },

  async getUserPlans(): Promise<AutoBetPlan[]> {
    const response = await api.get('/autobet/my');
    return response.data;
  },
};

