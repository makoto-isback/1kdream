import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { Between } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TreasuryService } from './treasury.service';
import { WithdrawRequest, WithdrawRequestStatus } from './entities/withdraw-request.entity';
import { UserDeposit, UserDepositStatus } from './entities/user-deposit.entity';
import { TreasuryTransaction } from './entities/treasury-transaction.entity';
import { MAX_WITHDRAW_KYAT_PER_DAY } from './constants/treasury.constants';

@Controller('treasury')
export class TreasuryController {
  constructor(private treasuryService: TreasuryService) {}

  /**
   * Admin: Get pending withdraw requests
   */
  @Get('withdraws/pending')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPendingWithdraws(@Query('limit') limit?: number) {
    const repos = this.treasuryService.getRepositories();
    return repos.withdrawRequestRepository.find({
      where: { status: WithdrawRequestStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: limit || 50,
    });
  }

  /**
   * Admin: Approve withdraw request
   */
  @Post('withdraws/:id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async approveWithdraw(@Param('id') id: string) {
    const repos = this.treasuryService.getRepositories();
    const request = await repos.withdrawRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new Error('Withdraw request not found');
    }

    // Mark as ready to execute (set executeAfter to now)
    request.executeAfter = new Date();
    await repos.withdrawRequestRepository.save(request);

    return { success: true, message: 'Withdraw request approved' };
  }

  /**
   * Admin: Reject withdraw request
   */
  @Post('withdraws/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async rejectWithdraw(@Param('id') id: string) {
    const repos = this.treasuryService.getRepositories();
    const request = await repos.withdrawRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new Error('Withdraw request not found');
    }

    request.status = WithdrawRequestStatus.REJECTED;
    await repos.withdrawRequestRepository.save(request);

    return { success: true, message: 'Withdraw request rejected' };
  }

  /**
   * Admin: Get treasury overview
   */
  @Get('overview')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getTreasuryOverview() {
    const repos = this.treasuryService.getRepositories();
    // Get pending deposits
    const pendingDeposits = await repos.userDepositRepository.count({
      where: { status: UserDepositStatus.PENDING },
    });

    // Get pending withdrawals
    const pendingWithdraws = await repos.withdrawRequestRepository.count({
      where: { status: WithdrawRequestStatus.PENDING },
    });

    // Get recent transactions
    const recentTransactions = await repos.treasuryTxRepository.find({
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      pendingDeposits,
      pendingWithdraws,
      recentTransactions,
    };
  }

  /**
   * Admin: Confirm deposit manually
   */
  @Post('deposits/:id/confirm')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async confirmDeposit(@Param('id') id: string) {
    await this.treasuryService.confirmDeposit(id);
    return { success: true, message: 'Deposit confirmed' };
  }

  /**
   * Admin: Get risk indicators
   */
  @Get('risk-indicators')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getRiskIndicators() {
    const repos = this.treasuryService.getRepositories();

    // Users near daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limits = await repos.withdrawLimitDailyRepository.find({
      where: { date: today },
    });

    const nearLimit = limits.filter(
      (l) => parseFloat(l.totalKyatWithdrawn) > MAX_WITHDRAW_KYAT_PER_DAY * 0.8,
    );

    // Reused destination addresses
    const withdrawals = await repos.withdrawRequestRepository.find({
      where: { status: WithdrawRequestStatus.COMPLETED },
      order: { createdAt: 'DESC' },
      take: 1000,
    });

    const addressCounts = new Map<string, number>();
    withdrawals.forEach((w) => {
      const count = addressCounts.get(w.destinationAddress) || 0;
      addressCounts.set(w.destinationAddress, count + 1);
    });

    const reusedAddresses = Array.from(addressCounts.entries())
      .filter(([_, count]) => count > 3)
      .map(([address, count]) => ({ address, count }));

    // High-frequency withdrawals (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentWithdrawals = await repos.withdrawRequestRepository.find({
      where: {
        createdAt: Between(yesterday, new Date()),
        status: WithdrawRequestStatus.COMPLETED,
      },
    });

    const userCounts = new Map<string, number>();
    recentWithdrawals.forEach((w) => {
      const count = userCounts.get(w.userId) || 0;
      userCounts.set(w.userId, count + 1);
    });

    const highFrequency = Array.from(userCounts.entries())
      .filter(([_, count]) => count > 5)
      .map(([userId, count]) => ({ userId, count }));

    return {
      nearDailyLimit: nearLimit.length,
      reusedAddresses: reusedAddresses.length,
      highFrequencyUsers: highFrequency.length,
      details: {
        nearLimit,
        reusedAddresses: reusedAddresses.slice(0, 10),
        highFrequency: highFrequency.slice(0, 10),
      },
    };
  }
}

