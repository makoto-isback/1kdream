import api from './api';

export interface UsdtWithdrawal {
  id: string;
  userId: string;
  usdtAmount: number;
  kyatAmount: number;
  tonAddress: string;
  status: 'signed' | 'queued' | 'sent' | 'failed';
  signedAt: string;
  executeAfter: string;
  tonTxHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUsdtWithdrawalDto {
  kyatAmount: number;
  tonAddress: string;
}

export const usdtWithdrawalService = {
  async createWithdrawal(dto: CreateUsdtWithdrawalDto): Promise<UsdtWithdrawal> {
    const response = await api.post('/usdt/withdraw', dto);
    return response.data;
  },

  async getMyWithdrawals(): Promise<UsdtWithdrawal[]> {
    const response = await api.get('/usdt/withdraw/my');
    return response.data;
  },
};

