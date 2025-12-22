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
      
      this.logger.log(`[TELEGRAM BOT] Setting webhook to: ${webhookPath}`);
      
      const response = await axios.post(url, {
        url: webhookPath,
      });
      
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
      await this.sendMessage(chatId, 'Please use a command. Type /help to see available commands.');
    }
  }

  private async handleCommand(command: string, chatId: number, telegramId: string, fullText: string) {
    try {
      switch (command) {
        case '/start':
          await this.handleStart(chatId);
          break;
        case '/help':
          await this.handleHelp(chatId);
          break;
        case '/rules':
          await this.handleRules(chatId);
          break;
        case '/play':
          await this.handlePlay(chatId);
          break;
        case '/round':
          await this.handleRound(chatId, telegramId);
          break;
        case '/pool':
          await this.handlePool(chatId, telegramId);
          break;
        case '/mybets':
          await this.handleMyBets(chatId, telegramId);
          break;
        case '/history':
          await this.handleHistory(chatId, telegramId);
          break;
        case '/winners':
          await this.handleWinners(chatId);
          break;
        case '/balance':
          await this.handleBalance(chatId, telegramId);
          break;
        case '/deposit':
          await this.handleDeposit(chatId, telegramId);
          break;
        case '/withdraw':
          await this.handleWithdraw(chatId);
          break;
        case '/points':
          await this.handlePoints(chatId, telegramId);
          break;
        case '/support':
          await this.handleSupport(chatId);
          break;
        default:
          await this.sendMessage(chatId, 'Unknown command. Use /help to see all commands.');
      }
    } catch (error: any) {
      this.logger.error(`[TELEGRAM BOT] Error handling command ${command}:`, error);
      await this.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
  }

  // Command handlers
  private async handleStart(chatId: number) {
    const message = `🎉 <b>Welcome to 1K Dream Lottery!</b> 🎉

Hello! 👋 We're excited to have you here!

🎮 <b>HOW TO PLAY:</b>

1️⃣ <b>Choose Your Numbers</b>
   • Select any number from 1-25 (you can pick multiple!)
   • Each number is a "block" you can bet on

2️⃣ <b>Set Your Bet Amount</b>
   • Minimum: 1,000 KYAT per block
   • Maximum: 100,000 KYAT total per round
   • Maximum: 10 bets per round

3️⃣ <b>Wait for the Draw</b>
   • New round starts every hour
   • One winning number is randomly selected (1-25)
   • Watch the countdown timer!

4️⃣ <b>Win Prizes!</b> 💰
   • If your number wins, you share 90% of the prize pool!
   • Payouts are proportional - bet more, win more!
   • You get your original bet back PLUS profit!

💡 <b>EXAMPLE:</b>
   • Prize Pool: 500,000 KYAT
   • Winner Pool: 450,000 KYAT (90%)
   • You bet 10,000 KYAT on winning block
   • Total bets on winning block: 100,000 KYAT
   • Your payout: (10,000 ÷ 100,000) × 450,000 = 45,000 KYAT
   • Profit: 35,000 KYAT! 🎊

📋 <b>IMPORTANT RULES:</b>
   • Minimum bet: 1,000 KYAT per block
   • Max 10 bets per round
   • Max 100,000 KYAT total per round
   • Exchange rate: 5,000 KYAT = $1

✨ <b>FEATURES:</b>
   • 🎯 Single Buy - Bet on one round
   • 🔄 Auto Buy - Set it and forget it!
   • 💎 Points System - Earn points with every bet
   • 💰 Deposit/Withdraw - Easy TON USDT transfers

🎁 <b>BONUS:</b>
   • Earn 10 points for every 1,000 KYAT bet
   • Redeem 10,000+ points for KYAT (1:1 ratio)

Ready to play? Use /play to open the app! 🚀

Good luck! 🍀`;

    await this.sendMessage(chatId, message);
  }

  private async handleHelp(chatId: number) {
    const message = `📋 <b>Available Commands:</b>

<b>Basic:</b>
/start - Welcome message and game explanation
/help - Show this help message
/rules - Display game rules and limits
/play - Open the game app

<b>Game Info:</b>
/round - Current round info
/pool - Current prize pool amount
/mybets - Your bets in current round
/history - Your betting history
/winners - Recent winners list

<b>Wallet:</b>
/balance - Check your KYAT balance and points
/deposit - Deposit instructions (TON USDT)
/withdraw - Withdrawal info and limits
/points - Points system explanation

<b>Support:</b>
/support - Contact support team

Use any command to get started! 🚀`;

    await this.sendMessage(chatId, message);
  }

  private async handleRules(chatId: number) {
    const message = `📋 <b>Game Rules</b>

<b>Betting Limits:</b>
• Minimum bet: 1,000 KYAT per block
• Maximum bets: 10 per round
• Maximum total: 100,000 KYAT per round

<b>Round Frequency:</b>
• New round every hour
• One winning number (1-25) selected randomly

<b>Payouts:</b>
• 90% of pool goes to winners
• 10% admin fee
• Proportional payouts (bet more, win more!)
• You get original bet + profit

<b>Exchange Rate:</b>
• 5,000 KYAT = $1 USDT

<b>Points System:</b>
• Earn 10 points per 1,000 KYAT bet
• Redeem 10,000+ points for KYAT (1:1 ratio)

<b>Withdrawals:</b>
• Minimum: 5,000 KYAT
• Daily max: 500,000 KYAT
• Processing time: 1 hour

Use /play to start betting! 🎯`;

    await this.sendMessage(chatId, message);
  }

  private async handlePlay(chatId: number) {
    const message = `🎮 <b>Open the Game</b>

Click the button below to open the 1K Dream Lottery app! 🚀`;

    await this.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🎮 Open Game',
            web_app: { url: this.frontendUrl }
          }
        ]]
      }
    });
  }

  private async handleRound(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first to create your account.');
        return;
      }

      const round = await this.lotteryService.getActiveRound();
      if (!round) {
        await this.sendMessage(chatId, '⏳ No active round at the moment. Check back soon!');
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

      const message = `🎯 <b>Current Round #${round.roundNumber}</b>

⏰ <b>Time remaining:</b> ${minutes}:${seconds.toString().padStart(2, '0')}
💰 <b>Prize Pool:</b> ${Number(round.totalPool).toLocaleString()} Ks
🏆 <b>Winner Pool:</b> ${Number(round.winnerPool).toLocaleString()} Ks (90%)

💵 <b>Your stake:</b> ${userStake.toLocaleString()} Ks

Use /play to place bets! 🎲`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleRound:', error);
      await this.sendMessage(chatId, '❌ Error fetching round info. Please try again.');
    }
  }

  private async handlePool(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first.');
        return;
      }

      const round = await this.lotteryService.getActiveRound();
      if (!round) {
        await this.sendMessage(chatId, '⏳ No active round at the moment.');
        return;
      }

      const adminFee = Number(round.totalPool) * 0.1;
      const winnerPool = Number(round.winnerPool);

      const message = `💰 <b>Prize Pool</b>

💵 <b>Total Pool:</b> ${Number(round.totalPool).toLocaleString()} Ks
🏆 <b>Winner Pool:</b> ${winnerPool.toLocaleString()} Ks (90%)
⚙️ <b>Admin Fee:</b> ${adminFee.toLocaleString()} Ks (10%)

Round #${round.roundNumber}

Use /play to join! 🎯`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      await this.sendMessage(chatId, '❌ Error fetching pool info.');
    }
  }

  private async handleMyBets(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first.');
        return;
      }

      const round = await this.lotteryService.getActiveRound();
      if (!round) {
        await this.sendMessage(chatId, '⏳ No active round at the moment.');
        return;
      }

      const bets = await this.betsRepository.find({
        where: { userId: user.id, lotteryRoundId: round.id },
        order: { createdAt: 'DESC' },
      });

      if (bets.length === 0) {
        await this.sendMessage(chatId, `📝 <b>No bets in current round</b>\n\nRound #${round.roundNumber}\n\nUse /play to place your first bet! 🎲`);
        return;
      }

      const totalStake = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
      const blocks = [...new Set(bets.map(bet => bet.blockNumber))].sort((a, b) => a - b);

      let message = `📊 <b>Your Bets - Round #${round.roundNumber}</b>\n\n`;
      message += `💵 <b>Total Stake:</b> ${totalStake.toLocaleString()} Ks\n`;
      message += `🎯 <b>Blocks:</b> ${blocks.join(', ')}\n\n`;
      message += `<b>Bets:</b>\n`;

      bets.forEach((bet, index) => {
        message += `${index + 1}. Block ${bet.blockNumber}: ${Number(bet.amount).toLocaleString()} Ks\n`;
      });

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      await this.sendMessage(chatId, '❌ Error fetching your bets.');
    }
  }

  private async handleHistory(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first.');
        return;
      }

      const bets = await this.betsService.getUserBets(user.id, 10);

      if (bets.length === 0) {
        await this.sendMessage(chatId, '📝 <b>No betting history</b>\n\nUse /play to place your first bet! 🎲');
        return;
      }

      let message = `📜 <b>Your Betting History</b>\n\n`;

      for (const bet of bets) {
        const round = await this.roundsRepository.findOne({
          where: { id: bet.lotteryRoundId },
        });
        
        const payout = bet.payout ? `💰 ${Number(bet.payout).toLocaleString()} Ks` : '⏳ Pending';
        const status = bet.payout ? '✅ Won' : round?.winningBlock === bet.blockNumber ? '🎯 Winning!' : round?.status === LotteryRoundStatus.COMPLETED ? '❌ Lost' : '⏳ Pending';
        
        message += `Round #${round?.roundNumber || 'N/A'}\n`;
        message += `Block ${bet.blockNumber}: ${Number(bet.amount).toLocaleString()} Ks\n`;
        message += `${status} ${payout}\n\n`;
      }

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleHistory:', error);
      await this.sendMessage(chatId, '❌ Error fetching history.');
    }
  }

  private async handleWinners(chatId: number) {
    try {
      const rounds = await this.roundsRepository.find({
        where: { status: LotteryRoundStatus.COMPLETED },
        order: { drawTime: 'DESC' },
        take: 5,
      });

      if (rounds.length === 0) {
        await this.sendMessage(chatId, '📝 <b>No completed rounds yet</b>\n\nBe the first winner! Use /play to start! 🎯');
        return;
      }

      let message = `🏆 <b>Recent Winners</b>\n\n`;

      rounds.forEach((round, index) => {
        const drawTime = new Date(round.drawTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        message += `${index + 1}. Round #${round.roundNumber}\n`;
        message += `   🎯 Winning Block: ${round.winningBlock}\n`;
        message += `   💰 Prize Pool: ${Number(round.winnerPool).toLocaleString()} Ks\n`;
        message += `   📅 ${drawTime}\n\n`;
      });

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleWinners:', error);
      await this.sendMessage(chatId, '❌ Error fetching winners.');
    }
  }

  private async handleBalance(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first to create your account.');
        return;
      }

      const message = `💰 <b>Your Balance</b>

💵 <b>KYAT:</b> ${Number(user.kyatBalance).toLocaleString()} Ks
💎 <b>Points:</b> ${Number(user.points).toLocaleString()}

<b>Available for withdrawal:</b> ${Number(user.kyatBalance).toLocaleString()} Ks

Use /deposit to add funds or /withdraw to withdraw! 💸`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      this.logger.error('[TELEGRAM BOT] Error in handleBalance:', error);
      await this.sendMessage(chatId, '❌ Error fetching balance.');
    }
  }

  private async handleDeposit(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first.');
        return;
      }

      const message = `💵 <b>Deposit Instructions</b>

<b>Method:</b> TON USDT

<b>Steps:</b>
1. Open the app using /play
2. Go to Deposit section
3. Enter amount in USDT
4. Send USDT to the provided TON address
5. Wait for confirmation (usually within minutes)

<b>Exchange Rate:</b>
• 1 USDT = 5,000 KYAT
• Minimum deposit: 0.2 USDT (1,000 KYAT)

<b>Note:</b> Make sure to use the address shown in the app for your deposit to be credited automatically.

Use /play to deposit now! 💰`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      await this.sendMessage(chatId, '❌ Error. Please try again.');
    }
  }

  private async handleWithdraw(chatId: number) {
    const message = `💸 <b>Withdrawal Information</b>

<b>Limits:</b>
• Minimum: 5,000 KYAT (1 USDT)
• Daily maximum: 500,000 KYAT per user
• Processing time: 1 hour after request

<b>Process:</b>
1. Open the app using /play
2. Go to Withdraw section
3. Enter amount and TON address
4. Submit withdrawal request
5. Wait 1 hour for processing
6. Funds will be sent to your TON address

<b>Exchange Rate:</b>
• 5,000 KYAT = 1 USDT

<b>Important:</b>
• Balance is deducted immediately when you request withdrawal
• If rejected, balance will be refunded
• Make sure your TON address is correct!

Use /play to withdraw now! 💰`;

    await this.sendMessage(chatId, message);
  }

  private async handlePoints(chatId: number, telegramId: string) {
    try {
      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await this.sendMessage(chatId, '❌ User not found. Please open the app first.');
        return;
      }

      const message = `💎 <b>Points System</b>

<b>Your Points:</b> ${Number(user.points).toLocaleString()}

<b>How to Earn:</b>
• Bet 1,000 KYAT = Earn 10 points
• Bet 5,000 KYAT = Earn 50 points
• Bet 10,000 KYAT = Earn 100 points

<b>Redemption:</b>
• 1,000 points = 1,000 KYAT (1:1 ratio)
• Minimum redemption: 10,000 points
• Redeem anytime in the app

<b>Example:</b>
• You have 15,000 points
• Redeem 12,000 points = Get 12,000 KYAT
• Remaining: 3,000 points

Use /play to redeem your points! 🎁`;

      await this.sendMessage(chatId, message);
    } catch (error: any) {
      await this.sendMessage(chatId, '❌ Error fetching points.');
    }
  }

  private async handleSupport(chatId: number) {
    const message = `🆘 <b>Contact Support</b>

Need help? Our support team is here for you!

<b>Support Channels:</b>
• Telegram: @onekadmin
• Open app and use "Contact Support" button

<b>Common Issues:</b>
• Deposit not credited? Contact support with TX hash
• Withdrawal delayed? Check status in app
• Account issues? Contact support

We're here to help! 💬`;

    await this.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '💬 Contact Support',
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

