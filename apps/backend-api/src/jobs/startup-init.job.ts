import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LotteryService } from '../modules/lottery/lottery.service';

/**
 * Startup initialization job
 * Creates an active lottery round if none exists when the backend starts
 */
@Injectable()
export class StartupInitJob implements OnModuleInit {
  private readonly logger = new Logger(StartupInitJob.name);

  constructor(private lotteryService: LotteryService) {}

  async onModuleInit() {
    this.logger.log('Initializing startup tasks...');
    
    try {
      // Check if an active round exists
      const activeRound = await this.lotteryService.getActiveRound();
      
      if (!activeRound) {
        this.logger.log('No active round found. Creating initial round...');
        const newRound = await this.lotteryService.createNewRound();
        this.logger.log(`✅ Created initial lottery round #${newRound.roundNumber} (ID: ${newRound.id})`);
        this.logger.log(`   Draw time: ${newRound.drawTime.toISOString()}`);
      } else {
        this.logger.log(`✅ Active round already exists: Round #${activeRound.roundNumber} (ID: ${activeRound.id})`);
      }
    } catch (error) {
      this.logger.error('Error during startup initialization:', error);
      // Don't throw - allow server to start even if round creation fails
    }
    
    this.logger.log('Startup initialization completed');
  }
}

