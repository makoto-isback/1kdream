import api from './api';

export interface Deposit {
  id: string;
  userId: string;
  usdtAmount: number;
  kyatAmount: number;
  tonTxHash: string;
  senderTonAddress: string | null;
  status: 'pending' | 'pending_manual' | 'confirmed' | 'failed';
  confirmedAt: string | null;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  kyatAmount: number;
  usdtAmount: number;
  tonAddress: string;
  tonTxHash: string | null;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestTime: string;
  processedAt: string | null;
  createdAt: string;
}

export interface CreateDepositDto {
  usdtAmount: number;
}

export interface CreateWithdrawalDto {
  kyatAmount: number;
  tonAddress: string;
}

export const walletService = {
  async createDepositRequest(data: CreateDepositDto): Promise<Deposit> {
    const response = await api.post('/deposits', data);
    return response.data;
  },

  async getDepositAddress(): Promise<{ address: string; memo: string; depositId: string }> {
    const response = await api.get('/deposits/address');
    return response.data;
  },

  async getUserDeposits(): Promise<Deposit[]> {
    const response = await api.get('/deposits/my');
    return response.data;
  },

  async createWithdrawalRequest(data: CreateWithdrawalDto): Promise<Withdrawal> {
    const response = await api.post('/withdrawals', data);
    return response.data;
  },

  async getUserWithdrawals(): Promise<Withdrawal[]> {
    const response = await api.get('/withdrawals/my');
    return response.data;
  },
};

