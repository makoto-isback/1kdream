import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
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
    private configService: ConfigService,
  ) {}

  async validateTelegramUser(initData: TelegramInitData, originalInitDataString?: string | null) {
    if (!initData || !initData.id) {
      throw new UnauthorizedException('Invalid Telegram data: missing id');
    }

    // Verify Telegram hash if hash is provided
    if (initData.hash) {
      const isValid = originalInitDataString 
        ? this.verifyTelegramHashFromString(originalInitDataString)
        : this.verifyTelegramHash(initData);
      
      if (!isValid) {
        console.warn('[AUTH] ❌ Telegram hash verification failed');
        throw new UnauthorizedException('Invalid Telegram authentication hash');
      }
      console.log('[AUTH] ✅ Telegram hash verified');
    } else {
      // In development, allow without hash for easier testing
      const isDev = this.configService.get('NODE_ENV') === 'development';
      if (!isDev) {
        console.warn('[AUTH] ⚠️ No hash provided in production - this should not happen');
        throw new UnauthorizedException('Telegram hash required');
      }
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

  /**
   * Verify Telegram initData hash from original string (preferred method)
   * Algorithm: HMAC-SHA256 with bot token as secret key
   * 
   * @param initDataString Original URL-encoded initData string
   * @returns true if hash is valid, false otherwise
   */
  private verifyTelegramHashFromString(initDataString: string): boolean {
    try {
      // Get bot token (use command bot token for Mini App authentication)
      const botToken = this.configService.get<string>('TELEGRAM_COMMAND_BOT_TOKEN');
      if (!botToken) {
        console.warn('[AUTH] ⚠️ Bot token not configured - cannot verify hash');
        // In development, allow without verification
        return this.configService.get('NODE_ENV') === 'development';
      }

      // Parse the initData string
      const params = new URLSearchParams(initDataString);
      const providedHash = params.get('hash');
      
      if (!providedHash) {
        return false;
      }

      // Remove hash from params and create data check string
      params.delete('hash');
      
      // Sort parameters alphabetically and create data check string
      // Format: key1=value1\nkey2=value2\n... (sorted, newline-separated)
      const sortedKeys = Array.from(params.keys()).sort();
      const dataCheckString = sortedKeys
        .map(key => `${key}=${params.get(key)}`)
        .join('\n');

      // Create secret key: HMAC-SHA256("WebAppData", bot_token)
      const secretKey = createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
      
      // Create hash: HMAC-SHA256(secret_key, data_check_string)
      const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // Compare hashes (constant-time comparison to prevent timing attacks)
      return this.constantTimeCompare(calculatedHash, providedHash);
    } catch (error) {
      console.error('[AUTH] Error verifying Telegram hash from string:', error);
      return false;
    }
  }

  /**
   * Verify Telegram initData hash from parsed object (fallback method)
   * Algorithm: HMAC-SHA256 with bot token as secret key
   * 
   * @param initData Telegram initData object
   * @returns true if hash is valid, false otherwise
   */
  private verifyTelegramHash(initData: TelegramInitData): boolean {
    try {
      // Get bot token (use command bot token for Mini App authentication)
      const botToken = this.configService.get<string>('TELEGRAM_COMMAND_BOT_TOKEN');
      if (!botToken) {
        console.warn('[AUTH] ⚠️ Bot token not configured - cannot verify hash');
        // In development, allow without verification
        return this.configService.get('NODE_ENV') === 'development';
      }

      // Reconstruct data check string from object
      const dataCheckString = this.createDataCheckString(initData);
      
      // Create secret key: HMAC-SHA256("WebAppData", bot_token)
      const secretKey = createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();
      
      // Create hash: HMAC-SHA256(secret_key, data_check_string)
      const calculatedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // Compare hashes (constant-time comparison to prevent timing attacks)
      return this.constantTimeCompare(calculatedHash, initData.hash);
    } catch (error) {
      console.error('[AUTH] Error verifying Telegram hash:', error);
      return false;
    }
  }

  /**
   * Create data check string from initData (excluding hash)
   * Format: key1=value1&key2=value2 (sorted alphabetically)
   */
  private createDataCheckString(initData: TelegramInitData): string {
    const params: string[] = [];

    if (initData.id) params.push(`id=${initData.id}`);
    if (initData.first_name) params.push(`first_name=${initData.first_name}`);
    if (initData.last_name) params.push(`last_name=${initData.last_name}`);
    if (initData.username) params.push(`username=${initData.username}`);
    if (initData.auth_date) params.push(`auth_date=${initData.auth_date}`);

    // Sort alphabetically
    params.sort();

    return params.join('\n');
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  async login(user: any) {
    const payload = { sub: user.id, telegramId: user.telegramId };
    
    // DEBUG: Log user object to verify isAdmin is included
    console.log('[AUTH] Login user object:', {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      isAdmin: user.isAdmin,
      isActivated: user.isActivated,
    });
    
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

