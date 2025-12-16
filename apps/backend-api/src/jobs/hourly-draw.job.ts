import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LotteryService } from '../modules/lottery/lottery.service';

@Injectable()
export class HourlyDrawJob {
  private readonly logger = new Logger(HourlyDrawJob.name);
  private readonly isShortDuration =
    (process.env.ROUND_DURATION_MINUTES && !isNaN(parseInt(process.env.ROUND_DURATION_MINUTES, 10)) && parseInt(process.env.ROUND_DURATION_MINUTES, 10) <= 1) ||
    process.env.NODE_ENV === 'development';

  constructor(private lotteryService: LotteryService) {}

  // Prod: hourly. Dev or short duration (<=1 min): check every 10s.
  @Cron(process.env.NODE_ENV === 'development' || (process.env.ROUND_DURATION_MINUTES && parseInt(process.env.ROUND_DURATION_MINUTES, 10) <= 1) ? '*/10 * * * * *' : '0 * * * *')
  async handleHourlyDraw() {
    this.logger.log('Running lottery draw check...');
    try {
      await this.lotteryService.runLottery();
      this.logger.log('Lottery draw check completed successfully');
    } catch (error) {
      this.logger.error('Error running lottery draw:', error);
    }
  }
}
