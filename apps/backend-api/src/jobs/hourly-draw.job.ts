import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LotteryService } from '../modules/lottery/lottery.service';

@Injectable()
export class HourlyDrawJob implements OnModuleInit {
  private readonly logger = new Logger(HourlyDrawJob.name);

  constructor(private lotteryService: LotteryService) {}

  /**
   * Run lottery check immediately on startup to handle any stuck rounds
   */
  async onModuleInit() {
    this.logger.log('🎲 [HourlyDrawJob] Module initialized - running initial lottery check...');
    try {
      await this.lotteryService.runLottery();
      this.logger.log('🎲 [HourlyDrawJob] Initial lottery check completed');
    } catch (error) {
      this.logger.error('🎲 [HourlyDrawJob] Initial lottery check failed:', error.message);
    }
  }

  /**
   * Check for lottery draws EVERY MINUTE in production.
   * In dev or short duration mode, check every 10 seconds.
   * 
   * This ensures that when a round's drawTime passes, the draw is executed
   * within 1 minute (or 10 seconds in dev mode).
   */
  @Cron(process.env.NODE_ENV === 'development' || (process.env.ROUND_DURATION_MINUTES && parseInt(process.env.ROUND_DURATION_MINUTES, 10) <= 1) ? '*/10 * * * * *' : '* * * * *')
  async handleLotteryDrawCheck() {
    // Use debug level to avoid log spam (runs every minute)
    this.logger.debug('🎲 [HourlyDrawJob] Running lottery draw check...');
    try {
      await this.lotteryService.runLottery();
    } catch (error) {
      this.logger.error('🎲 [HourlyDrawJob] Error running lottery draw:', error.message);
    }
  }
}
