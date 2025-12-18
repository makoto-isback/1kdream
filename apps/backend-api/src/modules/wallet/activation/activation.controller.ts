import { Controller, Post, Get, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ActivationService } from './activation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface VerifyActivationDto {
  txHash: string;
  walletAddress: string;
}

@Controller('activation')
export class ActivationController {
  constructor(private activationService: ActivationService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Request() req) {
    return await this.activationService.getActivationStatus(req.user.id);
  }

  @Get('wallet-address')
  @UseGuards(JwtAuthGuard)
  async getWalletAddress() {
    return {
      address: this.activationService.getPlatformWalletAddress(),
      amount: '1', // 1 TON
    };
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  async verifyActivation(@Request() req, @Body() dto: VerifyActivationDto) {
    if (!dto.txHash || !dto.walletAddress) {
      throw new BadRequestException('txHash and walletAddress are required');
    }

    return await this.activationService.verifyAndActivate(
      req.user.id,
      dto.txHash,
      dto.walletAddress,
    );
  }
}

