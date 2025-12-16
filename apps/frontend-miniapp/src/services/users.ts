import api from './api';

export interface User {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  kyatBalance: number;
  points: number;
  tonAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTonAddressDto {
  tonAddress: string;
}

export const usersService = {
  async getMe(): Promise<User> {
    const response = await api.get('/users/me');
    return response.data;
  },

  async updateTonAddress(tonAddress: string): Promise<User> {
    const response = await api.post('/users/ton-address', { tonAddress });
    return response.data;
  },
};

