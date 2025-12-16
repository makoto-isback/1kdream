import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LotteryService } from './lottery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lottery')
export class LotteryController {
  constructor(private lotteryService: LotteryService) {}

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
}
