import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Withdrawal, WithdrawalStatus } from './entities/withdrawal.entity';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { TonService } from '../../../ton/ton.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { TelegramNotificationService } from '../../../services/telegram-notification.service';

const KYAT_PER_USD = 5000;
const MIN_WITHDRAWAL_KYAT = 5000;
const MIN_WITHDRAWAL_USDT = MIN_WITHDRAWAL_KYAT / KYAT_PER_USD; // 1 USDT
const DAILY_MAX_WITHDRAWAL_KYAT = 500000; // 500,000 KYAT per day per user
const WITHDRAWAL_DELAY_HOURS = 1; // 1 hour delay

@Injectable()
export class WithdrawalsService {
  constructor(
    @InjectRepository(Withdrawal)
    private withdrawalsRepository: Repository<Withdrawal>,
    private usersService: UsersService,
    private tonService: TonService,
    @InjectDataSource()
    private dataSource: DataSource,
    private telegramNotificationService: TelegramNotificationService,
  ) {}

  async createWithdrawalRequest(
    userId: string,
    kyatAmount: number,
    tonAddress: string,
    systemService?: any, // Optional system service for checking paused withdrawals
  ): Promise<Withdrawal> {
    // Check if withdrawals are paused
    if (systemService) {
      const withdrawalsPaused = await systemService.isWithdrawalsPaused();
      if (withdrawalsPaused) {
        throw new BadRequestException('Withdrawals are currently paused');
      }
    }

    if (kyatAmount < MIN_WITHDRAWAL_KYAT) {
      throw new BadRequestException(
        `Minimum withdrawal is ${MIN_WITHDRAWAL_KYAT} KYAT`,
      );
    }

    // Check daily max withdrawal
    if (kyatAmount > DAILY_MAX_WITHDRAWAL_KYAT) {
      throw new BadRequestException(
        `Maximum withdrawal per day is ${DAILY_MAX_WITHDRAWAL_KYAT} KYAT`,
      );
    }

    const usdtAmount = kyatAmount / KYAT_PER_USD;

    // Validate TON address
    if (!this.tonService.isValidAddress(tonAddress)) {
      throw new BadRequestException('Invalid TON address');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check user balance (with lock)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (Number(user.kyatBalance) < kyatAmount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Check daily withdrawal limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayWithdrawals = await queryRunner.manager
        .createQueryBuilder(Withdrawal, 'withdrawal')
        .where('withdrawal.userId = :userId', { userId })
        .andWhere('withdrawal.createdAt >= :today', { today })
        .andWhere('withdrawal.createdAt < :tomorrow', { tomorrow })
        .andWhere('withdrawal.status = :status', { status: WithdrawalStatus.COMPLETED })
        .getMany();

      const todayTotal = todayWithdrawals.reduce(
        (sum, w) => sum + Number(w.kyatAmount),
        0,
      );

      if (todayTotal + kyatAmount > DAILY_MAX_WITHDRAWAL_KYAT) {
        throw new BadRequestException(
          `Daily withdrawal limit exceeded. Remaining: ${DAILY_MAX_WITHDRAWAL_KYAT - todayTotal} KYAT`,
        );
      }

      // Deduct balance immediately
      user.kyatBalance = Number(user.kyatBalance) - kyatAmount;
      await queryRunner.manager.save(user);

      const withdrawal = queryRunner.manager.create(Withdrawal, {
        userId,
        kyatAmount,
        usdtAmount,
        tonAddress,
        status: WithdrawalStatus.PENDING,
        requestTime: new Date(), // Record request time for 1-hour delay
      });

      const savedWithdrawal = await queryRunner.manager.save(withdrawal);
      await queryRunner.commitTransaction();

      // Send Telegram notification (after transaction commits)
      // Load user with relations for notification
      try {
        const userForNotification = await this.usersService.findOne(userId);
        this.telegramNotificationService.notifyNewWithdrawal(
          {
            id: savedWithdrawal.id,
            kyatAmount: savedWithdrawal.kyatAmount,
            usdtAmount: savedWithdrawal.usdtAmount,
            tonAddress: savedWithdrawal.tonAddress,
            requestTime: savedWithdrawal.requestTime,
          },
          {
            username: userForNotification.username,
            firstName: userForNotification.firstName,
            lastName: userForNotification.lastName,
            telegramId: userForNotification.telegramId,
          },
        ).catch((err) => {
          // Log but don't fail withdrawal creation if notification fails
          console.error('[WITHDRAWAL] Failed to send Telegram notification:', err);
        });
      } catch (err) {
        // User not found - skip notification
        console.error('[WITHDRAWAL] User not found for notification:', err);
      }

      return savedWithdrawal;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processWithdrawal(
    withdrawalId: string,
    tonTxHash: string,
    adminId: string,
  ): Promise<Withdrawal> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawal = await queryRunner.manager.findOne(Withdrawal, {
        where: { id: withdrawalId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found');
      }

      // Prevent double processing - return early if already completed
      if (withdrawal.status === WithdrawalStatus.COMPLETED) {
        await queryRunner.commitTransaction();
        console.log(`[ADMIN ACTION] Admin ${adminId} attempted to process already-completed withdrawal ${withdrawalId} (idempotent)`);
        return withdrawal;
      }

      // Validate state transitions: only pending or processing can be completed
      if (withdrawal.status === WithdrawalStatus.REJECTED) {
        throw new BadRequestException('Cannot process a rejected withdrawal');
      }

      // Valid transitions: PENDING -> COMPLETED or PROCESSING -> COMPLETED
      if (withdrawal.status !== WithdrawalStatus.PENDING && withdrawal.status !== WithdrawalStatus.PROCESSING) {
        throw new BadRequestException(`Invalid withdrawal status for processing: ${withdrawal.status}. Expected: pending or processing`);
      }

      withdrawal.tonTxHash = tonTxHash;
      withdrawal.status = WithdrawalStatus.COMPLETED;
      withdrawal.processedAt = new Date();
      withdrawal.completedAt = new Date();
      
      await queryRunner.manager.save(withdrawal);
      await queryRunner.commitTransaction();

      console.log(`[ADMIN ACTION] Admin ${adminId} processed withdrawal ${withdrawalId} with TX: ${tonTxHash}. Amount: ${withdrawal.kyatAmount} KYAT`);

      // Send Telegram notification
      try {
        const userForNotification = await this.usersService.findOne(withdrawal.userId);
        this.telegramNotificationService.notifyWithdrawalCompleted(
          {
            id: withdrawal.id,
            kyatAmount: withdrawal.kyatAmount,
            usdtAmount: withdrawal.usdtAmount,
            tonTxHash: withdrawal.tonTxHash,
          },
          {
            username: userForNotification.username,
            firstName: userForNotification.firstName,
            lastName: userForNotification.lastName,
          },
        ).catch((err) => {
          console.error('[WITHDRAWAL] Failed to send completion notification:', err);
        });
      } catch (err) {
        console.error('[WITHDRAWAL] User not found for completion notification:', err);
      }

      return withdrawal;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectWithdrawal(withdrawalId: string, adminId: string): Promise<Withdrawal> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const withdrawal = await queryRunner.manager.findOne(Withdrawal, {
        where: { id: withdrawalId },
        relations: ['user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!withdrawal) {
        throw new NotFoundException('Withdrawal not found');
      }

      // Prevent double rejection - return early if already rejected
      if (withdrawal.status === WithdrawalStatus.REJECTED) {
        await queryRunner.commitTransaction();
        console.log(`[ADMIN ACTION] Admin ${adminId} attempted to reject already-rejected withdrawal ${withdrawalId} (idempotent)`);
        return withdrawal;
      }

      // Validate state transitions: cannot reject completed withdrawals
      if (withdrawal.status === WithdrawalStatus.COMPLETED) {
        throw new BadRequestException('Cannot reject a completed withdrawal');
      }

      // Valid transitions: PENDING -> REJECTED or PROCESSING -> REJECTED
      if (withdrawal.status !== WithdrawalStatus.PENDING && withdrawal.status !== WithdrawalStatus.PROCESSING) {
        throw new BadRequestException(`Invalid withdrawal status for rejection: ${withdrawal.status}. Expected: pending or processing`);
      }

      // Refund balance (with lock)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: withdrawal.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException(`User ${withdrawal.userId} not found`);
      }

      user.kyatBalance = Number(user.kyatBalance) + withdrawal.kyatAmount;
      await queryRunner.manager.save(user);

      withdrawal.status = WithdrawalStatus.REJECTED;
      withdrawal.rejectedAt = new Date();
      
      await queryRunner.manager.save(withdrawal);
      await queryRunner.commitTransaction();

      console.log(`[ADMIN ACTION] Admin ${adminId} rejected withdrawal ${withdrawalId}. Refunded ${withdrawal.kyatAmount} KYAT to user ${withdrawal.userId}. New balance: ${user.kyatBalance}`);

      // Send Telegram notification
      try {
        const userForNotification = withdrawal.user || await this.usersService.findOne(withdrawal.userId);
        this.telegramNotificationService.notifyWithdrawalRejected(
          {
            id: withdrawal.id,
            kyatAmount: withdrawal.kyatAmount,
            usdtAmount: withdrawal.usdtAmount,
          },
          {
            username: userForNotification.username,
            firstName: userForNotification.firstName,
            lastName: userForNotification.lastName,
          },
          `Rejected by admin ${adminId}`,
        ).catch((err) => {
          console.error('[WITHDRAWAL] Failed to send rejection notification:', err);
        });
      } catch (err) {
        console.error('[WITHDRAWAL] User not found for rejection notification:', err);
      }

      return withdrawal;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async executeWithdrawal(withdrawalId: string): Promise<string> {
    const withdrawal = await this.withdrawalsRepository.findOne({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal is not pending');
    }

    // Check 1-hour delay
    if (withdrawal.requestTime) {
      const now = new Date();
      const requestTime = new Date(withdrawal.requestTime);
      const hoursElapsed = (now.getTime() - requestTime.getTime()) / (1000 * 60 * 60);

      if (hoursElapsed < WITHDRAWAL_DELAY_HOURS) {
        throw new BadRequestException(
          `Withdrawal can only be processed after 1 hour. Remaining: ${Math.ceil((WITHDRAWAL_DELAY_HOURS - hoursElapsed) * 60)} minutes`,
        );
      }
    }

    // Update status to processing
    withdrawal.status = WithdrawalStatus.PROCESSING;
    await this.withdrawalsRepository.save(withdrawal);

    try {
      // Send USDT via TON
      const txHash = await this.tonService.sendUsdt(
        withdrawal.tonAddress,
        withdrawal.usdtAmount,
      );

      if (txHash) {
        // Note: processWithdrawal requires adminId, but in executeWithdrawal we don't have it
        // So we'll update status manually here
        withdrawal.tonTxHash = txHash;
        withdrawal.status = WithdrawalStatus.COMPLETED;
        withdrawal.processedAt = new Date();
        withdrawal.completedAt = new Date();
        await this.withdrawalsRepository.save(withdrawal);
        return txHash;
      } else {
        // If sendUsdt returns empty (manual processing), keep as processing
        return '';
      }
    } catch (error) {
      // On error, revert to pending for retry
      withdrawal.status = WithdrawalStatus.PENDING;
      await this.withdrawalsRepository.save(withdrawal);
      throw error;
    }
  }

  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    return this.withdrawalsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllWithdrawals(): Promise<Withdrawal[]> {
    return this.withdrawalsRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return this.withdrawalsRepository.find({
      where: { status: WithdrawalStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getWithdrawalById(id: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    return withdrawal;
  }
}
