import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { TonService } from '../../ton/ton.service';
import { TreasuryService } from './treasury.service';
import { TreasuryTransaction, TreasuryDirection, TreasuryAsset } from './entities/treasury-transaction.entity';
import { TON_TREASURY_ADDRESS, USDT_TREASURY_ADDRESS } from './constants/treasury.constants';
import axios from 'axios';

@Injectable()
export class TreasuryIndexerWorker implements OnModuleInit {
  private readonly logger = new Logger(TreasuryIndexerWorker.name);
  private isEnabled: boolean = false;
  private tonApiUrl: string;
  private tonApiKey: string | null = null;
  private lastCheckedTimestamp: number = Date.now();

  constructor(
    private tonService: TonService,
    private treasuryService: TreasuryService,
    private configService: ConfigService,
  ) {
    this.tonApiUrl = this.configService.get('TON_API_URL') || 'https://toncenter.com/api/v3';
    const apiKey = this.configService.get('TON_API_KEY');
    this.tonApiKey = apiKey ? apiKey.trim() : null;
  }

  async onModuleInit() {
    // Strict flag check: only enable if env value is exactly the string "true"
    const flagValue = this.configService.get('TREASURY_INDEXER_ENABLED');
    const treasuryIndexerEnabled = flagValue === 'true';
    const isDev = this.configService.get('NODE_ENV') === 'development';

    // Log current flag state for debugging
    this.logger.log(`[TREASURY INDEXER] Flag value: "${flagValue}" (type: ${typeof flagValue})`);

    if (isDev && !treasuryIndexerEnabled) {
      this.logger.warn('[TREASURY INDEXER] ❌ DISABLED - Development mode and flag not set to "true"');
      this.isEnabled = false;
      return;
    }

    if (!treasuryIndexerEnabled) {
      this.logger.warn('[TREASURY INDEXER] ❌ DISABLED - TREASURY_INDEXER_ENABLED must be exactly "true"');
      this.logger.warn('[TREASURY INDEXER] Current value:', flagValue === undefined ? 'undefined' : `"${flagValue}"`);
      this.isEnabled = false;
      return;
    }

    this.isEnabled = true;
    this.logger.log('[TREASURY INDEXER] ✅ ENABLED - Worker initialized and running');
  }

  private getTonApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.tonApiKey) {
      headers['X-API-Key'] = this.tonApiKey;
    }
    return headers;
  }

  /**
   * Poll treasury wallet for new transactions
   * Runs every 30 seconds
   */
  @Cron('*/30 * * * * *')
  async indexTreasuryTransactions() {
    if (!this.isEnabled) {
      return;
    }

    try {
      await this.checkTreasuryTransactions();
    } catch (error) {
      this.logger.error('[TREASURY INDEXER] Error indexing transactions:', error);
      // Don't throw - worker must continue running
    }
  }

  /**
   * Check for new transactions to treasury wallet
   */
  private async checkTreasuryTransactions(): Promise<void> {
    try {
      // Check TON transactions
      await this.checkAssetTransactions(TON_TREASURY_ADDRESS, TreasuryAsset.TON);

      // Check USDT transactions (jetton transfers)
      await this.checkUsdtTransactions(USDT_TREASURY_ADDRESS);
    } catch (error) {
      this.logger.error('[TREASURY INDEXER] Error checking treasury transactions:', error);
    }
  }

  /**
   * Check TON transactions for treasury address
   */
  private async checkAssetTransactions(address: string, asset: TreasuryAsset): Promise<void> {
    try {
      const response = await axios.get(`${this.tonApiUrl}/transactions`, {
        params: {
          address,
          limit: 50,
        },
        headers: this.getTonApiHeaders(),
      });

      const transactions = response.data?.result || [];

      for (const tx of transactions) {
        try {
          const txHash = tx.hash || tx.transaction_id?.hash || null;
          if (!txHash) continue;

          // Check if already indexed (idempotency)
          const repos = this.treasuryService.getRepositories();
          const existing = await repos.treasuryTxRepository.findOne({
            where: { txHash },
          });

          if (existing) {
            continue; // Already indexed
          }

          // Parse amount
          const inMsg = tx.in_msg;
          if (!inMsg) continue;

          const value = inMsg.value || inMsg.amount || '0';
          const nanotons = typeof value === 'string' ? parseFloat(value) : value;
          const tonAmount = (nanotons / 1e9).toFixed(18);

          // Parse memo/comment
          let memo: string | null = null;
          if (inMsg.msg_data?.text) {
            memo = inMsg.msg_data.text.trim() || null;
          } else if (inMsg.msg_data?.body) {
            memo = this.tonService.parseTransactionComment(tx);
          }

          // Save treasury transaction
          const treasuryTx = await this.treasuryService.saveTreasuryTransaction(
            txHash,
            TreasuryDirection.IN,
            asset,
            tonAmount,
            memo || undefined,
          );

          // Process deposit or withdraw request based on memo
          if (memo?.startsWith('deposit:')) {
            await this.treasuryService.processDeposit(treasuryTx);
          } else if (memo?.startsWith('withdraw:')) {
            await this.treasuryService.processWithdrawRequest(treasuryTx);
          }

          this.logger.debug(`[TREASURY INDEXER] Indexed ${asset} transaction: ${txHash}`);
        } catch (error) {
          this.logger.error(`[TREASURY INDEXER] Error processing transaction:`, error);
          // Continue with next transaction
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.debug(`[TREASURY INDEXER] No transactions found for ${asset}`);
      } else {
        this.logger.error(`[TREASURY INDEXER] Error checking ${asset} transactions:`, error);
      }
    }
  }

  /**
   * Check USDT jetton transfers for treasury address
   */
  private async checkUsdtTransactions(address: string): Promise<void> {
    try {
      // USDT Jetton Master Contract
      const USDT_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

      const response = await axios.get(`${this.tonApiUrl}/jetton/transfers`, {
        params: {
          jetton_master: USDT_JETTON_MASTER,
          limit: 50,
        },
        headers: this.getTonApiHeaders(),
      });

      const transfers = response.data?.result || [];

      for (const transfer of transfers) {
        try {
          // Check if transfer is TO treasury address
          const destination = transfer.destination?.address || transfer.to?.address;
          if (!destination || destination !== address) {
            continue;
          }

          const txHash = transfer.transaction_hash || transfer.tx_hash || null;
          if (!txHash) continue;

          // Check if already indexed
          const repos = this.treasuryService.getRepositories();
          const existing = await repos.treasuryTxRepository.findOne({
            where: { txHash },
          });

          if (existing) {
            continue;
          }

          // Parse USDT amount (6 decimals)
          const amount = transfer.amount || transfer.quantity || '0';
          const jettonUnits = typeof amount === 'string' ? parseFloat(amount) : amount;
          const usdtAmount = (jettonUnits / 1e6).toFixed(18);

          // Parse memo from comment/decoded_op
          let memo: string | null = null;
          if (transfer.comment) {
            memo = transfer.comment.trim() || null;
          } else if (transfer.decoded_op?.comment) {
            memo = transfer.decoded_op.comment.trim() || null;
          }

          // Save treasury transaction
          const treasuryTx = await this.treasuryService.saveTreasuryTransaction(
            txHash,
            TreasuryDirection.IN,
            TreasuryAsset.USDT,
            usdtAmount,
            memo || undefined,
          );

          // Process deposit or withdraw request
          if (memo?.startsWith('deposit:')) {
            await this.treasuryService.processDeposit(treasuryTx);
          } else if (memo?.startsWith('withdraw:')) {
            await this.treasuryService.processWithdrawRequest(treasuryTx);
          }

          this.logger.debug(`[TREASURY INDEXER] Indexed USDT transaction: ${txHash}`);
        } catch (error) {
          this.logger.error(`[TREASURY INDEXER] Error processing USDT transfer:`, error);
          // Continue with next transfer
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logger.debug('[TREASURY INDEXER] No USDT transfers found');
      } else {
        this.logger.error('[TREASURY INDEXER] Error checking USDT transactions:', error);
      }
    }
  }
}

