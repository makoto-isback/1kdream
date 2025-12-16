import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DepositsService } from '../wallet/deposits/deposits.service';
import { WithdrawalsService } from '../wallet/withdrawals/withdrawals.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SystemService } from '../system/system.service';
import { LotteryService } from '../lottery/lottery.service';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
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
    // For now, check if user exists - add isAdmin field later if needed
    // if (!user.isAdmin) {
    //   throw new ForbiddenException('Admin access required');
    // }
  }

  async getAllDeposits() {
    return this.depositsService.getAllDeposits();
  }

  async confirmDeposit(depositId: string, tonTxHash: string, adminId: string, userId?: string) {
    return this.depositsService.confirmDeposit(depositId, tonTxHash, adminId, userId);
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
      console.log(`Admin ${adminId} adjusted balance for user ${userId}: ${type} ${amount} KYAT. Reason: ${reason}. New balance: ${user.kyatBalance}`);
      
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
    return this.withdrawalsService.processWithdrawal(withdrawalId, tonTxHash, adminId);
  }

  async executeWithdrawal(withdrawalId: string, adminId: string) {
    // Execute withdrawal (sends TON transaction, returns txHash)
    const txHash = await this.withdrawalsService.executeWithdrawal(withdrawalId);
    // Then process it with the txHash
    if (txHash) {
      return this.withdrawalsService.processWithdrawal(withdrawalId, txHash, adminId);
    }
    // If no txHash (manual processing), withdrawal is in PROCESSING state
    const withdrawal = await this.withdrawalsService.getWithdrawalById(withdrawalId);
    return withdrawal;
  }

  async rejectWithdrawal(withdrawalId: string, adminId: string) {
    return this.withdrawalsService.rejectWithdrawal(withdrawalId, adminId);
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
    console.log(`Admin ${adminId} updated system settings:`, updates);
    return this.systemService.updateSettings(updates);
  }

  async createLotteryRound(adminId: string) {
    console.log(`Admin ${adminId} creating new lottery round...`);
    const round = await this.lotteryService.createNewRound(this.systemService);
    console.log(`Admin ${adminId} created lottery round #${round.roundNumber} (ID: ${round.id})`);
    return round;
  }
}
