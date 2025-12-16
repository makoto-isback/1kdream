import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

export interface TelegramInitData {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateTelegramUser(initData: TelegramInitData) {
    // In production, verify the hash from Telegram
    // For now, we'll trust the data
    const user = await this.usersService.findOrCreateByTelegramId(
      initData.id,
      {
        firstName: initData.first_name,
        lastName: initData.last_name,
        username: initData.username,
      },
    );

    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, telegramId: user.telegramId };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

