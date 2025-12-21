import { Controller, Get, Param, UseGuards, Post } from '@nestjs/common';
import { LotteryService } from './lottery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemService } from '../system/system.service';

@Controller('lottery')
export class LotteryController {
  constructor(
    private lotteryService: LotteryService,
    private systemService: SystemService,
  ) {}

  @Get('active')
  async getActiveRound() {
    return this.lotteryService.getActiveRound();
  }

  @Get('latest')
  async getLatestRound() {
    return this.lotteryService.getLatestRound();
  }

  @Get('round/:id')
  @UseGuards(JwtAuthGuard)
  async getRound(@Param('id') id: string) {
    return this.lotteryService.getRoundById(id);
  }

  @Get('round/:id/stats')
  @UseGuards(JwtAuthGuard)
  async getRoundStats(@Param('id') id: string) {
    return this.lotteryService.getRoundStats(id);
  }

  @Get('winners-feed')
  async getWinnersFeed() {
    return this.lotteryService.getWinnersFeed();
  }

  @Get('pool-info')
  async getPoolInfo() {
    return this.lotteryService.getPoolInfo();
  }

  @Get('status')
  async getLotteryStatus() {
    const activeRound = await this.lotteryService.getActiveRound();
    const latestRound = await this.lotteryService.getLatestRound();
    const systemSettings = await this.systemService.getSettings();
    const now = new Date();
    
    return {
      currentTime: now.toISOString(),
      activeRound: activeRound ? {
        id: activeRound.id,
        roundNumber: activeRound.roundNumber,
        status: activeRound.status,
        drawTime: activeRound.drawTime,
        drawTimeReached: now >= activeRound.drawTime,
        timeUntilDraw: activeRound.drawTime.getTime() - now.getTime(),
        totalPool: Number(activeRound.totalPool),
      } : null,
      latestRound: latestRound ? {
        id: latestRound.id,
        roundNumber: latestRound.roundNumber,
        status: latestRound.status,
        winningBlock: latestRound.winningBlock,
        drawnAt: latestRound.drawnAt,
      } : null,
      systemSettings: {
        newRoundsPaused: systemSettings.newRoundsPaused,
        bettingPaused: systemSettings.bettingPaused,
        withdrawalsPaused: systemSettings.withdrawalsPaused,
      },
      hasActiveRound: !!activeRound,
      isRoundStuck: activeRound ? now >= activeRound.drawTime : false,
      needsAttention: (!activeRound) || (activeRound && now >= activeRound.drawTime) || systemSettings.newRoundsPaused,
    };
  }

  /**
   * Manual trigger for lottery check - useful for fixing stuck rounds
   * This is a POST endpoint to prevent accidental triggering
   */
  @Post('trigger-check')
  async triggerLotteryCheck() {
    console.log('🎲 [LotteryController] Manual lottery check triggered');
    try {
      await this.lotteryService.runLottery();
      const activeRound = await this.lotteryService.getActiveRound();
      return {
        success: true,
        message: 'Lottery check completed',
        activeRound: activeRound ? {
          roundNumber: activeRound.roundNumber,
          status: activeRound.status,
          drawTime: activeRound.drawTime,
        } : null,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
