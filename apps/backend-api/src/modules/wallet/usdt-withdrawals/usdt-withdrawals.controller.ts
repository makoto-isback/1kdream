import { Controller, Post, Get, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { UsdtWithdrawalsService } from './usdt-withdrawals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface CreateUsdtWithdrawalDto {
  kyatAmount: number;
  tonAddress: string;
}

@Controller('usdt/withdraw')
export class UsdtWithdrawalsController {
  constructor(private usdtWithdrawalsService: UsdtWithdrawalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createWithdrawal(@Request() req, @Body() dto: CreateUsdtWithdrawalDto) {
    if (!dto.kyatAmount || dto.kyatAmount <= 0) {
      throw new BadRequestException('kyatAmount must be greater than 0');
    }

    if (!dto.tonAddress) {
      throw new BadRequestException('tonAddress is required');
    }

    return await this.usdtWithdrawalsService.createWithdrawalRequest(
      req.user.id,
      dto.kyatAmount,
      dto.tonAddress,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyWithdrawals(@Request() req) {
    return await this.usdtWithdrawalsService.getUserWithdrawals(req.user.id);
  }
}

