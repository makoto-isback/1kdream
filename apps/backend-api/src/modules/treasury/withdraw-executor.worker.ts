import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { TonService } from '../../ton/ton.service';
import { TreasuryService } from './treasury.service';
import { WithdrawRequest, WithdrawRequestStatus } from './entities/withdraw-request.entity';
import { TreasuryTransaction, TreasuryDirection, TreasuryAsset } from './entities/treasury-transaction.entity';
import {
  MIN_WITHDRAW_KYAT,
  MAX_WITHDRAW_KYAT_PER_DAY,
  KYAT_PER_USDT,
} from './constants/treasury.constants';

@Injectable()
export class WithdrawExecutorWorker implements OnModuleInit {
  private readonly logger = new Logger(WithdrawExecutorWorker.name);
  private isEnabled: boolean = false;

  constructor(
    @InjectRepository(WithdrawRequest)
    private withdrawRequestRepository: Repository<WithdrawRequest>,
    @InjectRepository(TreasuryTransaction)
    private treasuryTxRepository: Repository<TreasuryTransaction>,
    private tonService: TonService,
    private treasuryService: TreasuryService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Strict flag check: only enable if env value is exactly the string "true"
    const flagValue = this.configService.get('WITHDRAW_EXECUTOR_ENABLED');
    const withdrawExecutorEnabled = flagValue === 'true';
    const isDev = this.configService.get('NODE_ENV') === 'development';

    // Log current flag state for debugging
    this.logger.log(`[WITHDRAW EXECUTOR] Flag value: "${flagValue}" (type: ${typeof flagValue})`);

    if (isDev && !withdrawExecutorEnabled) {
      this.logger.warn('[WITHDRAW EXECUTOR] ❌ DISABLED - Development mode and flag not set to "true"');
      this.isEnabled = false;
      return;
    }

    if (!withdrawExecutorEnabled) {
      this.logger.warn('[WITHDRAW EXECUTOR] ❌ DISABLED - WITHDRAW_EXECUTOR_ENABLED must be exactly "true"');
      this.logger.warn('[WITHDRAW EXECUTOR] Current value:', flagValue === undefined ? 'undefined' : `"${flagValue}"`);
      this.isEnabled = false;
      return;
    }

    this.isEnabled = true;
    this.logger.log('[WITHDRAW EXECUTOR] ✅ ENABLED - Worker initialized and running');
  }

  /**
   * Process pending withdraw requests
   * Runs every minute
   */
  @Cron('* * * * *') // Every minute
  async processPendingWithdrawals() {
    if (!this.isEnabled) {
      return;
    }

    try {
      const now = new Date();

      // Find pending requests ready to execute
      const pendingRequests = await this.withdrawRequestRepository.find({
        where: {
          status: WithdrawRequestStatus.PENDING,
          executeAfter: LessThanOrEqual(now),
        },
        relations: ['user'],
        take: 10, // Process max 10 at a time
      });

      if (pendingRequests.length === 0) {
        return;
      }

      this.logger.log(`[WITHDRAW EXECUTOR] Processing ${pendingRequests.length} pending withdrawal(s)`);

      for (const request of pendingRequests) {
        try {
          await this.executeWithdrawal(request);
        } catch (error) {
          this.logger.error(
            `[WITHDRAW EXECUTOR] Error processing withdrawal ${request.id}:`,
            error,
          );
          // Continue with next request - don't block others
        }
      }
    } catch (error) {
      this.logger.error('[WITHDRAW EXECUTOR] Error in processPendingWithdrawals:', error);
      // Don't throw - worker must continue running
    }
  }

  /**
   * Execute a single withdrawal
   */
  private async executeWithdrawal(request: WithdrawRequest): Promise<void> {
    try {
      // Check daily limit
      const dailyWithdrawn = await this.treasuryService.getDailyWithdrawLimit(request.userId);
      const kyatAmount = parseFloat(request.kyatAmount);

      if (dailyWithdrawn + kyatAmount > MAX_WITHDRAW_KYAT_PER_DAY) {
        this.logger.warn(
          `[WITHDRAW EXECUTOR] Daily limit exceeded for user ${request.userId}: ${dailyWithdrawn} + ${kyatAmount} > ${MAX_WITHDRAW_KYAT_PER_DAY}`,
        );
        request.status = WithdrawRequestStatus.REJECTED;
        await this.withdrawRequestRepository.save(request);
        return;
      }

      // Check user balance (additive check - does not modify lottery balance logic)
      const user = request.user;
      const userBalance = parseFloat(user.kyatBalance.toString());

      if (userBalance < kyatAmount) {
        this.logger.warn(
          `[WITHDRAW EXECUTOR] Insufficient balance for user ${request.userId}: ${userBalance} < ${kyatAmount}`,
        );
        request.status = WithdrawRequestStatus.REJECTED;
        await this.withdrawRequestRepository.save(request);
        return;
      }

      // Calculate USDT amount
      const usdtAmount = kyatAmount / KYAT_PER_USDT;

      // Send USDT to destination address
      this.logger.log(
        `[WITHDRAW EXECUTOR] Executing withdrawal: ${kyatAmount} KYAT (${usdtAmount} USDT) to ${request.destinationAddress}`,
      );

      const payoutTxHash = await this.tonService.sendUsdt(request.destinationAddress, usdtAmount);

      // Update request status
      request.status = WithdrawRequestStatus.COMPLETED;
      request.payoutTxHash = payoutTxHash;
      await this.withdrawRequestRepository.save(request);

      // Deduct balance (additive - isolated from lottery logic)
      user.kyatBalance = parseFloat((userBalance - kyatAmount).toFixed(2));
      const repos = this.treasuryService.getRepositories();
      await repos.userRepository.save(user);

      // Update daily limit
      await this.treasuryService.updateDailyWithdrawLimit(request.userId, kyatAmount);

      // Record treasury OUT transaction
      await this.treasuryService.saveTreasuryTransaction(
        payoutTxHash,
        TreasuryDirection.OUT,
        TreasuryAsset.USDT,
        usdtAmount.toFixed(18),
        `withdraw:${request.userId}:${kyatAmount}:${request.destinationAddress}`,
      );

      this.logger.log(
        `[WITHDRAW EXECUTOR] Withdrawal completed: ${request.id}, tx: ${payoutTxHash}`,
      );
    } catch (error) {
      this.logger.error(`[WITHDRAW EXECUTOR] Error executing withdrawal ${request.id}:`, error);
      // Mark as rejected on error (can be manually reviewed later)
      request.status = WithdrawRequestStatus.REJECTED;
      await this.withdrawRequestRepository.save(request);
      throw error;
    }
  }
}

