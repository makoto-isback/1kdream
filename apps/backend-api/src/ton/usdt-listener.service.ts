import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { TonService } from './ton.service';
import { DepositsService } from '../modules/wallet/deposits/deposits.service';

@Injectable()
export class UsdtListenerService implements OnModuleInit {
  private readonly logger = new Logger(UsdtListenerService.name);
  private lastCheckedTimestamp: number = Date.now();

  constructor(
    private tonService: TonService,
    private configService: ConfigService,
    @Inject(forwardRef(() => DepositsService))
    private depositsService: DepositsService,
  ) {}

  onModuleInit() {
    const isDev = this.configService.get('NODE_ENV') === 'development';
    const usdtDepositsEnabled = this.configService.get('USDT_ENABLE_DEPOSITS') === 'true';

    if (isDev) {
      this.logger.warn('🔧 Development mode: TON USDT listener is DISABLED');
      this.logger.warn('📝 Use admin endpoints to manually confirm deposits');
      return;
    }

    if (!usdtDepositsEnabled) {
      this.logger.warn('🔧 USDT deposit listener is DISABLED (USDT_ENABLE_DEPOSITS !== true)');
      this.logger.warn('📝 Use admin endpoints to manually confirm deposits');
      return;
    }

    this.startListening();
  }

  /**
   * Check for new USDT deposits every 30 seconds
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async checkForDeposits() {
    // Guard: Skip if USDT deposits are disabled
    const usdtDepositsEnabled = this.configService.get('USDT_ENABLE_DEPOSITS') === 'true';
    if (!usdtDepositsEnabled) {
      return; // Silently skip if disabled
    }

    try {
      this.logger.debug('Checking for new USDT deposits...');
      
      const transfers = await this.tonService.checkUsdtTransfers(this.lastCheckedTimestamp);
      
      for (const transfer of transfers) {
        const usdtAmount = this.tonService.parseUsdtAmount(transfer);
        const txHash = transfer.tx_hash || transfer.hash;
        const senderAddress = transfer.sender?.address || null;
        
        if (usdtAmount > 0 && txHash) {
          await this.processDeposit(txHash, usdtAmount, senderAddress);
        }
      }

      this.lastCheckedTimestamp = Date.now();
    } catch (error) {
      this.logger.error('Error checking for deposits:', error);
    }
  }

  /**
   * Process a detected USDT deposit
   */
  private async processDeposit(txHash: string, usdtAmount: number, senderAddress?: string) {
    try {
      // Check if deposit already exists
      const existing = await this.depositsService.findByTxHash(txHash);
      if (existing) {
        this.logger.debug(`Deposit ${txHash} already processed`);
        return;
      }

      // Get transaction details to find sender if not provided
      let senderTonAddress = senderAddress;
      if (!senderTonAddress) {
        const tx = await this.tonService.getTransaction(txHash);
        if (tx) {
          // Extract sender address from transaction
          senderTonAddress = tx.in_msg?.source?.address || null;
        }
      }

      if (!senderTonAddress) {
        this.logger.warn(`Could not determine sender for transaction ${txHash}`);
        return;
      }

      this.logger.log(`New USDT deposit detected: ${usdtAmount} USDT from ${senderTonAddress} (${txHash})`);
      
      // Create deposit record (pending_manual if unknown user)
      await this.depositsService.createPendingManualDeposit(
        senderTonAddress,
        usdtAmount,
        txHash,
      );
    } catch (error) {
      this.logger.error(`Error processing deposit ${txHash}:`, error);
    }
  }

  /**
   * Start listening (called on app startup)
   */
  async startListening() {
    this.logger.log('USDT deposit listener started');
    this.lastCheckedTimestamp = Date.now();
    // Initial check
    await this.checkForDeposits();
  }
}

