import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address } from '@ton/core';
import axios from 'axios';

@Injectable()
export class TonService {
  private readonly logger = new Logger(TonService.name);
  private walletAddress: string;
  private network: string;
  private tonApiUrl: string;

  constructor(private configService: ConfigService) {
    this.walletAddress = this.configService.get('TON_WALLET_ADDRESS') || '';
    this.network = this.configService.get('TON_NETWORK') || 'mainnet';
    this.tonApiUrl = this.configService.get('TON_API_URL') || 'https://tonapi.io/v2';
  }

  getWalletAddress(): string {
    return this.walletAddress;
  }

  isValidAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for new USDT Jetton transfers to wallet address
   * USDT on TON uses Jetton standard
   */
  async checkUsdtTransfers(since?: number): Promise<any[]> {
    try {
      if (!this.walletAddress) {
        this.logger.warn('TON wallet address not configured');
        return [];
      }

      // Parse wallet address
      const address = Address.parse(this.walletAddress);
      const addressString = address.toString({ urlSafe: true, bounceable: false });

      // Query TON API for jetton transfers
      // USDT on TON is a jetton with specific master address
      const usdtJettonMaster = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // USDT Jetton Master on mainnet
      
      const response = await axios.get(`${this.tonApiUrl}/accounts/${addressString}/jettons`, {
        params: {
          limit: 100,
          ...(since && { start_lt: since }),
        },
        headers: {
          'Authorization': `Bearer ${this.configService.get('TON_API_KEY')}`,
        },
      });

      // Filter for USDT jetton transfers
      const transfers = response.data?.balances || [];
      const usdtTransfers = transfers.filter(
        (transfer: any) => transfer.jetton?.address === usdtJettonMaster
      );

      return usdtTransfers;
    } catch (error) {
      this.logger.error('Error checking USDT transfers:', error);
      return [];
    }
  }

  /**
   * Get transaction details for a specific hash
   */
  async getTransaction(txHash: string): Promise<any> {
    try {
      const response = await axios.get(`${this.tonApiUrl}/blockchain/transactions/${txHash}`, {
        headers: {
          'Authorization': `Bearer ${this.configService.get('TON_API_KEY')}`,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Error getting transaction ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Send USDT via Jetton transfer
   * Note: This requires wallet implementation with private key
   * For production, use a secure wallet service
   */
  async sendUsdt(toAddress: string, amount: number): Promise<string> {
    try {
      // In production, this would:
      // 1. Use TON wallet SDK to create jetton transfer
      // 2. Sign transaction with private key
      // 3. Broadcast to TON network
      // 4. Return transaction hash
      
      this.logger.log(`Sending ${amount} USDT to ${toAddress}`);
      
      // Placeholder - implement with actual TON wallet
      // For now, return empty string (manual processing)
      return '';
    } catch (error) {
      this.logger.error('Error sending USDT:', error);
      throw error;
    }
  }

  /**
   * Parse USDT amount from jetton transfer
   */
  parseUsdtAmount(transfer: any): number {
    try {
      // USDT uses 6 decimals on TON
      const amount = transfer.balance || transfer.amount || '0';
      return parseFloat(amount) / 1e6; // Convert from nano units
    } catch (error) {
      this.logger.error('Error parsing USDT amount:', error);
      return 0;
    }
  }
}
