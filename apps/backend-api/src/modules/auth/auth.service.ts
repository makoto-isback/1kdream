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
    // For now, we'll trust the data but still validate presence of id
    if (!initData || !initData.id) {
      throw new UnauthorizedException('Invalid Telegram data: missing id');
    }

    try {
      const user = await this.usersService.findOrCreateByTelegramId(
        initData.id,
        {
          firstName: initData.first_name,
          lastName: initData.last_name,
          username: initData.username,
        },
      );

      return user;
    } catch (error) {
      // Wrap any DB or unexpected errors as Unauthorized so controller
      // can consistently respond with 401 instead of 500
      console.error('[AUTH] Error creating/finding user by Telegram ID:', error);
      throw new UnauthorizedException('Failed to create or load user');
    }
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

