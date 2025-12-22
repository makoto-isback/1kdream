import { Controller, Post, Body, Get, HttpCode, Logger } from '@nestjs/common';
import { TelegramBotService } from '../../services/telegram-bot.service';

@Controller('telegram')
export class TelegramBotController {
  private readonly logger = new Logger(TelegramBotController.name);

  constructor(private telegramBotService: TelegramBotService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() body: any) {
    this.logger.log(`[WEBHOOK] 📨 Received update from Telegram`);
    this.logger.log(`[WEBHOOK] Update data: ${JSON.stringify(body)}`);
    try {
      await this.telegramBotService.handleUpdate(body);
      this.logger.log(`[WEBHOOK] ✅ Update processed successfully`);
      return { ok: true };
    } catch (error: any) {
      this.logger.error(`[WEBHOOK] ❌ Error handling update:`, error);
      this.logger.error(`[WEBHOOK] Error stack:`, error.stack);
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

  @Post('set-commands')
  async setCommands() {
    return await this.telegramBotService.setBotCommands();
  }
}

