import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bet } from './entities/bet.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LotteryService } from '../lottery/lottery.service';
import { SystemService } from '../system/system.service';

@Injectable()
export class BetsService {
  constructor(
    @InjectRepository(Bet)
    private betsRepository: Repository<Bet>,
    private usersService: UsersService,
    @Inject(forwardRef(() => LotteryService))
    private lotteryService: LotteryService,
    @InjectDataSource()
    private dataSource: DataSource,
    private systemService?: SystemService,
  ) {}

  async placeBet(
    userId: string,
    blockNumber: number,
    amount: number,
  ): Promise<Bet> {
    // Validate block number
    if (blockNumber < 1 || blockNumber > 25) {
      throw new BadRequestException('Block number must be between 1 and 25');
    }

    // Validate minimum bet
    if (amount < 1000) {
      throw new BadRequestException('Minimum bet is 1,000 KYAT');
    }

    // Validate maximum bet per user per round: 100,000 KYAT
    if (amount > 100000) {
      throw new BadRequestException('Maximum bet per round is 100,000 KYAT');
    }

    // Check if betting is paused
    if (this.systemService) {
      const bettingPaused = await this.systemService.isBettingPaused();
      if (bettingPaused) {
        throw new BadRequestException('Betting is currently paused');
      }
    }

    // Use database transaction for safety
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get active lottery round
      const activeRound = await this.lotteryService.getActiveRound();
      if (!activeRound) {
        throw new BadRequestException('No active lottery round');
      }

      // Check maximum bets per user per round: 10
      const userBetsInRound = await queryRunner.manager.count('Bet', {
        where: {
          userId,
          lotteryRoundId: activeRound.id,
        },
      });

      if (userBetsInRound >= 10) {
        throw new BadRequestException('Maximum 10 bets per round');
      }

      // Check total bet amount per user per round (including this bet)
      const existingBets = await queryRunner.manager.find(Bet, {
        where: {
          userId,
          lotteryRoundId: activeRound.id,
        },
      });

      const totalUserBetAmount = existingBets.reduce(
        (sum, bet) => sum + Number(bet.amount),
        0,
      );

      if (totalUserBetAmount + amount > 100000) {
        throw new BadRequestException(
          `Total bets per round cannot exceed 100,000 KYAT. Current: ${totalUserBetAmount} KYAT`,
        );
      }

      // Check user balance (within transaction)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (Number(user.kyatBalance) < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Deduct balance
      user.kyatBalance = Number(user.kyatBalance) - amount;
      await queryRunner.manager.save(user);

      // Add points: Every 1,000 KYAT bet = 10 points
      const pointsEarned = Math.floor(amount / 1000) * 10;
      user.points = Number(user.points) + pointsEarned;
      await queryRunner.manager.save(user);

      // Create bet
      const bet = queryRunner.manager.create(Bet, {
        userId,
        lotteryRoundId: activeRound.id,
        blockNumber,
        amount,
        isWinner: false,
      });

      const savedBet = await queryRunner.manager.save(bet);

      // Update lottery round pool (within transaction)
      await this.lotteryService.addBetToPool(activeRound.id, amount, queryRunner);

      await queryRunner.commitTransaction();
      return savedBet;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserBets(userId: string, limit: number = 50): Promise<Bet[]> {
    return this.betsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['lotteryRound'],
    });
  }

  async getRoundBets(roundId: string): Promise<Bet[]> {
    return this.betsRepository.find({
      where: { lotteryRoundId: roundId },
      relations: ['user'],
    });
  }

  async getWinningBets(roundId: string, winningBlock: number): Promise<Bet[]> {
    return this.betsRepository.find({
      where: {
        lotteryRoundId: roundId,
        blockNumber: winningBlock,
      },
      relations: ['user'],
    });
  }

  async updateBetPayout(
    betId: string,
    payout: number,
    queryRunner?: any,
  ): Promise<Bet> {
    const repository = queryRunner
      ? queryRunner.manager.getRepository(Bet)
      : this.betsRepository;

    const bet = await repository.findOne({ where: { id: betId } });
    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    bet.payout = payout;
    bet.isWinner = true;

    if (queryRunner) {
      return queryRunner.manager.save(bet);
    }
    return this.betsRepository.save(bet);
  }
}
