import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UsdtWithdrawalsService } from '../modules/wallet/usdt-withdrawals/usdt-withdrawals.service';

@Injectable()
export class UsdtWithdrawalExecutionJob {
  private readonly logger = new Logger(UsdtWithdrawalExecutionJob.name);

  constructor(private usdtWithdrawalsService: UsdtWithdrawalsService) {}

  /**
   * Process pending USDT withdrawals every minute
   * Finds withdrawals where status = signed AND now >= executeAfter
   */
  @Cron('* * * * *') // Every minute
  async processPendingWithdrawals() {
    try {
      const processedCount = await this.usdtWithdrawalsService.processPendingWithdrawals();
      if (processedCount > 0) {
        this.logger.log(`[USDT WITHDRAWAL JOB] Processed ${processedCount} withdrawal(s)`);
      }
    } catch (error) {
      this.logger.error('[USDT WITHDRAWAL JOB] Error processing withdrawals:', error);
    }
  }
}

