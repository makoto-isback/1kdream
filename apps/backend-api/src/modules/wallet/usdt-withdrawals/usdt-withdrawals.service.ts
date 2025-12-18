import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { UsdtWithdrawal, UsdtWithdrawalStatus } from './entities/usdt-withdrawal.entity';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { TonService } from '../../../ton/ton.service';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { EventsGateway } from '../../../gateways/events.gateway';

const KYAT_PER_USDT = 5000;
const MIN_WITHDRAWAL_KYAT = 5000; // 1 USDT minimum

@Injectable()
export class UsdtWithdrawalsService {
  private readonly logger = new Logger(UsdtWithdrawalsService.name);

  constructor(
    @InjectRepository(UsdtWithdrawal)
    private usdtWithdrawalsRepository: Repository<UsdtWithdrawal>,
    private usersService: UsersService,
    private tonService: TonService,
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
    private eventsGateway: EventsGateway,
  ) {}

  /**
   * Create withdrawal request (deduct balance immediately)
   */
  async createWithdrawalRequest(
    userId: string,
    kyatAmount: number,
    tonAddress: string,
  ): Promise<UsdtWithdrawal> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if user is activated
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.isActivated) {
        throw new BadRequestException('User must be activated before withdrawing');
      }

      // Validate amount
      if (kyatAmount < MIN_WITHDRAWAL_KYAT) {
        throw new BadRequestException(`Minimum withdrawal is ${MIN_WITHDRAWAL_KYAT} KYAT`);
      }

      // Check balance
      if (Number(user.kyatBalance) < kyatAmount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Validate TON address
      if (!this.tonService.isValidAddress(tonAddress)) {
        throw new BadRequestException('Invalid TON address');
      }

      // Convert KYAT to USDT (backend calculation)
      const usdtAmount = kyatAmount / KYAT_PER_USDT;

      // Deduct balance immediately
      user.kyatBalance = Number(user.kyatBalance) - kyatAmount;
      await queryRunner.manager.save(user);

      // Create withdrawal record
      const now = new Date();
      const executeAfter = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour

      const withdrawal = queryRunner.manager.create(UsdtWithdrawal, {
        userId,
        kyatAmount,
        usdtAmount,
        tonAddress,
        status: UsdtWithdrawalStatus.SIGNED,
        signedAt: now,
        executeAfter,
      });

      await queryRunner.manager.save(withdrawal);
      await queryRunner.commitTransaction();

      this.logger.log(
        `[USDT WITHDRAWAL] User ${userId} requested withdrawal: ${kyatAmount} KYAT (${usdtAmount} USDT) to ${tonAddress}. Execute after: ${executeAfter.toISOString()}`,
      );

      // Emit socket event
      this.eventsGateway.emitToUser(userId, 'usdt_withdrawal_created', {
        withdrawalId: withdrawal.id,
        kyatAmount: withdrawal.kyatAmount,
        usdtAmount: withdrawal.usdtAmount,
        tonAddress: withdrawal.tonAddress,
        executeAfter: withdrawal.executeAfter,
        createdAt: withdrawal.createdAt,
      });

      return withdrawal;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[USDT WITHDRAWAL] Error creating withdrawal:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Process pending withdrawals (called by cron job)
   */
  async processPendingWithdrawals(): Promise<number> {
    const now = new Date();
    let processedCount = 0;

    // Find withdrawals ready to execute
    const readyWithdrawals = await this.usdtWithdrawalsRepository.find({
      where: {
        status: UsdtWithdrawalStatus.SIGNED,
        executeAfter: LessThanOrEqual(now),
      },
      relations: ['user'],
    });

    for (const withdrawal of readyWithdrawals) {
      try {
        await this.executeWithdrawal(withdrawal.id);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `[USDT WITHDRAWAL] Failed to execute withdrawal ${withdrawal.id}:`,
          error,
        );
        // Mark as failed
        withdrawal.status = UsdtWithdrawalStatus.FAILED;
        await this.usdtWithdrawalsRepository.save(withdrawal);
      }
    }

    if (processedCount > 0) {
      this.logger.log(`[USDT WITHDRAWAL] Processed ${processedCount} withdrawal(s)`);
    }

    return processedCount;
  }

  /**
   * Execute withdrawal (send USDT on-chain)
   */
  private async executeWithdrawal(withdrawalId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawal = await queryRunner.manager.findOne(UsdtWithdrawal, {
        where: { id: withdrawalId },
        lock: { mode: 'pessimistic_write' },
        relations: ['user'],
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found');
      }

      // Prevent double execution
      if (withdrawal.status !== UsdtWithdrawalStatus.SIGNED) {
        this.logger.warn(
          `[USDT WITHDRAWAL] Withdrawal ${withdrawalId} already processed (status: ${withdrawal.status})`,
        );
        await queryRunner.commitTransaction();
        return;
      }

      // Update status to QUEUED (processing)
      withdrawal.status = UsdtWithdrawalStatus.QUEUED;
      await queryRunner.manager.save(withdrawal);
      await queryRunner.commitTransaction();

      // Send USDT on-chain (outside transaction to avoid long locks)
      let txHash: string;
      try {
        txHash = await this.sendUsdtOnChain(
          withdrawal.tonAddress,
          withdrawal.usdtAmount,
        );
      } catch (error) {
        // On failure, revert status to SIGNED for retry
        withdrawal.status = UsdtWithdrawalStatus.SIGNED;
        await this.usdtWithdrawalsRepository.save(withdrawal);
        this.logger.error(
          `[USDT WITHDRAWAL] Failed to send USDT for withdrawal ${withdrawalId}. Status reverted to SIGNED for retry.`,
        );
        throw error; // Re-throw to be caught by processPendingWithdrawals
      }

      // Update withdrawal with tx hash and mark as sent (in new transaction)
      const updateRunner = this.dataSource.createQueryRunner();
      await updateRunner.connect();
      await updateRunner.startTransaction();

      try {
        const updatedWithdrawal = await updateRunner.manager.findOne(UsdtWithdrawal, {
          where: { id: withdrawalId },
          lock: { mode: 'pessimistic_write' },
        });

        if (updatedWithdrawal) {
          updatedWithdrawal.status = UsdtWithdrawalStatus.SENT;
          updatedWithdrawal.tonTxHash = txHash;
          await updateRunner.manager.save(updatedWithdrawal);
          await updateRunner.commitTransaction();

          this.logger.log(
            `[USDT WITHDRAWAL] Executed withdrawal ${withdrawalId}: ${updatedWithdrawal.usdtAmount} USDT sent to ${updatedWithdrawal.tonAddress} (tx: ${txHash})`,
          );

          // Emit socket event
          this.eventsGateway.emitToUser(updatedWithdrawal.userId, 'usdt_withdrawal_sent', {
            withdrawalId: updatedWithdrawal.id,
            kyatAmount: updatedWithdrawal.kyatAmount,
            usdtAmount: updatedWithdrawal.usdtAmount,
            tonAddress: updatedWithdrawal.tonAddress,
            tonTxHash: txHash,
            sentAt: new Date(),
          });
        } else {
          await updateRunner.rollbackTransaction();
        }
      } catch (updateError) {
        await updateRunner.rollbackTransaction();
        this.logger.error(`[USDT WITHDRAWAL] Error updating withdrawal ${withdrawalId}:`, updateError);
        throw updateError;
      } finally {
        await updateRunner.release();
      }
    } catch (error) {
      // Only rollback if transaction is still active (before commit)
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`[USDT WITHDRAWAL] Error executing withdrawal:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send USDT on-chain using TonService
   */
  private async sendUsdtOnChain(toAddress: string, usdtAmount: number): Promise<string> {
    try {
      // Validate wallet is ready
      if (!this.tonService.isWalletReadyForUse()) {
        throw new Error('Platform wallet not ready - check TON_SEED_PHRASE configuration');
      }

      // Send USDT via TonService
      const txHash = await this.tonService.sendUsdt(toAddress, usdtAmount);

      this.logger.log(
        `[USDT WITHDRAWAL] Successfully sent ${usdtAmount} USDT to ${toAddress}. TX: ${txHash}`,
      );

      return txHash;
    } catch (error) {
      this.logger.error(
        `[USDT WITHDRAWAL] Failed to send ${usdtAmount} USDT to ${toAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get user's USDT withdrawals
   */
  async getUserWithdrawals(userId: string): Promise<UsdtWithdrawal[]> {
    return this.usdtWithdrawalsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

