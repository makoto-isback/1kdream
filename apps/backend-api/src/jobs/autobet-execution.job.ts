import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutoBetService } from '../modules/autobet/autobet.service';

@Injectable()
export class AutoBetExecutionJob {
  private readonly logger = new Logger(AutoBetExecutionJob.name);

  constructor(private autobetService: AutoBetService) {}

  /**
   * Execute auto-bets aligned with draw checks.
   * Prod: hourly. Dev or short duration (<=1 min): every 10s.
   */
  @Cron(process.env.NODE_ENV === 'development' || (process.env.ROUND_DURATION_MINUTES && parseInt(process.env.ROUND_DURATION_MINUTES, 10) <= 1) ? '*/10 * * * * *' : '0 * * * *')
  async executeAutoBets() {
    this.logger.log('Executing auto-bets for active plans...');
    try {
      await this.autobetService.executeAutoBets();
      this.logger.log('Auto-bets execution completed');
    } catch (error) {
      this.logger.error('Error executing auto-bets:', error);
    }
  }
}

