import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  async loginWithTelegram(@Body() body: { initData?: string } | any) {
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
    
    const user = await this.authService.validateTelegramUser(parsedData);
    return this.authService.login(user);
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
