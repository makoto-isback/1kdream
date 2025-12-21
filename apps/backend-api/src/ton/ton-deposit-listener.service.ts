import { Injectable, Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { TonService } from './ton.service';
import { DepositsService } from '../modules/wallet/deposits/deposits.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Deposit, DepositStatus } from '../modules/wallet/deposits/entities/deposit.entity';
import { User } from '../modules/users/entities/user.entity';

@Injectable()
export class TonDepositListenerService implements OnModuleInit {
  private readonly logger = new Logger(TonDepositListenerService.name);
  private lastCheckedTimestamp: number = Date.now();
  private isEnabled: boolean = false;
  private readonly requiredConfirmations: number;

  constructor(
    private tonService: TonService,
    private configService: ConfigService,
    @Inject(forwardRef(() => DepositsService))
    private depositsService: DepositsService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {
    this.requiredConfirmations = parseInt(
      this.configService.get('TON_DEPOSIT_CONFIRMATIONS') || '10',
      10,
    );
  }

  async onModuleInit() {
    // Only enable if explicitly enabled
    const enableDeposits = this.configService.get('TON_ENABLE_DEPOSITS') === 'true';
    const network = this.configService.get('TON_NETWORK') || 'mainnet';

    if (!enableDeposits) {
      this.logger.log('[TON DEPOSIT] TON deposit listener is DISABLED (TON_ENABLE_DEPOSITS not set to true)');
      return;
    }

    if (network !== 'mainnet') {
      this.logger.warn('[TON DEPOSIT] TON deposit listener only supports mainnet. Current network:', network);
      return;
    }

    // Wait for wallet to be ready (with retries)
    await this.waitForWalletReady();

    // Start the listener
    this.isEnabled = true;
    this.logger.log(`[TON DEPOSIT] TON deposit listener started (confirmations required: ${this.requiredConfirmations})`);
    this.lastCheckedTimestamp = Date.now();
    
    // Initial check
    await this.checkForDeposits();
  }

  /**
   * Wait for wallet to be ready with retries
   * Idempotent and production-safe
   */
  private async waitForWalletReady(): Promise<void> {
    const maxRetries = 30; // 30 retries = 15 seconds total (500ms * 30)
    const retryDelay = 500; // 500ms between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (this.tonService.isWalletReadyForUse()) {
        this.logger.log('[TON DEPOSIT] Wallet is ready');
        return;
      }

      if (attempt === 1) {
        this.logger.log('[TON DEPOSIT] Waiting for wallet initialization...');
      }

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    // If we get here, wallet is still not ready after max retries
    // Check if wallet initialization failed or if seed phrase is not provided
    const hasSeedPhrase = !!this.configService.get('TON_SEED_PHRASE');
    
    if (!hasSeedPhrase) {
      this.logger.warn('[TON DEPOSIT] TON_SEED_PHRASE not provided. Listener will not start.');
      return;
    }

    // Wallet initialization may have failed
    this.logger.warn('[TON DEPOSIT] Wallet initialization timeout. Listener will not start.');
    this.logger.warn('[TON DEPOSIT] Check logs for wallet initialization errors.');
  }

  /**
   * Check for new TON deposits every 30 seconds
   */
  @Cron('*/30 * * * * *') // Every 30 seconds
  async checkForDeposits() {
    if (!this.isEnabled) {
      return;
    }

    try {
      this.logger.debug('[TON DEPOSIT] Checking for new TON deposits...');
      
      // Temporarily disable since parameter - fetch all recent transactions
      const transactions = await this.tonService.checkTonTransfers();
      
      for (const tx of transactions) {
        const txHash = tx.hash || tx.transaction_id || tx.tx_hash;
        if (!txHash) {
          console.log('[TON DEBUG] Skipping transaction without hash');
          continue;
        }

        console.log(`[TON DEBUG] Transaction detected: ${txHash}`);
        
        // Check if deposit already exists (idempotent)
        const existing = await this.depositsService.findByTxHash(txHash);
        if (existing) {
          console.log(`[TON DEBUG] Deposit already exists for tx ${txHash}`);
          continue;
        }
        
        // Log transaction details
        const tonAmount = this.tonService.parseTonAmount(tx);
        const comment = this.tonService.parseTransactionComment(tx);
        console.log(`[TON DEBUG] New transaction: hash=${txHash} amount=${tonAmount} comment=${comment}`);
        
        // Process the deposit - credit KYAT to user's balance
        if (tonAmount > 0) {
          await this.processDeposit(tx);
        }
      }

      this.lastCheckedTimestamp = Date.now();
    } catch (error) {
      this.logger.error('[TON DEPOSIT] Error checking for deposits:', error);
    }
  }

  /**
   * Process a detected TON deposit
   */
  private async processDeposit(transaction: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const txHash = transaction.hash || transaction.tx_hash;
      if (!txHash) {
        this.logger.warn('[TON DEPOSIT] Transaction missing hash');
        return;
      }

      // Check if deposit already exists (idempotent)
      const existing = await this.depositsService.findByTxHash(txHash);
      if (existing) {
        this.logger.debug(`[TON DEPOSIT] Deposit ${txHash} already processed`);
        
        // Check if it needs confirmation
        if (existing.status === DepositStatus.PENDING) {
          await this.checkAndConfirmDeposit(existing, txHash);
        }
        
        await queryRunner.commitTransaction();
        return;
      }

      // Parse transaction details
      const tonAmount = this.tonService.parseTonAmount(transaction);
      const comment = this.tonService.parseTransactionComment(transaction);
      const senderAddress = transaction.in_msg?.source?.address || null;

      if (tonAmount <= 0) {
        this.logger.debug(`[TON DEPOSIT] Skipping transaction ${txHash}: zero amount`);
        await queryRunner.commitTransaction();
        return;
      }

      // Parse deposit memo: format "deposit:<userId>"
      let userId: string | null = null;
      if (comment) {
        const match = comment.match(/^deposit:([a-f0-9-]{36})$/i); // UUID format
        if (match) {
          userId = match[1];
        }
      }

      // Convert TON to USDT (1 TON ≈ 1 USDT, but we'll use actual rate if needed)
      // For now, assuming 1 TON = 1 USDT
      const usdtAmount = tonAmount;
      const kyatAmount = usdtAmount * 5000; // 1 USDT = 5000 KYAT

      if (userId) {
        // User ID found in memo - create deposit with user
        this.logger.log(
          `[TON DEPOSIT] New TON deposit detected: ${tonAmount} TON (${usdtAmount} USDT) from ${senderAddress} for user ${userId} (${txHash})`
        );

        // Verify user exists
        const user = await queryRunner.manager.findOne(User, {
          where: { id: userId },
        });

        if (!user) {
          this.logger.warn(`[TON DEPOSIT] User ${userId} not found for transaction ${txHash}`);
          // Create as pending_manual for admin review
          const deposit = await this.depositsService.createPendingManualDeposit(
            senderAddress || '',
            usdtAmount,
            txHash,
          );
          this.logger.log(`[TON DEPOSIT] Created pending_manual deposit: ${deposit.id}`);
        } else {
          // Create deposit with user
          await this.createPendingDeposit(
            queryRunner,
            userId,
            senderAddress,
            usdtAmount,
            kyatAmount,
            txHash,
          );
          
          // Commit the deposit creation first
          await queryRunner.commitTransaction();
          await queryRunner.release();
          
          // Check confirmations immediately (transaction might already have enough confirmations)
          const savedDeposit = await this.depositsService.findByTxHash(txHash);
          if (savedDeposit && savedDeposit.status === DepositStatus.PENDING) {
            await this.checkAndConfirmDeposit(savedDeposit, txHash);
          }
          return; // Already committed and released
        }
      } else {
        // No user ID in memo - create as pending_manual
        this.logger.log(
          `[TON DEPOSIT] New TON deposit detected without user ID: ${tonAmount} TON (${usdtAmount} USDT) from ${senderAddress} (${txHash})`
        );

        const deposit = await this.depositsService.createPendingManualDeposit(
          senderAddress || '',
          usdtAmount,
          txHash,
        );
        this.logger.log(`[TON DEPOSIT] Created pending_manual deposit: ${deposit.id}`);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[TON DEPOSIT] Error processing deposit:`, error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create pending deposit record
   */
  private async createPendingDeposit(
    queryRunner: any,
    userId: string | null,
    senderAddress: string | null,
    usdtAmount: number,
    kyatAmount: number,
    txHash: string,
  ) {
    const deposit = queryRunner.manager.create(Deposit, {
      userId,
      usdtAmount,
      kyatAmount,
      tonTxHash: txHash,
      senderTonAddress: senderAddress,
      status: userId ? DepositStatus.PENDING : DepositStatus.PENDING_MANUAL,
    });

    await queryRunner.manager.save(deposit);
    this.logger.log(`[TON DEPOSIT] Created deposit record: ${deposit.id} (status: ${deposit.status})`);
  }

  /**
   * Check and confirm deposit after required confirmations
   */
  private async checkAndConfirmDeposit(deposit: Deposit, txHash: string) {
    try {
      const confirmations = await this.tonService.getTransactionConfirmations(txHash);
      
      if (confirmations >= this.requiredConfirmations) {
        this.logger.log(
          `[TON DEPOSIT] Deposit ${txHash} has ${confirmations} confirmations (required: ${this.requiredConfirmations}). Auto-confirming...`
        );

        // Auto-confirm deposit
        if (deposit.userId) {
          await this.depositsService.confirmDeposit(
            deposit.id,
            txHash,
            'system', // System auto-confirmation
            deposit.userId,
          );
          this.logger.log(`[TON DEPOSIT] Auto-confirmed deposit ${deposit.id} for user ${deposit.userId}`);
        } else {
          this.logger.log(
            `[TON DEPOSIT] Deposit ${deposit.id} has enough confirmations but no user ID. Requires manual confirmation.`
          );
        }
      } else {
        this.logger.debug(
          `[TON DEPOSIT] Deposit ${txHash} has ${confirmations}/${this.requiredConfirmations} confirmations. Waiting...`
        );
      }
    } catch (error) {
      this.logger.error(`[TON DEPOSIT] Error checking confirmations for ${txHash}:`, error);
    }
  }
}

