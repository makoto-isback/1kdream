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
      // Note: Actual implementation would use TonService.sendUsdt() or similar
      // For now, we'll simulate the transaction
      const txHash = await this.sendUsdtOnChain(
        withdrawal.tonAddress,
        withdrawal.usdtAmount,
      );

      // Update withdrawal with tx hash and mark as sent
      withdrawal.status = UsdtWithdrawalStatus.SENT;
      withdrawal.tonTxHash = txHash;
      await this.usdtWithdrawalsRepository.save(withdrawal);

      this.logger.log(
        `[USDT WITHDRAWAL] Executed withdrawal ${withdrawalId}: ${withdrawal.usdtAmount} USDT sent to ${withdrawal.tonAddress} (tx: ${txHash})`,
      );

      // Emit socket event
      this.eventsGateway.emitToUser(withdrawal.userId, 'usdt_withdrawal_sent', {
        withdrawalId: withdrawal.id,
        kyatAmount: withdrawal.kyatAmount,
        usdtAmount: withdrawal.usdtAmount,
        tonAddress: withdrawal.tonAddress,
        tonTxHash: txHash,
        sentAt: new Date(),
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[USDT WITHDRAWAL] Error executing withdrawal:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Send USDT on-chain (placeholder - implement with actual TON wallet)
   */
  private async sendUsdtOnChain(toAddress: string, usdtAmount: number): Promise<string> {
    // TODO: Implement actual USDT jetton transfer using TonService
    // For now, return a placeholder hash
    // In production, this would:
    // 1. Use platform wallet private key
    // 2. Create jetton transfer transaction
    // 3. Sign and broadcast to TON network
    // 4. Return transaction hash

    this.logger.warn(
      `[USDT WITHDRAWAL] sendUsdtOnChain not fully implemented. Would send ${usdtAmount} USDT to ${toAddress}`,
    );

    // Placeholder - in production, implement actual transfer
    return `placeholder-tx-hash-${Date.now()}`;
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

