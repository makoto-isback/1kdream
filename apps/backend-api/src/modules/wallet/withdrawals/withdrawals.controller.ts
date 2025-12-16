import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { SystemService } from '../../system/system.service';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(
    private withdrawalsService: WithdrawalsService,
    private systemService: SystemService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createWithdrawal(@Request() req, @Body() createWithdrawalDto: CreateWithdrawalDto) {
    return this.withdrawalsService.createWithdrawalRequest(
      req.user.id,
      createWithdrawalDto.kyatAmount,
      createWithdrawalDto.tonAddress,
      this.systemService,
    );
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyWithdrawals(@Request() req) {
    return this.withdrawalsService.getUserWithdrawals(req.user.id);
  }
}
