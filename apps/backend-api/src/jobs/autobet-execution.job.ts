import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutoBetService } from '../modules/autobet/autobet.service';

@Injectable()
export class AutoBetExecutionJob {
  private readonly logger = new Logger(AutoBetExecutionJob.name);

  constructor(private autobetService: AutoBetService) {}

  /**
   * Execute auto-bets aligned with draw checks.
   * Runs every minute in production, every 10 seconds in dev mode.
   * This ensures auto-bets are placed promptly when new rounds start.
   */
  @Cron(process.env.NODE_ENV === 'development' || (process.env.ROUND_DURATION_MINUTES && parseInt(process.env.ROUND_DURATION_MINUTES, 10) <= 1) ? '*/10 * * * * *' : '* * * * *')
  async executeAutoBets() {
    // Use debug level to reduce log spam (runs every minute)
    this.logger.debug('Executing auto-bets for active plans...');
    try {
      await this.autobetService.executeAutoBets();
    } catch (error) {
      this.logger.error('Error executing auto-bets:', error);
    }
  }
}

