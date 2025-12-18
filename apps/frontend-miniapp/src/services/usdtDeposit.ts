import api from './api';

export interface UsdtDeposit {
  id: string;
  userId: string;
  txHash: string;
  usdtAmount: number;
  kyatAmount: number;
  status: 'pending' | 'confirmed';
  createdAt: string;
}

export interface CreateUsdtDepositDto {
  txHash: string;
  kyatAmount: number;
  walletAddress: string;
}

export const usdtDepositService = {
  async createDeposit(dto: CreateUsdtDepositDto): Promise<UsdtDeposit> {
    const response = await api.post('/usdt/deposit', dto);
    return response.data;
  },

  async getMyDeposits(): Promise<UsdtDeposit[]> {
    const response = await api.get('/usdt/deposit/my');
    return response.data;
  },
};

