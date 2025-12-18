import api from './api';

export interface ActivationStatus {
  isActivated: boolean;
  activatedAt: string | null;
}

export interface ActivationWalletInfo {
  address: string;
  amount: string; // "1" TON
}

export interface VerifyActivationDto {
  txHash: string;
  walletAddress: string;
}

export const activationService = {
  async getStatus(): Promise<ActivationStatus> {
    const response = await api.get('/activation/status');
    return response.data;
  },

  async getWalletAddress(): Promise<ActivationWalletInfo> {
    const response = await api.get('/activation/wallet-address');
    return response.data;
  },

  async verifyActivation(dto: VerifyActivationDto): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/activation/verify', dto);
    return response.data;
  },
};

