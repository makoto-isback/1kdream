import { Controller, Post, Body, Get, UseGuards, Request, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BetsService } from './bets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBetDto } from './dto/create-bet.dto';

@Controller('bets')
export class BetsController {
  constructor(private betsService: BetsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ bets: { limit: 100, ttl: 60000 } }) // 100 bet placements per minute (allows multiple bets at once)
  async placeBet(@Request() req, @Body() createBetDto: CreateBetDto) {
    return this.betsService.placeBet(
      req.user.id,
      createBetDto.blockNumber,
      createBetDto.amount,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 300, ttl: 60000 } }) // 300 requests per minute for bet history
  async getMyBets(@Request() req, @Query('limit') limit?: number) {
    return this.betsService.getUserBets(req.user.id, limit ? parseInt(limit.toString()) : 50);
  }
}
