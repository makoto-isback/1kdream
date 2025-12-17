import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LotteryService } from '../modules/lottery/lottery.service';

/**
 * Startup initialization job
 * Creates an active lottery round if none exists when the backend starts
 * Safe for first boot when database tables may not exist yet
 */
@Injectable()
export class StartupInitJob implements OnModuleInit {
  private readonly logger = new Logger(StartupInitJob.name);

  constructor(private lotteryService: LotteryService) {}

  /**
   * Check if error is a "relation does not exist" database error
   */
  private isTableNotExistError(error: any): boolean {
    const errorMessage = error?.message || '';
    const errorCode = error?.code || '';
    
    // PostgreSQL error codes and messages
    return (
      errorCode === '42P01' || // relation does not exist
      errorMessage.toLowerCase().includes('relation') && 
      errorMessage.toLowerCase().includes('does not exist') ||
      errorMessage.toLowerCase().includes('table') && 
      errorMessage.toLowerCase().includes('does not exist')
    );
  }

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
      // Handle "relation does not exist" errors gracefully on first boot
      if (this.isTableNotExistError(error)) {
        this.logger.warn('⚠️  Database schema not ready yet (tables do not exist)');
        this.logger.warn('⚠️  Skipping startup initialization - will run on next restart after schema is created');
        this.logger.warn('⚠️  This is normal on first deploy when DATABASE_SYNC=true is enabled');
        // Don't throw - allow server to start successfully
        return;
      }
      
      // For other errors, log but don't crash
      this.logger.error('Error during startup initialization:', error);
      // Don't throw - allow server to start even if round creation fails
    }
    
    this.logger.log('Startup initialization completed');
  }
}

