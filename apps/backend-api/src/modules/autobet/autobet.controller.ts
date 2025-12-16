import { Controller, Post, Body, Get, UseGuards, Request, Param } from '@nestjs/common';
import { AutoBetService } from './autobet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAutoBetDto } from './dto/create-autobet.dto';

@Controller('autobet')
export class AutoBetController {
  constructor(private autobetService: AutoBetService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPlan(@Request() req, @Body() createAutoBetDto: CreateAutoBetDto) {
    return this.autobetService.createPlan(
      req.user.id,
      createAutoBetDto.blocks,
      createAutoBetDto.betAmountPerBlock,
      createAutoBetDto.totalRounds,
    );
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelPlan(@Request() req, @Param('id') id: string) {
    return this.autobetService.cancelPlan(id, req.user.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyPlans(@Request() req) {
    return this.autobetService.getUserPlans(req.user.id);
  }
}

