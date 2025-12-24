import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateTonAddressDto } from './dto/update-ton-address.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 2000, ttl: 60000 } }) // 2000 requests per minute for user data
  async getMe(@Request() req) {
    return req.user;
  }

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 2000, ttl: 60000 } }) // 2000 requests per minute for balance
  async getBalance(@Request() req) {
    const user = await this.usersService.findOne(req.user.id);
    return {
      kyatBalance: user.kyatBalance,
      points: user.points,
    };
  }

  @Post('ton-address')
  @UseGuards(JwtAuthGuard)
  async updateTonAddress(@Request() req, @Body() dto: UpdateTonAddressDto) {
    return this.usersService.updateTonAddress(req.user.id, dto.tonAddress);
  }
}
