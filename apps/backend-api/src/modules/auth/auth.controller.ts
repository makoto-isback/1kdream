import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  async loginWithTelegram(@Body() body: { initData?: string } | any) {
    try {
      // Support both formats:
      // 1. New format: { initData: string } - parse the initData string
      // 2. Legacy format: { id, first_name, ... } - use directly
      let parsedData: any;

      if (body.initData && typeof body.initData === 'string') {
        // Parse Telegram initData string (URL-encoded format)
        // Format: user={...}&auth_date=...&hash=...
        parsedData = this.parseInitDataString(body.initData);
      } else {
        // Legacy format: already parsed object
        parsedData = body;
      }

      // Basic safety: require a Telegram ID
      if (!parsedData || !parsedData.id) {
        console.warn('[AUTH] ❌ Telegram auth failed: missing id in initData/body');
        throw new UnauthorizedException('Invalid Telegram init data');
      }

      const user = await this.authService.validateTelegramUser(parsedData);
      const result = await this.authService.login(user);

      // Log JWT issuance for debugging
      console.log('[AUTH] ✅ Telegram auth successful for user:', user.id, 'telegramId:', user.telegramId);
      console.log('[AUTH] ✅ JWT token length:', result.access_token?.length || 0);

      return result;
    } catch (error) {
      // NEVER let unexpected errors bubble as 500 – always convert to 401
      console.error('[AUTH] ❌ Telegram login error:', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Telegram authentication failed');
    }
  }

  /**
   * Parse Telegram initData string into object
   * Format: user={"id":123}&auth_date=1234567890&hash=abc123
   */
  private parseInitDataString(initData: string): any {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    
    let user: any = {};
    if (userStr) {
      try {
        user = JSON.parse(decodeURIComponent(userStr));
      } catch {
        // Fallback: try parsing as-is
        try {
          user = JSON.parse(userStr);
        } catch {
          user = {};
        }
      }
    }
    
    return {
      id: user.id?.toString() || params.get('id') || '',
      first_name: user.first_name || params.get('first_name') || '',
      last_name: user.last_name || params.get('last_name') || '',
      username: user.username || params.get('username') || '',
      auth_date: parseInt(params.get('auth_date') || '0', 10),
      hash: params.get('hash') || '',
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req) {
    return req.user;
  }
}
