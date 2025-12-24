import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UsdtDepositStatus } from '../wallet/usdt-deposits/entities/usdt-deposit.entity';
import { UsdtWithdrawalStatus } from '../wallet/usdt-withdrawals/entities/usdt-withdrawal.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('check')
  async checkAdmin(@Request() req) {
    // AdminGuard already verified admin access
    return { isAdmin: true };
  }

  @Get('stats')
  async getStats(@Request() req) {
    // AdminGuard already verified admin access
    // Returns USDT-specific statistics (as requested)
    return this.adminService.getUsdtStats();
  }

  @Get('system-stats')
  async getSystemStats(@Request() req) {
    // AdminGuard already verified admin access
    // Returns general system stats (users, old deposits/withdrawals, etc.)
    return this.adminService.getSystemStats();
  }

  @Get('deposits')
  async getAllDeposits(@Request() req) {
    // AdminGuard already verified admin access
    return this.adminService.getAllDeposits();
  }

  @Post('deposits/:id/confirm')
  async confirmDeposit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tonTxHash: string; userId?: string },
  ) {
    // AdminGuard already verified admin access
    return this.adminService.confirmDeposit(id, body.tonTxHash, req.user.id, body.userId);
  }

  @Get('withdrawals')
  @Throttle({ default: { limit: 1000, ttl: 60000 } }) // 1000 requests per minute for admin endpoints
  async getAllWithdrawals(
    @Request() req,
    @Query('includeCompleted') includeCompleted?: string,
  ) {
    // AdminGuard already verified admin access
    // By default, exclude completed withdrawals to keep UI clean
    // Add ?includeCompleted=true to see all withdrawals including completed ones
    const include = includeCompleted === 'true';
    return this.adminService.getAllWithdrawals(include);
  }

  @Get('withdrawals/pending')
  async getPendingWithdrawals(@Request() req) {
    // AdminGuard already verified admin access
    return this.adminService.getPendingWithdrawals();
  }


  @Post('withdrawals/:id/process')
  async processWithdrawal(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tonTxHash: string },
  ) {
    // AdminGuard already verified admin access
    return this.adminService.processWithdrawal(id, body.tonTxHash, req.user.id);
  }

  @Post('withdrawals/:id/complete')
  async completeWithdrawal(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tonTxHash?: string },
  ) {
    // AdminGuard already verified admin access
    // If txHash provided, process directly. Otherwise execute (sends TON tx)
    if (body.tonTxHash) {
      return this.adminService.processWithdrawal(id, body.tonTxHash, req.user.id);
    }
    return this.adminService.executeWithdrawal(id, req.user.id);
  }

  @Post('withdrawals/:id/reject')
  async rejectWithdrawal(@Request() req, @Param('id') id: string) {
    // AdminGuard already verified admin access
    return this.adminService.rejectWithdrawal(id, req.user.id);
  }

  @Post('manual-adjust')
  async manualBalanceAdjust(
    @Request() req,
    @Body() body: { userId: string; amount: number; type: 'credit' | 'debit'; reason: string },
  ) {
    // AdminGuard already verified admin access
    return this.adminService.manualBalanceAdjust(
      req.user.id,
      body.userId,
      body.amount,
      body.type,
      body.reason,
    );
  }

  @Get('system-settings')
  async getSystemSettings(@Request() req) {
    // AdminGuard already verified admin access
    return this.adminService.getSystemSettings();
  }

  @Post('system-settings')
  async updateSystemSettings(
    @Request() req,
    @Body() body: { withdrawalsPaused?: boolean; bettingPaused?: boolean; newRoundsPaused?: boolean },
  ) {
    // AdminGuard already verified admin access
    return this.adminService.updateSystemSettings(req.user.id, body);
  }

  @Post('lottery/create-round')
  async createLotteryRound(@Request() req) {
    // AdminGuard already verified admin access
    return this.adminService.createLotteryRound(req.user.id);
  }

  @Post('lottery/trigger-draw')
  async triggerLotteryDraw(@Request() req) {
    // AdminGuard already verified admin access
    // This will manually trigger the lottery draw check and create a new round if needed
    return this.adminService.triggerLotteryDraw(req.user.id);
  }

  // ========== USDT DEPOSITS & WITHDRAWALS ==========

  @Get('deposits')
  async getUsdtDeposits(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('status') status?: UsdtDepositStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // AdminGuard already verified admin access
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.adminService.getUsdtDeposits(filters);
  }

  @Get('withdrawals')
  async getUsdtWithdrawals(
    @Request() req,
    @Query('userId') userId?: string,
    @Query('status') status?: UsdtWithdrawalStatus,
  ) {
    // AdminGuard already verified admin access
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (status) filters.status = status;

    return this.adminService.getUsdtWithdrawals(filters);
  }

  @Post('withdrawals/:id/cancel')
  async cancelUsdtWithdrawal(@Request() req, @Param('id') id: string) {
    // AdminGuard already verified admin access
    return this.adminService.cancelUsdtWithdrawal(id, req.user.id);
  }
}
