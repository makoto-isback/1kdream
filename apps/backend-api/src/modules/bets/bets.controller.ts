import { Controller, Post, Body, Get, UseGuards, Request, Query } from '@nestjs/common';
import { BetsService } from './bets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateBetDto } from './dto/create-bet.dto';

@Controller('bets')
export class BetsController {
  constructor(private betsService: BetsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async placeBet(@Request() req, @Body() createBetDto: CreateBetDto) {
    return this.betsService.placeBet(
      req.user.id,
      createBetDto.blockNumber,
      createBetDto.amount,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyBets(@Request() req, @Query('limit') limit?: number) {
    return this.betsService.getUserBets(req.user.id, limit ? parseInt(limit.toString()) : 50);
  }
}
