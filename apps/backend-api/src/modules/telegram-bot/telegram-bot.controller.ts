import { Controller, Post, Body, Get, HttpCode, Logger } from '@nestjs/common';
import { TelegramBotService } from '../../services/telegram-bot.service';

@Controller('telegram')
export class TelegramBotController {
  private readonly logger = new Logger(TelegramBotController.name);

  constructor(private telegramBotService: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.debug(`[WEBHOOK] Received update: ${JSON.stringify(body)}`);
    try {
      await this.telegramBotService.handleUpdate(body);
      return { ok: true };
    } catch (error: any) {
      this.logger.error(`[WEBHOOK] Error handling update:`, error);
      return { ok: false, error: error.message };
    }
  }

  @Get('webhook')
  async verifyWebhook() {
    return { status: 'ok', message: 'Telegram webhook endpoint is active' };
  }

  @Get('webhook-info')
  async getWebhookInfo() {
    return await this.telegramBotService.getWebhookInfo();
  }

  @Post('set-webhook')
  async setWebhook() {
    return await this.telegramBotService.setWebhook();
  }
}

