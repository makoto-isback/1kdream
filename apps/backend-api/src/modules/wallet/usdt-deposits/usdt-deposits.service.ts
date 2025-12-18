import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UsdtDeposit, UsdtDepositStatus } from './entities/usdt-deposit.entity';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { TonService } from '../../../ton/ton.service';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { EventsGateway } from '../../../gateways/events.gateway';
import { Address } from '@ton/core';
import axios from 'axios';

const KYAT_PER_USDT = 5000;
const USDT_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // USDT Jetton Master on mainnet

@Injectable()
export class UsdtDepositsService {
  private readonly logger = new Logger(UsdtDepositsService.name);

  // Config-based limits (with defaults)
  private readonly MAX_DEPOSIT_USDT: number;

  constructor(
    @InjectRepository(UsdtDeposit)
    private usdtDepositsRepository: Repository<UsdtDeposit>,
    private usersService: UsersService,
    private tonService: TonService,
    private configService: ConfigService,
    @InjectDataSource()
    private dataSource: DataSource,
    private eventsGateway: EventsGateway,
  ) {
    // Load limits from config with defaults
    this.MAX_DEPOSIT_USDT = parseFloat(this.configService.get('MAX_DEPOSIT_USDT') || '1000');
  }

  /**
   * Verify USDT jetton transfer on-chain and process deposit
   */
  async verifyAndProcessDeposit(
    userId: string,
    txHash: string,
    expectedKyatAmount: number,
    userWalletAddress: string,
  ): Promise<UsdtDeposit> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if user is activated
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.isActivated) {
        throw new BadRequestException('User must be activated before depositing');
      }

      // Check if deposit already exists (replay attack prevention)
      const existing = await queryRunner.manager.findOne(UsdtDeposit, {
        where: { txHash },
      });

      if (existing) {
        throw new BadRequestException('Transaction already processed');
      }

      // Convert KYAT to USDT (backend calculation only)
      const expectedUsdtAmount = expectedKyatAmount / KYAT_PER_USDT;

      // Validate deposit limit (before on-chain verification to save API calls)
      if (expectedUsdtAmount > this.MAX_DEPOSIT_USDT) {
        throw new BadRequestException(
          `Maximum deposit is ${this.MAX_DEPOSIT_USDT} USDT (${this.MAX_DEPOSIT_USDT * KYAT_PER_USDT} KYAT)`,
        );
      }

      // Verify transaction on-chain
      const verification = await this.verifyUsdtTransfer(
        txHash,
        expectedUsdtAmount,
        userWalletAddress,
      );

      if (!verification.valid) {
        throw new BadRequestException(`Transaction verification failed: ${verification.reason}`);
      }

      // Get platform wallet address
      const platformWallet = this.configService.get('TON_WALLET_ADDRESS');
      if (!platformWallet) {
        throw new BadRequestException('Platform wallet not configured');
      }

      // Create deposit record
      const deposit = queryRunner.manager.create(UsdtDeposit, {
        userId,
        txHash,
        usdtAmount: verification.actualUsdtAmount,
        kyatAmount: verification.actualUsdtAmount * KYAT_PER_USDT, // Use actual amount from blockchain
        status: UsdtDepositStatus.CONFIRMED,
      });

      await queryRunner.manager.save(deposit);

      // Credit user balance (use actual amount from blockchain, not frontend amount)
      user.kyatBalance = Number(user.kyatBalance) + deposit.kyatAmount;
      await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      this.logger.log(
        `[USDT DEPOSIT] User ${userId} deposited ${deposit.usdtAmount} USDT (${deposit.kyatAmount} KYAT) via tx ${txHash}`,
      );

      // Emit socket event
      this.eventsGateway.emitToUser(userId, 'usdt_deposit_confirmed', {
        depositId: deposit.id,
        usdtAmount: deposit.usdtAmount,
        kyatAmount: deposit.kyatAmount,
        txHash: deposit.txHash,
        createdAt: deposit.createdAt,
      });

      return deposit;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`[USDT DEPOSIT] Error processing deposit:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Verify USDT jetton transfer on-chain
   */
  async verifyUsdtTransfer(
    txHash: string,
    expectedUsdtAmount: number,
    userWalletAddress: string,
  ): Promise<{ valid: boolean; reason?: string; actualUsdtAmount?: number }> {
    try {
      // Get platform wallet address
      const platformWallet = this.configService.get('TON_WALLET_ADDRESS');
      if (!platformWallet) {
        return { valid: false, reason: 'Platform wallet not configured' };
      }

      // Get TON API URL and key
      const tonApiUrl = this.configService.get('TON_API_URL') || 'https://toncenter.com/api/v3';
      const tonApiKey = this.configService.get('TON_API_KEY');

      // Parse platform wallet address
      const platformAddress = Address.parse(platformWallet);
      const addressString = platformAddress.toString({ urlSafe: true, bounceable: false });

      // Prepare headers
      const headers: Record<string, string> = {};
      if (tonApiKey) {
        headers['X-API-Key'] = tonApiKey.trim();
      }

      // Query jetton transfers for platform wallet
      // TON Center API v3: GET /jetton/transfers?address=<platform_wallet>&jetton=<usdt_master>
      const response = await axios.get(`${tonApiUrl}/jetton/transfers`, {
        params: {
          address: addressString,
          jetton: USDT_JETTON_MASTER,
          limit: 100,
        },
        headers,
      });

      const transfers = response.data?.result || [];

      // Find transfer matching txHash
      const transfer = transfers.find(
        (t: any) => t.tx_hash === txHash || t.hash === txHash || t.transaction_id === txHash,
      );

      if (!transfer) {
        return { valid: false, reason: 'Transaction not found in jetton transfers' };
      }

      // Verify recipient is platform wallet
      const recipient = transfer.destination?.address || transfer.destination;
      if (!recipient) {
        return { valid: false, reason: 'Transfer missing destination address' };
      }

      // Normalize addresses for comparison
      try {
        const recipientAddr = Address.parse(recipient);
        const platformAddr = Address.parse(platformWallet);
        if (!recipientAddr.equals(platformAddr)) {
          return { valid: false, reason: 'Recipient does not match platform wallet' };
        }
      } catch (error) {
        return { valid: false, reason: 'Invalid recipient address format' };
      }

      // Verify sender matches user wallet
      const sender = transfer.sender?.address || transfer.sender;
      if (!sender) {
        return { valid: false, reason: 'Transfer missing sender address' };
      }

      try {
        const senderAddr = Address.parse(sender);
        const userAddr = Address.parse(userWalletAddress);
        if (!senderAddr.equals(userAddr)) {
          return { valid: false, reason: 'Sender does not match user wallet address' };
        }
      } catch (error) {
        return { valid: false, reason: 'Invalid sender address format' };
      }

      // Parse USDT amount (6 decimals)
      const actualUsdtAmount = this.tonService.parseUsdtAmount(transfer);

      // Validate actual amount against limit (double-check after on-chain verification)
      if (actualUsdtAmount > this.MAX_DEPOSIT_USDT) {
        return {
          valid: false,
          reason: `Deposit amount ${actualUsdtAmount} USDT exceeds maximum limit of ${this.MAX_DEPOSIT_USDT} USDT`,
        };
      }

      if (actualUsdtAmount < expectedUsdtAmount * 0.99) {
        // Allow 1% variance
        return {
          valid: false,
          reason: `Amount mismatch: expected ${expectedUsdtAmount} USDT, got ${actualUsdtAmount} USDT`,
        };
      }

      return {
        valid: true,
        actualUsdtAmount,
      };
    } catch (error) {
      this.logger.error(`[USDT DEPOSIT] Verification error:`, error);
      return { valid: false, reason: `Verification failed: ${error.message}` };
    }
  }

  /**
   * Get user's USDT deposits
   */
  async getUserDeposits(userId: string): Promise<UsdtDeposit[]> {
    return this.usdtDepositsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find deposit by txHash
   */
  async findByTxHash(txHash: string): Promise<UsdtDeposit | null> {
    return this.usdtDepositsRepository.findOne({
      where: { txHash },
    });
  }

  /**
   * Get all USDT deposits (admin only)
   */
  async getAllDeposits(filters?: {
    userId?: string;
    status?: UsdtDepositStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<UsdtDeposit[]> {
    const queryBuilder = this.usdtDepositsRepository
      .createQueryBuilder('deposit')
      .leftJoinAndSelect('deposit.user', 'user')
      .orderBy('deposit.createdAt', 'DESC');

    if (filters?.userId) {
      queryBuilder.andWhere('deposit.userId = :userId', { userId: filters.userId });
    }

    if (filters?.status) {
      queryBuilder.andWhere('deposit.status = :status', { status: filters.status });
    }

    if (filters?.startDate) {
      queryBuilder.andWhere('deposit.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      queryBuilder.andWhere('deposit.createdAt <= :endDate', { endDate: filters.endDate });
    }

    return queryBuilder.getMany();
  }
}

