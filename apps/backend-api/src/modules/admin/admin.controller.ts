import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('check')
  async checkAdmin(@Request() req) {
    await this.adminService.checkAdmin(req.user.id);
    return { isAdmin: true };
  }

  @Get('stats')
  async getStats(@Request() req) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getSystemStats();
  }

  @Get('deposits')
  async getAllDeposits(@Request() req) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getAllDeposits();
  }

  @Post('deposits/:id/confirm')
  async confirmDeposit(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tonTxHash: string; userId?: string },
  ) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.confirmDeposit(id, body.tonTxHash, req.user.id, body.userId);
  }

  @Get('withdrawals')
  async getAllWithdrawals(@Request() req) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getAllWithdrawals();
  }

  @Get('withdrawals/pending')
  async getPendingWithdrawals(@Request() req) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getPendingWithdrawals();
  }


  @Post('withdrawals/:id/process')
  async processWithdrawal(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tonTxHash: string },
  ) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.processWithdrawal(id, body.tonTxHash, req.user.id);
  }

  @Post('withdrawals/:id/complete')
  async completeWithdrawal(
    @Request() req,
    @Param('id') id: string,
    @Body() body: { tonTxHash?: string },
  ) {
    await this.adminService.checkAdmin(req.user.id);
    // If txHash provided, process directly. Otherwise execute (sends TON tx)
    if (body.tonTxHash) {
      return this.adminService.processWithdrawal(id, body.tonTxHash, req.user.id);
    }
    return this.adminService.executeWithdrawal(id, req.user.id);
  }

  @Post('withdrawals/:id/reject')
  async rejectWithdrawal(@Request() req, @Param('id') id: string) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.rejectWithdrawal(id, req.user.id);
  }

  @Post('manual-adjust')
  async manualBalanceAdjust(
    @Request() req,
    @Body() body: { userId: string; amount: number; type: 'credit' | 'debit'; reason: string },
  ) {
    await this.adminService.checkAdmin(req.user.id);
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
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.getSystemSettings();
  }

  @Post('system-settings')
  async updateSystemSettings(
    @Request() req,
    @Body() body: { withdrawalsPaused?: boolean; bettingPaused?: boolean; newRoundsPaused?: boolean },
  ) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.updateSystemSettings(req.user.id, body);
  }

  @Post('lottery/create-round')
  async createLotteryRound(@Request() req) {
    await this.adminService.checkAdmin(req.user.id);
    return this.adminService.createLotteryRound(req.user.id);
  }
}
