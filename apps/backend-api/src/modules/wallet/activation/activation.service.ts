import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { TonService } from '../../../ton/ton.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private usersService: UsersService,
    private tonService: TonService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify 1 TON activation transaction and activate user
   */
  async verifyAndActivate(userId: string, txHash: string, walletAddress: string): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findOne(userId);

    // Check if already activated
    if (user.isActivated) {
      return {
        success: true,
        message: 'User already activated',
      };
    }

    // Get platform wallet address from config
    const platformWallet = this.configService.get('TON_WALLET_ADDRESS');
    if (!platformWallet) {
      throw new BadRequestException('Platform wallet not configured');
    }

    // Verify transaction on-chain
    const transaction = await this.tonService.getTransaction(txHash);
    if (!transaction) {
      throw new BadRequestException('Transaction not found on blockchain');
    }

    // Verify transaction details
    const inMsg = transaction.in_msg;
    if (!inMsg) {
      throw new BadRequestException('Invalid transaction: no incoming message');
    }

    // Verify recipient is platform wallet
    const dest = inMsg.destination?.address || inMsg.destination;
    if (!dest) {
      throw new BadRequestException('Invalid transaction: no destination address');
    }

    try {
      const destAddress = this.tonService.isValidAddress(dest) ? dest : null;
      if (!destAddress || destAddress !== platformWallet) {
        throw new BadRequestException('Transaction recipient does not match platform wallet');
      }
    } catch (error) {
      throw new BadRequestException('Invalid destination address format');
    }

    // Verify sender matches wallet address
    const sender = inMsg.source?.address || inMsg.source;
    if (!sender || sender !== walletAddress) {
      throw new BadRequestException('Transaction sender does not match wallet address');
    }

    // Verify amount is approximately 1 TON (allow small variance for fees)
    const tonAmount = this.tonService.parseTonAmount(transaction);
    if (tonAmount < 0.9 || tonAmount > 1.1) {
      throw new BadRequestException(`Invalid activation amount: ${tonAmount} TON (expected ~1 TON)`);
    }

    // All checks passed - activate user
    await this.usersService.activateUser(userId);
    
    this.logger.log(`[ACTIVATION] User ${userId} activated successfully with transaction ${txHash}`);

    return {
      success: true,
      message: 'User activated successfully',
    };
  }

  /**
   * Get activation status for user
   */
  async getActivationStatus(userId: string): Promise<{ isActivated: boolean; activatedAt: Date | null }> {
    return await this.usersService.checkActivationStatus(userId);
  }

  /**
   * Get platform wallet address for activation fee
   */
  getPlatformWalletAddress(): string {
    const platformWallet = this.configService.get('TON_WALLET_ADDRESS');
    if (!platformWallet) {
      throw new BadRequestException('Platform wallet not configured');
    }
    return platformWallet;
  }
}

