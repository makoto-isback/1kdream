import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { UserDeposit, UserDepositStatus } from './entities/user-deposit.entity';
import { WithdrawRequest, WithdrawRequestStatus } from './entities/withdraw-request.entity';
import { TreasuryTransaction, TreasuryDirection } from './entities/treasury-transaction.entity';

@Injectable()
export class DailySummaryJob {
  private readonly logger = new Logger(DailySummaryJob.name);

  constructor(
    @InjectRepository(UserDeposit)
    private userDepositRepository: Repository<UserDeposit>,
    @InjectRepository(WithdrawRequest)
    private withdrawRequestRepository: Repository<WithdrawRequest>,
    @InjectRepository(TreasuryTransaction)
    private treasuryTxRepository: Repository<TreasuryTransaction>,
    private configService: ConfigService,
  ) {}

  /**
   * Daily summary and alerts
   * Runs at 00:00 UTC every day
   */
  @Cron('0 0 * * *')
  async generateDailySummary() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get deposits
      const deposits = await this.userDepositRepository.find({
        where: {
          createdAt: Between(today, tomorrow),
          status: UserDepositStatus.CONFIRMED,
        },
      });

      const totalDeposits = deposits.reduce((sum, d) => sum + parseFloat(d.kyatAmount), 0);

      // Get withdrawals
      const withdrawals = await this.withdrawRequestRepository.find({
        where: {
          createdAt: Between(today, tomorrow),
          status: WithdrawRequestStatus.COMPLETED,
        },
      });

      const totalWithdrawals = withdrawals.reduce((sum, w) => sum + parseFloat(w.kyatAmount), 0);

      // Get treasury transactions
      const treasuryIn = await this.treasuryTxRepository.find({
        where: {
          createdAt: Between(today, tomorrow),
          direction: TreasuryDirection.IN,
        },
      });

      const treasuryOut = await this.treasuryTxRepository.find({
        where: {
          createdAt: Between(today, tomorrow),
          direction: TreasuryDirection.OUT,
        },
      });

      const netFlow = totalDeposits - totalWithdrawals;

      // Generate summary
      const summary = {
        date: today.toISOString().split('T')[0],
        deposits: {
          count: deposits.length,
          totalKyat: totalDeposits,
        },
        withdrawals: {
          count: withdrawals.length,
          totalKyat: totalWithdrawals,
        },
        treasury: {
          inTransactions: treasuryIn.length,
          outTransactions: treasuryOut.length,
        },
        netFlow,
      };

      this.logger.log('[DAILY SUMMARY]', JSON.stringify(summary, null, 2));

      // Check for alerts
      await this.checkAlerts(summary, withdrawals);

      return summary;
    } catch (error) {
      this.logger.error('[DAILY SUMMARY] Error generating summary:', error);
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(summary: any, withdrawals: WithdrawRequest[]): Promise<void> {
    // Large withdrawal alert
    const largeWithdrawal = withdrawals.find((w) => parseFloat(w.kyatAmount) > 1000000);
    if (largeWithdrawal) {
      this.logger.warn(
        `[ALERT] Large withdrawal detected: ${largeWithdrawal.kyatAmount} KYAT by user ${largeWithdrawal.userId}`,
      );
    }

    // High-frequency withdrawals
    const userWithdrawalCounts = new Map<string, number>();
    withdrawals.forEach((w) => {
      const count = userWithdrawalCounts.get(w.userId) || 0;
      userWithdrawalCounts.set(w.userId, count + 1);
    });

    for (const [userId, count] of userWithdrawalCounts.entries()) {
      if (count > 5) {
        this.logger.warn(`[ALERT] High-frequency withdrawals: User ${userId} made ${count} withdrawals today`);
      }
    }

    // Negative net flow (more withdrawals than deposits)
    if (summary.netFlow < 0) {
      this.logger.warn(`[ALERT] Negative net flow: ${summary.netFlow} KYAT (more withdrawals than deposits)`);
    }

    // TODO: Add treasury balance check when balance query is available
    // TODO: Add Telegram bot alerts when configured
  }
}

