import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { DepositsService } from './deposits.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateDepositDto } from './dto/create-deposit.dto';

@Controller('deposits')
export class DepositsController {
  constructor(private depositsService: DepositsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createDeposit(@Request() req, @Body() createDepositDto: CreateDepositDto) {
    return this.depositsService.createDepositRequest(
      req.user.id,
      createDepositDto.usdtAmount,
    );
  }

  @Get('address')
  @UseGuards(JwtAuthGuard)
  async getDepositAddress(@Request() req) {
    // Generate unique memo (service handles uniqueness check)
    // Create a temporary deposit request to generate and reserve a unique memo
    // Note: This creates a pending deposit record that will be matched when actual deposit is detected
    const deposit = await this.depositsService.createDepositRequest(
      req.user.id,
      0, // Amount will be updated when actual deposit is detected
    );
    
    return {
      address: await this.depositsService.getDepositAddress(),
      memo: deposit.depositMemo,
      depositId: deposit.id,
    };
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyDeposits(@Request() req) {
    return this.depositsService.getUserDeposits(req.user.id);
  }
}
