import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TreasuryTransaction, TreasuryDirection, TreasuryAsset } from './entities/treasury-transaction.entity';
import { UserDeposit, UserDepositStatus } from './entities/user-deposit.entity';
import { WithdrawRequest, WithdrawRequestStatus } from './entities/withdraw-request.entity';
import { WithdrawLimitDaily } from './entities/withdraw-limit-daily.entity';
import { User } from '../users/entities/user.entity';
import { KYAT_PER_USDT, WITHDRAW_DELAY_HOURS } from './constants/treasury.constants';

@Injectable()
export class TreasuryService {
  private readonly logger = new Logger(TreasuryService.name);

  constructor(
    @InjectRepository(TreasuryTransaction)
    private treasuryTxRepository: Repository<TreasuryTransaction>,
    @InjectRepository(UserDeposit)
    private userDepositRepository: Repository<UserDeposit>,
    @InjectRepository(WithdrawRequest)
    private withdrawRequestRepository: Repository<WithdrawRequest>,
    @InjectRepository(WithdrawLimitDaily)
    private withdrawLimitDailyRepository: Repository<WithdrawLimitDaily>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  /**
   * Save raw treasury transaction (idempotent)
   */
  async saveTreasuryTransaction(
    txHash: string,
    direction: TreasuryDirection,
    asset: TreasuryAsset,
    amount: string,
    memo?: string,
  ): Promise<TreasuryTransaction> {
    // Check if already exists (idempotency)
    const existing = await this.treasuryTxRepository.findOne({
      where: { txHash },
    });

    if (existing) {
      return existing;
    }

    const tx = this.treasuryTxRepository.create({
      txHash,
      direction,
      asset,
      amount,
      memo: memo || null,
      processed: false,
    });

    return await this.treasuryTxRepository.save(tx);
  }

  /**
   * Process deposit from memo: deposit:<userId>
   */
  async processDeposit(treasuryTx: TreasuryTransaction): Promise<UserDeposit | null> {
    if (treasuryTx.processed) {
      return null;
    }

    const memo = treasuryTx.memo || '';
    if (!memo.startsWith('deposit:')) {
      return null;
    }

    // Parse memo: deposit:<userId>
    const parts = memo.split(':');
    if (parts.length !== 2) {
      this.logger.warn(`[TREASURY] Invalid deposit memo format: ${memo}`);
      return null;
    }

    const userId = parts[1];
    if (!userId) {
      this.logger.warn(`[TREASURY] Missing userId in deposit memo: ${memo}`);
      return null;
    }

    // Check if deposit already exists (idempotency)
    const existing = await this.userDepositRepository.findOne({
      where: { txHash: treasuryTx.txHash },
    });

    if (existing) {
      return existing;
    }

    // Calculate KYAT amount
    const amount = parseFloat(treasuryTx.amount);
    let kyatAmount: string;

    if (treasuryTx.asset === TreasuryAsset.USDT) {
      kyatAmount = (amount * KYAT_PER_USDT).toFixed(2);
    } else {
      // TON deposits: 1 TON = 5000 KYAT (same rate)
      kyatAmount = (amount * KYAT_PER_USDT).toFixed(2);
    }

    // Create deposit record
    const deposit = this.userDepositRepository.create({
      userId,
      txHash: treasuryTx.txHash,
      asset: treasuryTx.asset,
      amount: treasuryTx.amount,
      kyatAmount,
      status: UserDepositStatus.PENDING,
    });

    const saved = await this.userDepositRepository.save(deposit);

    // Mark treasury transaction as processed
    treasuryTx.processed = true;
    await this.treasuryTxRepository.save(treasuryTx);

    this.logger.log(`[TREASURY] Deposit created: ${saved.id} for user ${userId}, ${kyatAmount} KYAT`);

    return saved;
  }

  /**
   * Process withdraw request from memo: withdraw:<userId>:<kyatAmount>:<destinationAddress>
   */
  async processWithdrawRequest(treasuryTx: TreasuryTransaction): Promise<WithdrawRequest | null> {
    if (treasuryTx.processed) {
      return null;
    }

    const memo = treasuryTx.memo || '';
    if (!memo.startsWith('withdraw:')) {
      return null;
    }

    // Parse memo: withdraw:<userId>:<kyatAmount>:<destinationAddress>
    const parts = memo.split(':');
    if (parts.length !== 4) {
      this.logger.warn(`[TREASURY] Invalid withdraw memo format: ${memo}`);
      return null;
    }

    const userId = parts[1];
    const kyatAmount = parts[2];
    const destinationAddress = parts[3];

    if (!userId || !kyatAmount || !destinationAddress) {
      this.logger.warn(`[TREASURY] Missing fields in withdraw memo: ${memo}`);
      return null;
    }

    // Check if request already exists (idempotency)
    const existing = await this.withdrawRequestRepository.findOne({
      where: { feeTxHash: treasuryTx.txHash },
    });

    if (existing) {
      return existing;
    }

    // Calculate execute_after (1 hour delay)
    const executeAfter = new Date();
    executeAfter.setHours(executeAfter.getHours() + WITHDRAW_DELAY_HOURS);

    // Create withdraw request
    const request = this.withdrawRequestRepository.create({
      userId,
      kyatAmount,
      destinationAddress,
      feeTxHash: treasuryTx.txHash,
      status: WithdrawRequestStatus.PENDING,
      executeAfter,
    });

    const saved = await this.withdrawRequestRepository.save(request);

    // Mark treasury transaction as processed
    treasuryTx.processed = true;
    await this.treasuryTxRepository.save(treasuryTx);

    this.logger.log(`[TREASURY] Withdraw request created: ${saved.id} for user ${userId}, ${kyatAmount} KYAT`);

    return saved;
  }

  /**
   * Confirm deposit and credit user balance
   */
  async confirmDeposit(depositId: string): Promise<void> {
    const deposit = await this.userDepositRepository.findOne({
      where: { id: depositId },
      relations: ['user'],
    });

    if (!deposit) {
      throw new Error(`Deposit not found: ${depositId}`);
    }

    if (deposit.status === UserDepositStatus.CONFIRMED) {
      return; // Already confirmed
    }

    // Use transaction to ensure atomicity
    await this.dataSource.transaction(async (manager) => {
      // Update deposit status
      deposit.status = UserDepositStatus.CONFIRMED;
      await manager.save(deposit);

      // Credit user balance (additive - does not touch lottery logic)
      const user = await manager.findOne(User, { where: { id: deposit.userId } });
      if (user) {
        const currentBalance = parseFloat(user.kyatBalance.toString());
        const depositAmount = parseFloat(deposit.kyatAmount);
        user.kyatBalance = parseFloat((currentBalance + depositAmount).toFixed(2));
        await manager.save(user);

        this.logger.log(
          `[TREASURY] Deposit confirmed: ${depositId}, credited ${depositAmount} KYAT to user ${deposit.userId}`,
        );
      }
    });
  }

  /**
   * Get daily withdraw limit for user
   */
  async getDailyWithdrawLimit(userId: string, date: Date = new Date()): Promise<number> {
    // Use date at start of day for comparison
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);

    const limit = await this.withdrawLimitDailyRepository.findOne({
      where: {
        userId,
        date: dateStart,
      },
    });

    return limit ? parseFloat(limit.totalKyatWithdrawn) : 0;
  }

  /**
   * Update daily withdraw limit
   */
  async updateDailyWithdrawLimit(userId: string, amount: number, date: Date = new Date()): Promise<void> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);

    const limit = await this.withdrawLimitDailyRepository.findOne({
      where: {
        userId,
        date: dateStart,
      },
    });

    if (limit) {
      const current = parseFloat(limit.totalKyatWithdrawn);
      limit.totalKyatWithdrawn = (current + amount).toFixed(2);
      await this.withdrawLimitDailyRepository.save(limit);
    } else {
      const newLimit = this.withdrawLimitDailyRepository.create({
        userId,
        date: dateStart,
        totalKyatWithdrawn: amount.toFixed(2),
      });
      await this.withdrawLimitDailyRepository.save(newLimit);
    }
  }

  // Expose repositories for workers (internal use only)
  getRepositories() {
    return {
      treasuryTxRepository: this.treasuryTxRepository,
      userDepositRepository: this.userDepositRepository,
      withdrawRequestRepository: this.withdrawRequestRepository,
      withdrawLimitDailyRepository: this.withdrawLimitDailyRepository,
      userRepository: this.userRepository,
    };
  }
}

