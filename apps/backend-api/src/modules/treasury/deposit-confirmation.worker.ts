import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TonService } from '../../ton/ton.service';
import { TreasuryService } from './treasury.service';
import { UserDeposit, UserDepositStatus } from './entities/user-deposit.entity';

@Injectable()
export class DepositConfirmationWorker implements OnModuleInit {
  private readonly logger = new Logger(DepositConfirmationWorker.name);
  private isEnabled: boolean = false;
  private readonly REQUIRED_CONFIRMATIONS = 3; // Number of block confirmations required

  constructor(
    @InjectRepository(UserDeposit)
    private userDepositRepository: Repository<UserDeposit>,
    private tonService: TonService,
    private treasuryService: TreasuryService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const depositConfirmationEnabled = this.configService.get('DEPOSIT_CONFIRMATION_ENABLED') === 'true';
    const isDev = this.configService.get('NODE_ENV') === 'development';

    if (isDev && !depositConfirmationEnabled) {
      this.logger.warn('[DEPOSIT CONFIRMATION] Disabled in development mode');
      this.isEnabled = false;
      return;
    }

    if (!depositConfirmationEnabled) {
      this.logger.warn('[DEPOSIT CONFIRMATION] Disabled (DEPOSIT_CONFIRMATION_ENABLED !== true)');
      this.isEnabled = false;
      return;
    }

    this.isEnabled = true;
    this.logger.log('[DEPOSIT CONFIRMATION] Worker initialized and enabled');
  }

  /**
   * Check pending deposits and confirm when enough confirmations
   * Runs every 2 minutes
   */
  @Cron('*/2 * * * *')
  async confirmPendingDeposits() {
    if (!this.isEnabled) {
      return;
    }

    try {
      const pendingDeposits = await this.userDepositRepository.find({
        where: { status: UserDepositStatus.PENDING },
        take: 20, // Process max 20 at a time
      });

      if (pendingDeposits.length === 0) {
        return;
      }

      this.logger.debug(`[DEPOSIT CONFIRMATION] Checking ${pendingDeposits.length} pending deposit(s)`);

      for (const deposit of pendingDeposits) {
        try {
          const confirmations = await this.tonService.getTransactionConfirmations(deposit.txHash);

          if (confirmations >= this.REQUIRED_CONFIRMATIONS) {
            await this.treasuryService.confirmDeposit(deposit.id);
            this.logger.log(
              `[DEPOSIT CONFIRMATION] Deposit ${deposit.id} confirmed (${confirmations} confirmations)`,
            );
          }
        } catch (error) {
          this.logger.error(`[DEPOSIT CONFIRMATION] Error checking deposit ${deposit.id}:`, error);
          // Continue with next deposit
        }
      }
    } catch (error) {
      this.logger.error('[DEPOSIT CONFIRMATION] Error in confirmPendingDeposits:', error);
      // Don't throw - worker must continue running
    }
  }
}

