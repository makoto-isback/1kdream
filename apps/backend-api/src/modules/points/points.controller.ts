import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedeemPointsDto } from './dto/redeem-points.dto';

@Controller('points')
export class PointsController {
  constructor(private pointsService: PointsService) {}

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeemPoints(@Request() req, @Body() redeemPointsDto: RedeemPointsDto) {
    return this.pointsService.redeemPoints(req.user.id, redeemPointsDto.points);
  }

  @Get('redemptions')
  @UseGuards(JwtAuthGuard)
  async getRedemptions(@Request() req) {
    return this.pointsService.getUserRedemptions(req.user.id);
  }
}

