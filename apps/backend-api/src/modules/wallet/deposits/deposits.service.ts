import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Deposit, DepositStatus } from './entities/deposit.entity';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { TonService } from '../../../ton/ton.service';
import { InjectDataSource } from '@nestjs/typeorm';

const KYAT_PER_USD = 5000;
const MIN_DEPOSIT_KYAT = 1000;
const MIN_DEPOSIT_USDT = MIN_DEPOSIT_KYAT / KYAT_PER_USD; // 0.2 USDT

@Injectable()
export class DepositsService {
  constructor(
    @InjectRepository(Deposit)
    private depositsRepository: Repository<Deposit>,
    private usersService: UsersService,
    private tonService: TonService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async createDepositRequest(
    userId: string,
    usdtAmount: number,
  ): Promise<Deposit> {
    const kyatAmount = usdtAmount * KYAT_PER_USD;

    // Allow 0 amount for memo generation (when user just requests address)
    if (usdtAmount > 0 && kyatAmount < MIN_DEPOSIT_KYAT) {
      throw new BadRequestException(
        `Minimum deposit is ${MIN_DEPOSIT_KYAT} KYAT (${MIN_DEPOSIT_USDT} USDT)`,
      );
    }

    // Check if user has registered TON address
    const user = await this.usersService.findOne(userId);
    if (!user.tonAddress) {
      throw new BadRequestException(
        'Please register your TON address before making deposits',
      );
    }

    // Generate unique deposit memo (e.g. "ADR-XXXXXX")
    // Retry if memo already exists (very unlikely but handle edge case)
    let depositMemo: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      depositMemo = `ADR-${randomSuffix}`;
      
      // Check if memo already exists
      const existing = await this.depositsRepository.findOne({
        where: { depositMemo },
      });
      
      if (!existing) {
        break; // Memo is unique
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        throw new BadRequestException('Failed to generate unique deposit memo. Please try again.');
      }
    } while (attempts < maxAttempts);

    const deposit = this.depositsRepository.create({
      userId,
      usdtAmount,
      kyatAmount,
      status: DepositStatus.PENDING,
      tonTxHash: '', // Will be updated when transaction is detected
      senderTonAddress: user.tonAddress,
      depositMemo,
    });

    return this.depositsRepository.save(deposit);
  }

  async createPendingManualDeposit(
    senderTonAddress: string,
    usdtAmount: number,
    tonTxHash: string,
  ): Promise<Deposit> {
    const kyatAmount = usdtAmount * KYAT_PER_USD;

    // Find user by TON address
    const user = await this.usersService.findByTonAddress(senderTonAddress);

    const deposit = this.depositsRepository.create({
      userId: user ? user.id : null, // null if unknown user
      usdtAmount,
      kyatAmount,
      status: user ? DepositStatus.PENDING : DepositStatus.PENDING_MANUAL,
      tonTxHash,
      senderTonAddress,
    });

    return this.depositsRepository.save(deposit);
  }

  async confirmDeposit(
    depositId: string,
    tonTxHash: string,
    adminId: string, // Admin who confirms the deposit
    userId?: string, // Optional: if provided, auto-match to user
  ): Promise<Deposit> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const deposit = await queryRunner.manager.findOne(Deposit, {
        where: { id: depositId },
        lock: { mode: 'pessimistic_write' },
        relations: ['user'],
      });

      if (!deposit) {
        throw new NotFoundException('Deposit not found');
      }

      if (deposit.status === DepositStatus.CONFIRMED) {
        await queryRunner.commitTransaction();
        return deposit;
      }

      deposit.tonTxHash = tonTxHash;
      deposit.status = DepositStatus.CONFIRMED;
      deposit.confirmedAt = new Date();

      // If userId provided, update deposit user
      if (userId) {
        deposit.userId = userId;
      }

      // Add KYAT to user balance (with lock)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: deposit.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (user) {
        user.kyatBalance = Number(user.kyatBalance) + deposit.kyatAmount;
        await queryRunner.manager.save(user);
        console.log(`Admin ${adminId} confirmed deposit ${depositId}. Credited ${deposit.kyatAmount} KYAT to user ${deposit.userId}.`);
      }

      await queryRunner.manager.save(deposit);
      await queryRunner.commitTransaction();

      return deposit;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByTxHash(txHash: string): Promise<Deposit | null> {
    return this.depositsRepository.findOne({
      where: { tonTxHash: txHash },
    });
  }

  async getUserDeposits(userId: string): Promise<Deposit[]> {
    return this.depositsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllDeposits(): Promise<Deposit[]> {
    return this.depositsRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async getDepositById(id: string): Promise<Deposit> {
    const deposit = await this.depositsRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    return deposit;
  }

  async getDepositAddress(): Promise<string> {
    return this.tonService.getWalletAddress();
  }
}
