import { Controller, Post, Get, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { UsdtDepositsService } from './usdt-deposits.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface CreateUsdtDepositDto {
  txHash: string;
  kyatAmount: number;
  walletAddress: string;
}

@Controller('usdt/deposit')
export class UsdtDepositsController {
  constructor(private usdtDepositsService: UsdtDepositsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createDeposit(@Request() req, @Body() dto: CreateUsdtDepositDto) {
    if (!dto.txHash || !dto.walletAddress) {
      throw new BadRequestException('txHash and walletAddress are required');
    }

    if (!dto.kyatAmount || dto.kyatAmount <= 0) {
      throw new BadRequestException('kyatAmount must be greater than 0');
    }

    return await this.usdtDepositsService.verifyAndProcessDeposit(
      req.user.id,
      dto.txHash,
      dto.kyatAmount,
      dto.walletAddress,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyDeposits(@Request() req) {
    return await this.usdtDepositsService.getUserDeposits(req.user.id);
  }
}

