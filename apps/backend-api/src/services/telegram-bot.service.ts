import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UsersService } from '../modules/users/users.service';
import { LotteryService } from '../modules/lottery/lottery.service';
import { BetsService } from '../modules/bets/bets.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bet } from '../modules/bets/entities/bet.entity';
import { LotteryRound, LotteryRoundStatus } from '../modules/lottery/entities/lottery-round.entity';
import { botTranslations, Language } from './telegram-bot-translations';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private readonly logger = new Logger(TelegramBotService.name);
  private botToken: string | null = null;
  private webhookUrl: string | null = null;
  private isEnabled: boolean = false;
  private frontendUrl: string;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private lotteryService: LotteryService,
    private betsService: BetsService,
    @InjectRepository(Bet)
    private betsRepository: Repository<Bet>,
    @InjectRepository(LotteryRound)
    private roundsRepository: Repository<LotteryRound>,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://your-frontend-url.com';
  }

  async onModuleInit() {
    this.logger.log('[TELEGRAM BOT] 🚀 Initializing Telegram Bot Service...');
    
    // Use COMMAND_BOT_TOKEN for user commands (separate from notification bot)
    this.botToken = this.configService.get<string>('TELEGRAM_COMMAND_BOT_TOKEN') || null;
    this.webhookUrl = this.configService.get<string>('TELEGRAM_WEBHOOK_URL') || null;

    this.logger.log(`[TELEGRAM BOT] Command Bot Token: ${this.botToken ? '✅ Set' : '❌ Missing'}`);
    this.logger.log(`[TELEGRAM BOT] Webhook URL: ${this.webhookUrl || '❌ Missing'}`);

    if (this.botToken) {
      this.isEnabled = true;
      this.logger.log('[TELEGRAM BOT] ✅ Command bot enabled and ready');
      
      // Set webhook if URL is provided
      if (this.webhookUrl) {
        this.logger.log(`[TELEGRAM BOT] 🔗 Setting webhook to: ${this.webhookUrl}/telegram/webhook`);
        await this.setWebhook();
      } else {
        this.logger.warn('[TELEGRAM BOT] ⚠️ No webhook URL set - set TELEGRAM_WEBHOOK_URL to enable commands');
      }
      
      // Register bot commands so they show up when user types "/"
      await this.setBotCommands();
    } else {
      this.logger.error('[TELEGRAM BOT] ❌ Disabled - TELEGRAM_COMMAND_BOT_TOKEN not set');
    }
    
    this.logger.log(`[TELEGRAM BOT] 📊 Status: ${this.isEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  async setWebhook() {
    if (!this.botToken || !this.webhookUrl) {
      return { ok: false, error: 'Command bot token or webhook URL not configured' };
    }
    
    try {
      const webhookPath = `${this.webhookUrl}/telegram/webhook`;
      const url = `https://api.telegram.org/bot${this.botToken}/setWebhook`;
      
      // Get webhook secret if configured
      const webhookSecret = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');
      
      this.logger.log(`[TELEGRAM BOT] Setting webhook to: ${webhookPath}`);
      if (webhookSecret) {
        this.logger.log(`[TELEGRAM BOT] Using webhook secret token for verification`);
      }
      
      const webhookData: any = {
        url: webhookPath,
      };
      
      // Add secret token if configured
      if (webhookSecret) {
        webhookData.secret_token = webhookSecret;
      }
      
      const response = await axios.post(url, webhookData);
      
      if (response.data.ok) {
        this.logger.log(`[TELEGRAM BOT] ✅ Webhook set successfully: ${webhookPath}`);
        this.logger.log(`[TELEGRAM BOT] Webhook info: ${JSON.stringify(response.data.result)}`);
        return { ok: true, result: response.data.result };
      } else {
        this.logger.error(`[TELEGRAM BOT] Failed to set webhook: ${response.data.description || 'Unknown error'}`);
        return { ok: false, error: response.data.description || 'Unknown error' };
      }
    } catch (error: any) {
      const errorMsg = error.response?.data || error.message;
      this.logger.error(`[TELEGRAM BOT] ❌ Failed to set webhook:`, errorMsg);
      return { ok: false, error: errorMsg };
    }
  }

  async getWebhookInfo() {
    if (!this.botToken) {
      return { ok: false, error: 'Command bot token not configured' };
    }
    
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/getWebhookInfo`;
      const response = await axios.get(url);
      return response.data;
    } catch (error: any) {
      this.logger.error(`[TELEGRAM BOT] Failed to get webhook info:`, error.message);
      return { ok: false, error: error.message };
    }
  }

  async setBotCommands() {
    if (!this.botToken) {
      this.logger.warn('[TELEGRAM BOT] ⚠️ Cannot set bot commands - token not configured');
      return { ok: false, error: 'Command bot token not configured' };
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/setMyCommands`;
      
      const commands = [
        { command: 'start', description: 'Welcome message and game explanation' },
        { command: 'help', description: 'Show all available commands' },
        { command: 'rules', description: 'Display game rules and limits' },
        { command: 'play', description: 'Open the game app' },
        { command: 'round', description: 'Current round info' },
        { command: 'pool', description: 'Current prize pool amount' },
        { command: 'mybets', description: 'Your bets in current round' },
        { command: 'history', description: 'Your betting history' },
        { command: 'winners', description: 'Recent winners list' },
        { command: 'balance', description: 'Check your KYAT balance and points' },
        { command: 'deposit', description: 'Deposit instructions (TON USDT)' },
        { command: 'withdraw', description: 'Withdrawal info and limits' },
        { command: 'points', description: 'Points system explanation' },
        { command: 'support', description: 'Contact support team' },
      ];

      const response = await axios.post(url, { commands });
      
      if (response.data.ok) {
        this.logger.log(`[TELEGRAM BOT] ✅ Bot commands registered successfully (${commands.length} commands)`);
        return { ok: true, commands: commands.length };
      } else {
        this.logger.error(`[TELEGRAM BOT] Failed to register commands: ${response.data.description || 'Unknown error'}`);
        return { ok: false, error: response.data.description || 'Unknown error' };
      }
    } catch (error: any) {
      const errorMsg = error.response?.data || error.message;
      this.logger.error(`[TELEGRAM BOT] ❌ Failed to register bot commands:`, errorMsg);
      return { ok: false, error: errorMsg };
    }
  }

  async handleUpdate(update: any) {
    this.logger.log(`[TELEGRAM BOT] 🔄 Processing update...`);
    
    if (!this.isEnabled) {
      this.logger.warn('[TELEGRAM BOT] ⚠️ Received update but bot is disabled');
      return;
    }

    if (!this.botToken) {
      this.logger.error('[TELEGRAM BOT] ❌ Bot token not set');
      return;
    }

    this.logger.log(`[TELEGRAM BOT] 📥 Update received: ${JSON.stringify(update)}`);

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const telegramId = callbackQuery.from.id.toString();
      const data = callbackQuery.data;

      this.logger.log(`[TELEGRAM BOT] 🔘 Callback query from user ${telegramId}: ${data}`);

      if (data && data.startsWith('lang_')) {
        const language = data.split('_')[1] as Language;
        await this.handleLanguageSelection(chatId, telegramId, language, callbackQuery.id);
        return;
      }

      // Answer callback query to remove loading state
      await this.answerCallbackQuery(callbackQuery.id);
      return;
    }

    const message = update.message;
    if (!message) {
      this.logger.log('[TELEGRAM BOT] ⚠️ Update has no message field');
      return;
    }

    if (!message.text) {
      this.logger.log('[TELEGRAM BOT] ⚠️ Message has no text field, ignoring');
      return;
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const telegramId = message.from?.id?.toString();

    if (!telegramId) {
      this.logger.error('[TELEGRAM BOT] ❌ No telegram ID in message');
      return;
    }

    this.logger.log(`[TELEGRAM BOT] 👤 User ${telegramId} sent: "${text}"`);

    // Handle commands
    if (text.startsWith('/')) {
      const command = text.split(' ')[0].toLowerCase();
      this.logger.log(`[TELEGRAM BOT] 🎯 Executing command: ${command}`);
      await this.handleCommand(command, chatId, telegramId, text);
    } else {
      // Echo non-commands
      this.logger.log(`[TELEGRAM BOT] 💬 Non-command message, sending help`);
      const user = await this.usersService.findByTelegramId(telegramId);
      const lang = (user?.language || 'en') as Language;
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.errors.nonCommandMessage);
    }
  }

  private async handleCommand(command: string, chatId: number, telegramId: string, fullText: string) {
    try {
      const lang = await this.getUserLanguage(telegramId);
      const t = botTranslations[lang];

      switch (command) {
        case '/start':
          await this.handleStart(chatId, telegramId);
          break;
        case '/help':
          await this.handleHelp(chatId, lang);
          break;
        case '/rules':
          await this.handleRules(chatId, lang);
          break;
        case '/play':
          await this.handlePlay(chatId, lang);
          break;
        case '/round':
          await this.handleRound(chatId, telegramId, lang);
          break;
        case '/pool':
          await this.handlePool(chatId, telegramId, lang);
          break;
        case '/mybets':
          await this.handleMyBets(chatId, telegramId, lang);
          break;
        case '/history':
          await this.handleHistory(chatId, telegramId, lang);
          break;
        case '/winners':
          await this.handleWinners(chatId, lang);
          break;
        case '/balance':
          await this.handleBalance(chatId, telegramId, lang);
          break;
        case '/deposit':
          await this.handleDeposit(chatId, telegramId, lang);
          break;
        case '/withdraw':
          await this.handleWithdraw(chatId, lang);
          break;
        case '/points':
          await this.handlePoints(chatId, telegramId, lang);
          break;
        case '/support':
          await this.handleSupport(chatId, lang);
          break;
        default:
          await this.sendMessage(chatId, t.errors.unknownCommand);
      }
    } catch (error: any) {
      this.logger.error(`[TELEGRAM BOT] Error handling command ${command}:`, error);
      const lang = await this.getUserLanguage(telegramId);
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.errors.errorOccurred);
    }
  }

  // Helper method to get user's language
  private async getUserLanguage(telegramId: string): Promise<Language> {
    const user = await this.usersService.findByTelegramId(telegramId);
    return (user?.language || 'en') as Language;
  }

  // Handle language selection callback
  private async handleLanguageSelection(chatId: number, telegramId: string, language: Language, callbackQueryId: string) {
    try {
      // Update user's language preference
      await this.usersService.updateLanguageByTelegramId(telegramId, language);
      
      // Answer callback query
      await this.answerCallbackQuery(callbackQueryId, `Language set to ${language === 'en' ? 'English' : 'မြန်မာ'}`);

      // Send welcome message in selected language
      const t = botTranslations[language];
      await this.sendMessage(chatId, t.welcome);
      
      this.logger.log(`[TELEGRAM BOT] ✅ Language set to ${language} for user ${telegramId}`);
    } catch (error: any) {
      this.logger.error(`[TELEGRAM BOT] ❌ Error handling language selection:`, error);
      await this.answerCallbackQuery(callbackQueryId, 'Error setting language. Please try again.');
    }
  }

  // Answer callback query
  private async answerCallbackQuery(callbackQueryId: string, text?: string) {
    if (!this.botToken) return;
    
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`;
      await axios.post(url, {
        callback_query_id: callbackQueryId,
        text: text || 'OK',
        show_alert: false,
      });
    } catch (error: any) {
      this.logger.error(`[TELEGRAM BOT] ❌ Failed to answer callback query:`, error);
    }
  }

  // Command handlers
  private async handleStart(chatId: number, telegramId?: string) {
    // Always show language selection on /start
    // This allows users to change their language preference anytime
    const t = botTranslations.en; // Use English for language selection UI
    const message = `${t.languageSelection.title}\n\n${t.languageSelection.chooseLanguage}\n\n${t.languageSelection.english}\n${t.languageSelection.burmese}`;

    await this.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          { text: t.languageSelection.english, callback_data: 'lang_en' },
          { text: t.languageSelection.burmese, callback_data: 'lang_my' }
        ]]
      }
    });
  }

  private async handleHelp(chatId: number, lang: Language) {
    const t = botTranslations[lang];
    await this.sendMessage(chatId, t.help);
  }

  private async handleRules(chatId: number, lang: Language) {
    const t = botTranslations[lang];
    await this.sendMessage(chatId, t.rules);
  }

  private async handlePlay(chatId: number, lang: Language) {
    const t = botTranslations[lang];
    await this.sendMessage(chatId, t.play.title, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: t.play.button,
            web_app: { url: this.frontendUrl }
          }
        ]]
      }
    });
  }

  private async handleRound(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.round.userNotFound);
        return;
      }

      const round = await this.lotteryService.getActiveRound();
      if (!round) {
        await this.sendMessage(chatId, t.round.noActiveRound);
        return;
      }

      const now = new Date();
      const drawTime = new Date(round.drawTime);
      const remaining = Math.max(0, drawTime.getTime() - now.getTime());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      // Get user's stake in this round
      const userBets = await this.betsRepository.find({
        where: { userId: user.id, lotteryRoundId: round.id },
      });
      const userStake = userBets.reduce((sum, bet) => sum + Number(bet.amount), 0);

      const message = `${t.round.title} #${round.roundNumber}</b>

${t.round.timeRemaining} ${minutes}:${seconds.toString().padStart(2, '0')}
${t.round.prizePool} ${Number(round.totalPool).toLocaleString()} Ks
${t.round.winnerPool} ${Number(round.winnerPool).toLocaleString()} Ks (90%)

${t.round.yourStake} ${userStake.toLocaleString()} Ks

Use /play to place bets! 🎲`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleRound:', error);
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.round.error);
    }
  }

  private async handlePool(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.pool.userNotFound);
        return;
      }

      const round = await this.lotteryService.getActiveRound();
      if (!round) {
        await this.sendMessage(chatId, t.pool.noActiveRound);
        return;
      }

      const adminFee = Number(round.totalPool) * 0.1;
      const winnerPool = Number(round.winnerPool);

      const message = `${t.pool.title}

${t.pool.totalPool} ${Number(round.totalPool).toLocaleString()} Ks
${t.pool.winnerPool} ${winnerPool.toLocaleString()} Ks (90%)
${t.pool.adminFee} ${adminFee.toLocaleString()} Ks (10%)

${t.pool.round} #${round.roundNumber}

Use /play to join! 🎯`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.pool.error);
    }
  }

  private async handleMyBets(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.myBets.userNotFound);
        return;
      }

      const round = await this.lotteryService.getActiveRound();
      if (!round) {
        await this.sendMessage(chatId, t.myBets.noActiveRound);
        return;
      }

      const bets = await this.betsRepository.find({
        where: { userId: user.id, lotteryRoundId: round.id },
        order: { createdAt: 'DESC' },
      });

      if (bets.length === 0) {
        await this.sendMessage(chatId, `${t.myBets.noBets}\n\n${t.round.title} #${round.roundNumber}\n\nUse /play to place your first bet! 🎲`);
        return;
      }

      const totalStake = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
      const blocks = [...new Set(bets.map(bet => bet.blockNumber))].sort((a, b) => a - b);

      let message = `${t.myBets.title} - ${t.round.title} #${round.roundNumber}</b>\n\n`;
      message += `${t.myBets.totalStake} ${totalStake.toLocaleString()} Ks\n`;
      message += `${t.myBets.blocks} ${blocks.join(', ')}\n\n`;
      message += `<b>Bets:</b>\n`;

      bets.forEach((bet, index) => {
        message += `${index + 1}. Block ${bet.blockNumber}: ${Number(bet.amount).toLocaleString()} Ks\n`;
      });

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.myBets.error);
    }
  }

  private async handleHistory(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.history.userNotFound);
        return;
      }

      const bets = await this.betsService.getUserBets(user.id, 10);

      if (bets.length === 0) {
        await this.sendMessage(chatId, `${t.history.noHistory}\n\nUse /play to place your first bet! 🎲`);
        return;
      }

      let message = `${t.history.title}\n\n`;

      for (const bet of bets) {
        const round = await this.roundsRepository.findOne({
          where: { id: bet.lotteryRoundId },
        });
        
        const payout = bet.payout ? `💰 ${Number(bet.payout).toLocaleString()} Ks` : t.history.pending;
        const status = bet.payout ? t.history.won : round?.winningBlock === bet.blockNumber ? t.history.winning : round?.status === LotteryRoundStatus.COMPLETED ? t.history.lost : t.history.pending;
        
        message += `Round #${round?.roundNumber || 'N/A'}\n`;
        message += `Block ${bet.blockNumber}: ${Number(bet.amount).toLocaleString()} Ks\n`;
        message += `${status} ${payout}\n\n`;
      }

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleHistory:', error);
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.history.error);
    }
  }

  private async handleWinners(chatId: number, lang: Language) {
    try {
      const t = botTranslations[lang];
      const rounds = await this.roundsRepository.find({
        where: { status: LotteryRoundStatus.COMPLETED },
        order: { drawTime: 'DESC' },
        take: 5,
      });

      if (rounds.length === 0) {
        await this.sendMessage(chatId, `${t.winners.noCompletedRounds}\n\nBe the first winner! Use /play to start! 🎯`);
        return;
      }

      let message = `${t.winners.title}\n\n`;

      rounds.forEach((round, index) => {
        const drawTime = new Date(round.drawTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        message += `${index + 1}. Round #${round.roundNumber}\n`;
        message += `   ${t.winners.winningBlock} ${round.winningBlock}\n`;
        message += `   ${t.winners.prizePool} ${Number(round.winnerPool).toLocaleString()} Ks\n`;
        message += `   📅 ${drawTime}\n\n`;
      });

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleWinners:', error);
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.winners.error);
    }
  }

  private async handleBalance(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.balance.userNotFound);
        return;
      }

      const message = `${t.balance.title}

${t.balance.kyat} ${Number(user.kyatBalance).toLocaleString()} Ks
${t.balance.points} ${Number(user.points).toLocaleString()}

${t.balance.available} ${Number(user.kyatBalance).toLocaleString()} Ks

Use /deposit to add funds or /withdraw to withdraw! 💸`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleBalance:', error);
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.balance.error);
    }
  }

  private async handleDeposit(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.deposit.userNotFound);
        return;
      }

      const message = `${t.deposit.title}

${t.deposit.method}

${t.deposit.steps}
${t.deposit.step1}
${t.deposit.step2}
${t.deposit.step3}
${t.deposit.step4}
${t.deposit.step5}

${t.deposit.exchangeRate}
${t.deposit.rate}

${t.deposit.note}

Use /play to deposit now! 💰`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.deposit.error);
    }
  }

  private async handleWithdraw(chatId: number, lang: Language) {
    const t = botTranslations[lang];
    const message = `${t.withdraw.title}

${t.withdraw.limits}
${t.withdraw.minimum}
${t.withdraw.dailyMax}
${t.withdraw.processingTime}

${t.withdraw.process}
${t.withdraw.step1}
${t.withdraw.step2}
${t.withdraw.step3}
${t.withdraw.step4}
${t.withdraw.step5}
${t.withdraw.step6}

${t.withdraw.exchangeRate}
${t.withdraw.rate}

${t.withdraw.important}
${t.withdraw.important1}
${t.withdraw.important2}
${t.withdraw.important3}

Use /play to withdraw now! 💰`;

    await this.sendMessage(chatId, message);
  }

  private async handlePoints(chatId: number, telegramId: string, lang: Language) {
    try {
      const t = botTranslations[lang];
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, t.points.userNotFound);
        return;
      }

      const message = `${t.points.title}

${t.points.yourPoints} ${Number(user.points).toLocaleString()}

${t.points.howToEarn}
${t.points.earn1}
${t.points.earn2}
${t.points.earn3}

${t.points.redemption}
${t.points.ratio}
${t.points.minimum}
${t.points.redeemAnytime}

${t.points.example}
${t.points.example1}
${t.points.example2}
${t.points.example3}

Use /play to redeem your points! 🎁`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      const t = botTranslations[lang];
      await this.sendMessage(chatId, t.points.error);
    }
  }

  private async handleSupport(chatId: number, lang: Language) {
    const t = botTranslations[lang];
    const message = `${t.support.title}

${t.support.needHelp}

${t.support.channels}
${t.support.telegram}
${t.support.openApp}

${t.support.commonIssues}
${t.support.issue1}
${t.support.issue2}
${t.support.issue3}

We're here to help! 💬`;

    await this.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: t.support.contactButton,
            url: 'https://t.me/onekadmin'
          }
        ]]
      }
    });
  }

  private async sendMessage(chatId: number, text: string, options?: any) {
    if (!this.isEnabled || !this.botToken) {
      this.logger.warn(`[TELEGRAM BOT] ⚠️ Cannot send message - bot disabled or no token`);
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      this.logger.log(`[TELEGRAM BOT] 📤 Sending message to chat ${chatId}`);
      const response = await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options,
      });
      this.logger.log(`[TELEGRAM BOT] ✅ Message sent successfully`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`[TELEGRAM BOT] ❌ Failed to send message to chat ${chatId}:`, error.response?.data || error.message);
      this.logger.error(`[TELEGRAM BOT] Error details:`, JSON.stringify(error.response?.data || {}));
      throw error;
    }
  }
}

