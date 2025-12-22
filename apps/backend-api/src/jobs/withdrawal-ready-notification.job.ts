import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Withdrawal, WithdrawalStatus } from '../modules/wallet/withdrawals/entities/withdrawal.entity';
import { UsersService } from '../modules/users/users.service';
import { TelegramNotificationService } from '../services/telegram-notification.service';

@Injectable()
export class WithdrawalReadyNotificationJob {
  private readonly logger = new Logger(WithdrawalReadyNotificationJob.name);

  constructor(
    @InjectRepository(Withdrawal)
    private withdrawalsRepository: Repository<Withdrawal>,
    private usersService: UsersService,
    private telegramNotificationService: TelegramNotificationService,
  ) {}

  /**
   * Check for withdrawals ready to process (1 hour has passed)
   * Runs every 5 minutes
   */
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkReadyWithdrawals() {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Find pending withdrawals requested more than 1 hour ago
      const readyWithdrawals = await this.withdrawalsRepository.find({
        where: {
          status: WithdrawalStatus.PENDING,
          requestTime: LessThanOrEqual(oneHourAgo),
        },
        relations: ['user'],
        take: 10, // Process max 10 at a time
      });

      if (readyWithdrawals.length === 0) {
        return;
      }

      this.logger.log(`[WITHDRAWAL READY] Found ${readyWithdrawals.length} withdrawal(s) ready to process`);

      for (const withdrawal of readyWithdrawals) {
        try {
          // Only send notification if user exists
          const user = withdrawal.user || await this.usersService.findOne(withdrawal.userId);
          
          if (user) {
            await this.telegramNotificationService.notifyWithdrawalReady(
              {
                id: withdrawal.id,
                kyatAmount: withdrawal.kyatAmount,
                usdtAmount: withdrawal.usdtAmount,
                tonAddress: withdrawal.tonAddress,
                requestTime: withdrawal.requestTime,
              },
              {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
              },
            );
          }
        } catch (error) {
          this.logger.error(`[WITHDRAWAL READY] Error notifying for withdrawal ${withdrawal.id}:`, error);
          // Continue with next withdrawal
        }
      }
    } catch (error) {
      this.logger.error('[WITHDRAWAL READY] Error checking ready withdrawals:', error);
      // Don't throw - job must continue running
    }
  }
}

