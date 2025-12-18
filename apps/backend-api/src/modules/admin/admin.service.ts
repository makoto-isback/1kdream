import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { DepositsService } from '../wallet/deposits/deposits.service';
import { WithdrawalsService } from '../wallet/withdrawals/withdrawals.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SystemService } from '../system/system.service';
import { LotteryService } from '../lottery/lottery.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { LotteryRoundStatus } from '../lottery/entities/lottery-round.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private depositsService: DepositsService,
    private withdrawalsService: WithdrawalsService,
    private usersService: UsersService,
    private systemService: SystemService,
    private lotteryService: LotteryService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async checkAdmin(userId: string): Promise<void> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    if (!user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }
  }

  async getAllDeposits() {
    return this.depositsService.getAllDeposits();
  }

  async confirmDeposit(depositId: string, tonTxHash: string, adminId: string, userId?: string) {
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} confirming deposit ${depositId} with TX: ${tonTxHash}${userId ? ` (user: ${userId})` : ''}`);
    try {
      const result = await this.depositsService.confirmDeposit(depositId, tonTxHash, adminId, userId);
      this.logger.log(`[ADMIN ACTION] Admin ${adminId} successfully confirmed deposit ${depositId}`);
      return result;
    } catch (error) {
      this.logger.error(`[ADMIN ACTION] Admin ${adminId} failed to confirm deposit ${depositId}:`, error);
      throw error;
    }
  }

  async manualBalanceAdjust(
    adminId: string,
    userId: string,
    amount: number,
    type: 'credit' | 'debit',
    reason: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (type === 'credit') {
        user.kyatBalance = Number(user.kyatBalance) + amount;
      } else {
        if (Number(user.kyatBalance) < amount) {
          throw new BadRequestException('Insufficient balance');
        }
        user.kyatBalance = Number(user.kyatBalance) - amount;
      }

      await queryRunner.manager.save(user);
      await queryRunner.commitTransaction();

      // Log the adjustment
      this.logger.log(`[ADMIN ACTION] Admin ${adminId} adjusted balance for user ${userId}: ${type} ${amount} KYAT. Reason: ${reason}. New balance: ${user.kyatBalance}`);
      
      return {
        success: true,
        userId,
        amount,
        type,
        reason,
        newBalance: user.kyatBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAllWithdrawals() {
    return this.withdrawalsService.getAllWithdrawals();
  }

  async getPendingWithdrawals() {
    return this.withdrawalsService.getPendingWithdrawals();
  }

  async processWithdrawal(withdrawalId: string, tonTxHash: string, adminId: string) {
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} processing withdrawal ${withdrawalId} with TX: ${tonTxHash}`);
    try {
      const result = await this.withdrawalsService.processWithdrawal(withdrawalId, tonTxHash, adminId);
      this.logger.log(`[ADMIN ACTION] Admin ${adminId} successfully processed withdrawal ${withdrawalId}`);
      return result;
    } catch (error) {
      this.logger.error(`[ADMIN ACTION] Admin ${adminId} failed to process withdrawal ${withdrawalId}:`, error);
      throw error;
    }
  }

  async executeWithdrawal(withdrawalId: string, adminId: string) {
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} executing withdrawal ${withdrawalId}`);
    try {
      // Execute withdrawal (sends TON transaction, returns txHash)
      const txHash = await this.withdrawalsService.executeWithdrawal(withdrawalId);
      // Then process it with the txHash
      if (txHash) {
        return this.withdrawalsService.processWithdrawal(withdrawalId, txHash, adminId);
      }
      // If no txHash (manual processing), withdrawal is in PROCESSING state
      const withdrawal = await this.withdrawalsService.getWithdrawalById(withdrawalId);
      this.logger.log(`[ADMIN ACTION] Admin ${adminId} executed withdrawal ${withdrawalId} (manual processing, status: ${withdrawal.status})`);
      return withdrawal;
    } catch (error) {
      this.logger.error(`[ADMIN ACTION] Admin ${adminId} failed to execute withdrawal ${withdrawalId}:`, error);
      throw error;
    }
  }

  async rejectWithdrawal(withdrawalId: string, adminId: string) {
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} rejecting withdrawal ${withdrawalId}`);
    try {
      const result = await this.withdrawalsService.rejectWithdrawal(withdrawalId, adminId);
      this.logger.log(`[ADMIN ACTION] Admin ${adminId} successfully rejected withdrawal ${withdrawalId}`);
      return result;
    } catch (error) {
      this.logger.error(`[ADMIN ACTION] Admin ${adminId} failed to reject withdrawal ${withdrawalId}:`, error);
      throw error;
    }
  }

  async getSystemStats() {
    const users = await this.usersService.findAll();
    const deposits = await this.depositsService.getAllDeposits();
    const withdrawals = await this.withdrawalsService.getAllWithdrawals();
    const settings = await this.systemService.getSettings();

    const totalDeposits = deposits
      .filter((d) => d.status === 'confirmed')
      .reduce((sum, d) => sum + Number(d.usdtAmount), 0);

    const totalWithdrawals = withdrawals
      .filter((w) => w.status === 'completed')
      .reduce((sum, w) => sum + Number(w.usdtAmount), 0);

    return {
      totalUsers: users.length,
      totalDepositsUSDT: totalDeposits,
      totalWithdrawalsUSDT: totalWithdrawals,
      activeUsers: users.filter((u) => Number(u.kyatBalance) > 0).length,
      systemSettings: settings,
    };
  }

  async getSystemSettings() {
    return this.systemService.getSettings();
  }

  async updateSystemSettings(
    adminId: string,
    updates: {
      withdrawalsPaused?: boolean;
      bettingPaused?: boolean;
      newRoundsPaused?: boolean;
    },
  ) {
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} updating system settings:`, updates);
    const result = await this.systemService.updateSettings(updates);
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} successfully updated system settings`);
    return result;
  }

  async createLotteryRound(adminId: string) {
    this.logger.log(`[ADMIN ACTION] Admin ${adminId} requested to create new lottery round`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check for active round and close it safely if exists
      const activeRound = await this.lotteryService.getActiveRound();
      
      if (activeRound) {
        this.logger.warn(`[ADMIN ACTION] Active round #${activeRound.roundNumber} (ID: ${activeRound.id}) exists. Closing it before creating new round.`);
        
        // Close the active round safely
        activeRound.status = LotteryRoundStatus.COMPLETED;
        activeRound.drawnAt = new Date();
        await queryRunner.manager.save(activeRound);
        
        this.logger.log(`[ADMIN ACTION] Closed active round #${activeRound.roundNumber}`);
      }

      // Create new round
      const round = await this.lotteryService.createNewRound(this.systemService);
      
      await queryRunner.commitTransaction();
      
      this.logger.log(`[ADMIN ACTION] Admin ${adminId} successfully created lottery round #${round.roundNumber} (ID: ${round.id})`);
      return round;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[ADMIN ACTION] Admin ${adminId} failed to create lottery round:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
