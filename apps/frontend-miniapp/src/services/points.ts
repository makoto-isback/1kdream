import api from './api';

export interface PointsRedemption {
  id: string;
  userId: string;
  pointsUsed: number;
  kyatGranted: number;
  createdAt: string;
}

export interface RedeemPointsDto {
  points: number;
}

export const pointsService = {
  async redeemPoints(points: number): Promise<PointsRedemption> {
    const response = await api.post('/points/redeem', { points });
    return response.data;
  },

  async getUserRedemptions(): Promise<PointsRedemption[]> {
    const response = await api.get('/points/redemptions');
    return response.data;
  },
};

