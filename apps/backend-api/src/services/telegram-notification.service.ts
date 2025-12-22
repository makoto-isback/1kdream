import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramNotificationService implements OnModuleInit {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private botToken: string | null = null;
  private adminChatId: string | null = null;
  private isEnabled: boolean = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || null;
    this.adminChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID') || null;

    if (this.botToken && this.adminChatId) {
      this.isEnabled = true;
      this.logger.log('[TELEGRAM NOTIFICATIONS] ✅ Enabled - Bot token and admin chat ID configured');
    } else {
      this.isEnabled = false;
      if (!this.botToken) {
        this.logger.warn('[TELEGRAM NOTIFICATIONS] ⚠️ Disabled - TELEGRAM_BOT_TOKEN not set');
      }
      if (!this.adminChatId) {
        this.logger.warn('[TELEGRAM NOTIFICATIONS] ⚠️ Disabled - TELEGRAM_ADMIN_CHAT_ID not set');
      }
    }
  }

  /**
   * Send a message to the admin via Telegram
   */
  private async sendMessage(text: string): Promise<void> {
    if (!this.isEnabled) {
      return; // Silently skip if not configured
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: this.adminChatId,
        text,
        parse_mode: 'HTML',
      });
    } catch (error: any) {
      // Log error but don't throw - notifications are non-critical
      this.logger.error('[TELEGRAM NOTIFICATIONS] Failed to send message:', error.message);
    }
  }

  /**
   * Format TON address for display (show first 6 and last 4 characters)
   */
  private formatTonAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Format username for display
   */
  private formatUsername(user: { username?: string | null; firstName?: string | null; lastName?: string | null }): string {
    if (user.username) {
      return `@${user.username}`;
    }
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
    return name;
  }

  /**
   * Notify when a new withdrawal request is created
   */
  async notifyNewWithdrawal(
    withdrawal: {
      id: string;
      kyatAmount: number;
      usdtAmount: number;
      tonAddress: string;
      requestTime: Date;
    },
    user: { username?: string | null; firstName?: string | null; lastName?: string | null; telegramId?: string },
  ): Promise<void> {
    const isLarge = withdrawal.kyatAmount >= 50000;
    const emoji = isLarge ? '⚠️' : '🚨';
    const largeAlert = isLarge ? '\n⚠️ <b>LARGE WITHDRAWAL ALERT</b>' : '';
    
    const username = this.formatUsername(user);
    const formattedAddress = this.formatTonAddress(withdrawal.tonAddress);
    const requestTime = new Date(withdrawal.requestTime).toLocaleString('en-US', {
      timeZone: 'Asia/Yangon',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    
    const processAfter = new Date(withdrawal.requestTime.getTime() + 60 * 60 * 1000).toLocaleString('en-US', {
      timeZone: 'Asia/Yangon',
      hour: '2-digit',
      minute: '2-digit',
    });

    const message = `${emoji} <b>NEW WITHDRAWAL REQUEST</b>${largeAlert}

👤 <b>User:</b> ${username}
💰 <b>Amount:</b> ${withdrawal.kyatAmount.toLocaleString()} KYAT (${withdrawal.usdtAmount.toFixed(6)} USDT)
📍 <b>TON Address:</b> <code>${formattedAddress}</code>
📅 <b>Requested:</b> ${requestTime}
⏰ <b>Can process after:</b> ${processAfter} (1 hour)

🆔 <b>Withdrawal ID:</b> <code>${withdrawal.id}</code>
📊 <b>Status:</b> PENDING

<i>Process via Admin Panel after 1 hour</i>`;

    await this.sendMessage(message);
  }

  /**
   * Notify when a withdrawal is ready to process (1 hour has passed)
   */
  async notifyWithdrawalReady(
    withdrawal: {
      id: string;
      kyatAmount: number;
      usdtAmount: number;
      tonAddress: string;
      requestTime: Date;
    },
    user: { username?: string | null; firstName?: string | null; lastName?: string | null },
  ): Promise<void> {
    const username = this.formatUsername(user);
    const formattedAddress = this.formatTonAddress(withdrawal.tonAddress);
    const requestTime = new Date(withdrawal.requestTime).toLocaleString('en-US', {
      timeZone: 'Asia/Yangon',
      hour: '2-digit',
      minute: '2-digit',
    });

    const message = `✅ <b>WITHDRAWAL READY TO PROCESS</b>

🆔 <b>ID:</b> <code>${withdrawal.id}</code>
👤 <b>User:</b> ${username}
💰 <b>Amount:</b> ${withdrawal.kyatAmount.toLocaleString()} KYAT (${withdrawal.usdtAmount.toFixed(6)} USDT)
📍 <b>TON Address:</b> <code>${formattedAddress}</code>
📅 <b>Requested:</b> ${requestTime} (1 hour ago)

🔗 <b>Process:</b> POST /admin/withdrawals/${withdrawal.id}/complete`;

    await this.sendMessage(message);
  }

  /**
   * Notify when a withdrawal is completed
   */
  async notifyWithdrawalCompleted(
    withdrawal: {
      id: string;
      kyatAmount: number;
      usdtAmount: number;
      tonTxHash: string | null;
    },
    user: { username?: string | null; firstName?: string | null; lastName?: string | null },
  ): Promise<void> {
    const username = this.formatUsername(user);
    const txHash = withdrawal.tonTxHash ? `<code>${withdrawal.tonTxHash}</code>` : 'Pending';

    const message = `✅ <b>WITHDRAWAL COMPLETED</b>

👤 <b>User:</b> ${username}
💰 <b>Amount:</b> ${withdrawal.kyatAmount.toLocaleString()} KYAT (${withdrawal.usdtAmount.toFixed(6)} USDT)
🔗 <b>TX Hash:</b> ${txHash}
🆔 <b>ID:</b> <code>${withdrawal.id}</code>`;

    await this.sendMessage(message);
  }

  /**
   * Notify when a withdrawal is rejected
   */
  async notifyWithdrawalRejected(
    withdrawal: {
      id: string;
      kyatAmount: number;
      usdtAmount: number;
    },
    user: { username?: string | null; firstName?: string | null; lastName?: string | null },
    reason?: string,
  ): Promise<void> {
    const username = this.formatUsername(user);
    const reasonText = reason ? `\n📝 <b>Reason:</b> ${reason}` : '';

    const message = `❌ <b>WITHDRAWAL REJECTED</b>

👤 <b>User:</b> ${username}
💰 <b>Amount:</b> ${withdrawal.kyatAmount.toLocaleString()} KYAT (${withdrawal.usdtAmount.toFixed(6)} USDT)
🆔 <b>ID:</b> <code>${withdrawal.id}</code>${reasonText}

<i>Balance has been refunded to user</i>`;

    await this.sendMessage(message);
  }
}

