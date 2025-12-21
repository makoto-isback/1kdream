import { Injectable, NotFoundException, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LotteryRound, LotteryRoundStatus } from './entities/lottery-round.entity';
import { User } from '../users/entities/user.entity';
import { BetsService } from '../bets/bets.service';
import { UsersService } from '../users/users.service';
import { SystemService } from '../system/system.service';
import { EventsGateway } from '../../gateways/events.gateway';

@Injectable()
export class LotteryService {
  private readonly roundDurationMinutes: number;

  constructor(
    @InjectRepository(LotteryRound)
    private lotteryRoundRepository: Repository<LotteryRound>,
    @Inject(forwardRef(() => BetsService))
    private betsService: BetsService,
    private usersService: UsersService,
    @InjectDataSource()
    private dataSource: DataSource,
    @Optional()
    private systemService?: SystemService,
    @Optional()
    private eventsGateway?: EventsGateway,
  ) {
    const envDuration = process.env.ROUND_DURATION_MINUTES
      ? parseInt(process.env.ROUND_DURATION_MINUTES, 10)
      : undefined;
    // Default: prod 60 minutes, dev 1 minute (for testing)
    const fallback = process.env.NODE_ENV === 'development' ? 1 : 60;
    this.roundDurationMinutes = envDuration && !isNaN(envDuration) ? envDuration : fallback;
  }

  async getActiveRound(): Promise<LotteryRound | null> {
    return this.lotteryRoundRepository.findOne({
      where: { status: LotteryRoundStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  }

  async getLatestRound(): Promise<LotteryRound | null> {
    return this.lotteryRoundRepository.findOne({
      order: { createdAt: 'DESC' },
    });
  }

  async getRoundById(id: string): Promise<LotteryRound> {
    const round = await this.lotteryRoundRepository.findOne({
      where: { id },
      relations: ['bets'],
    });

    if (!round) {
      throw new NotFoundException('Lottery round not found');
    }

    return round;
  }

  async createNewRound(systemService?: any, forceCreate: boolean = false): Promise<LotteryRound> {
    console.log('🎲 [LotteryService] createNewRound called, forceCreate:', forceCreate);
    
    // Check if new rounds are paused (skip check if forceCreate)
    if (systemService && !forceCreate) {
      try {
        const newRoundsPaused = await systemService.isNewRoundsPaused();
        if (newRoundsPaused) {
          console.log('🎲 [LotteryService] ⚠️ New rounds are paused, cannot create new round');
          throw new Error('New rounds are currently paused');
        }
      } catch (err) {
        // If system service fails, log but continue (don't block round creation)
        if (err.message !== 'New rounds are currently paused') {
          console.warn('🎲 [LotteryService] ⚠️ SystemService check failed, continuing anyway:', err.message);
        } else {
          throw err;
        }
      }
    }

    // Get the latest round number
    const latestRound = await this.lotteryRoundRepository.findOne({
      where: {},
      order: { roundNumber: 'DESC' },
    });

    const roundNumber = latestRound ? latestRound.roundNumber + 1 : 1;

    // Create new round using configured duration
    const drawTime = new Date(Date.now() + this.roundDurationMinutes * 60 * 1000);

    console.log('🎲 [LotteryService] Creating round #' + roundNumber + ' with drawTime:', drawTime.toISOString());
    console.log('🎲 [LotteryService] Round duration:', this.roundDurationMinutes, 'minutes');

    const round = this.lotteryRoundRepository.create({
      roundNumber,
      status: LotteryRoundStatus.ACTIVE,
      drawTime,
      totalPool: 0,
      adminFee: 0,
      winnerPool: 0,
      totalBets: 0,
    });

    const savedRound = await this.lotteryRoundRepository.save(round);
    console.log('🎲 [LotteryService] ✅ Round #' + savedRound.roundNumber + ' created successfully (ID:', savedRound.id + ')');
    
    return savedRound;
  }

  async addBetToPool(
    roundId: string,
    amount: number,
    queryRunner?: any,
  ): Promise<void> {
    const repository = queryRunner
      ? queryRunner.manager.getRepository(LotteryRound)
      : this.lotteryRoundRepository;

    const round = await repository.findOne({
      where: { id: roundId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!round) {
      throw new NotFoundException('Lottery round not found');
    }

    round.totalPool = Number(round.totalPool) + amount;
    round.totalBets += 1;

    // Calculate admin fee (10%) and winner pool (90%)
    round.adminFee = Number(round.totalPool) * 0.1;
    round.winnerPool = Number(round.totalPool) * 0.9;

    if (queryRunner) {
      await queryRunner.manager.save(round);
    } else {
      await this.lotteryRoundRepository.save(round);
    }
  }

  async runLottery(): Promise<void> {
    console.log('🎲 [LotteryService] runLottery() called');
    
    // Get active round
    const activeRound = await this.getActiveRound();

    if (!activeRound) {
      // No active round - try to create one
      console.log('🎲 [LotteryService] No active round found, attempting to create new round');
      try {
        const newRound = await this.createNewRound(this.systemService);
        console.log('🎲 [LotteryService] ✅ Created new round:', newRound.roundNumber);
      } catch (error) {
        console.error('🎲 [LotteryService] ⚠️ Failed to create new round:', error.message);
      }
      return;
    }

    console.log('🎲 [LotteryService] Active round:', activeRound.roundNumber, 'drawTime:', activeRound.drawTime);

    // Check if it's time to draw
    const now = new Date();
    if (now >= activeRound.drawTime) {
      console.log('🎲 [LotteryService] Draw time has passed, executing drawWinner for round:', activeRound.roundNumber);
      try {
        await this.drawWinner(activeRound.id);
        console.log('🎲 [LotteryService] ✅ drawWinner completed for round:', activeRound.roundNumber);
      } catch (error) {
        console.error('🎲 [LotteryService] ❌ drawWinner failed:', error.message);
      }
    } else {
      console.log('🎲 [LotteryService] Draw time not reached yet, waiting...');
    }
  }

  async drawWinner(roundId: string): Promise<LotteryRound> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const round = await queryRunner.manager.findOne(LotteryRound, {
        where: { id: roundId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!round) {
        throw new NotFoundException('Lottery round not found');
      }

      if (round.status === LotteryRoundStatus.COMPLETED) {
        await queryRunner.commitTransaction();
        return round;
      }

      // Get all bets for this round
      const bets = await this.betsService.getRoundBets(roundId);

      if (bets.length === 0) {
        // No bets, just close the round
        round.status = LotteryRoundStatus.COMPLETED;
        round.drawnAt = new Date();
        await queryRunner.manager.save(round);
        await queryRunner.commitTransaction();

        // Create new round for next hour
        await this.createNewRound();
        return round;
      }

      // Generate random winning block (1-25)
      const winningBlock = Math.floor(Math.random() * 25) + 1;
      round.winningBlock = winningBlock;
      round.status = LotteryRoundStatus.COMPLETED;
      round.drawnAt = new Date();

      // Get all winning bets
      const winningBets = await this.betsService.getWinningBets(roundId, winningBlock);

      if (winningBets.length > 0) {
        // WINNING ROUND: Distribute winner pool proportionally
        // Calculate total bet amount for winning block
        const totalWinningBetAmount = winningBets.reduce(
          (sum, bet) => sum + Number(bet.amount),
          0,
        );

        // Distribute winner pool proportionally
        // Formula: (userBetOnWinningBlock / totalBetsOnWinningBlock) * winnerPool
        for (const bet of winningBets) {
          const proportion = Number(bet.amount) / totalWinningBetAmount;
          const payout = Number(round.winnerPool) * proportion;

          // Update bet with payout (within transaction)
          await this.betsService.updateBetPayout(bet.id, payout, queryRunner);

          // Add payout to user balance (within transaction with lock)
          const user = await queryRunner.manager.findOne(User, {
            where: { id: bet.userId },
            lock: { mode: 'pessimistic_write' },
          });

          if (user) {
            user.kyatBalance = Number(user.kyatBalance) + payout;
            await queryRunner.manager.save(user);
          }
        }
      } else {
        // NO-WINNER ROUND: Refund 90% proportionally to all users
        // Admin keeps 10%, refund 90% of total bets
        const refundPool = Number(round.totalPool) * 0.9;
        const totalBetsAmount = bets.reduce(
          (sum, bet) => sum + Number(bet.amount),
          0,
        );

        if (totalBetsAmount > 0) {
          // Refund proportionally: (userBet / totalBets) * refundPool
          for (const bet of bets) {
            const proportion = Number(bet.amount) / totalBetsAmount;
            const refundAmount = refundPool * proportion;

            // Add refund to user balance (within transaction with lock)
            const user = await queryRunner.manager.findOne(User, {
              where: { id: bet.userId },
              lock: { mode: 'pessimistic_write' },
            });

            if (user) {
              user.kyatBalance = Number(user.kyatBalance) + refundAmount;
              await queryRunner.manager.save(user);
            }
          }
        }
      }

      await queryRunner.manager.save(round);
      await queryRunner.commitTransaction();

      // Emit round:completed event IMMEDIATELY after transaction commits
      // This ensures all clients receive instant notification
      // Only emit if round has a winning block (rounds with no bets won't have one)
      if (this.eventsGateway && round.winningBlock) {
        console.log('🎲 [LotteryService] ✅ Transaction committed successfully');
        console.log('🎲 [LotteryService] 🚀 About to emit round:completed event');
        console.log('🎲 [LotteryService] Round ID:', round.id);
        console.log('🎲 [LotteryService] Round Number:', round.roundNumber);
        console.log('🎲 [LotteryService] Winning Block:', round.winningBlock);
        console.log('🎲 [LotteryService] EventsGateway available:', !!this.eventsGateway);
        
        this.eventsGateway.emitRoundCompleted({
          roundId: round.id,
          roundNumber: round.roundNumber,
          winningBlock: round.winningBlock,
          status: round.status,
          totalPool: Number(round.totalPool),
          winnerPool: Number(round.winnerPool),
          drawnAt: round.drawnAt || new Date(),
        });
        
        console.log('🎲 [LotteryService] ✅ emitRoundCompleted() called');
      } else {
        if (!this.eventsGateway) {
          console.warn('🎲 [LotteryService] ⚠️ EventsGateway not available - event not emitted');
        }
        if (!round.winningBlock) {
          console.warn('🎲 [LotteryService] ⚠️ No winning block - event not emitted');
        }
      }

      // Create new round for next hour (outside transaction)
      // If this fails, don't throw - the old round is already completed
      try {
        await this.createNewRound(this.systemService);
        console.log('🎲 [LotteryService] ✅ New round created successfully');
      } catch (createError) {
        console.error('🎲 [LotteryService] ⚠️ Failed to create new round:', createError.message);
        // Don't throw - the old round is completed, new round creation failure is non-critical
      }

      return round;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getRoundStats(roundId: string) {
    const round = await this.getRoundById(roundId);
    const bets = await this.betsService.getRoundBets(roundId);

    // Count bets per block
    const blockStats = Array.from({ length: 25 }, (_, i) => ({
      blockNumber: i + 1,
      totalBets: 0,
      totalAmount: 0,
    }));

    bets.forEach((bet) => {
      const blockIndex = bet.blockNumber - 1;
      blockStats[blockIndex].totalBets += 1;
      blockStats[blockIndex].totalAmount += Number(bet.amount);
    });

    return {
      round,
      blockStats,
    };
  }

  async getWinnersFeed(limit: number = 20) {
    const completedRounds = await this.lotteryRoundRepository.find({
      where: { status: LotteryRoundStatus.COMPLETED },
      order: { drawnAt: 'DESC' },
      take: limit,
      relations: ['bets', 'bets.user'],
    });

    const winners = [];

    for (const round of completedRounds) {
      if (!round.winningBlock) continue;

      const winningBets = round.bets.filter(
        (bet) => bet.blockNumber === round.winningBlock && bet.isWinner,
      );

      for (const bet of winningBets) {
        winners.push({
          roundNumber: round.roundNumber,
          block: round.winningBlock,
          username: this.maskUsername(bet.user?.username || bet.user?.firstName || 'User'),
          payout: Number(bet.payout),
          drawnAt: round.drawnAt,
        });
      }
    }

    return winners;
  }

  async getPoolInfo() {
    const activeRound = await this.getActiveRound();
    const latestRound = await this.getLatestRound();

    return {
      activeRound: activeRound
        ? {
            roundNumber: activeRound.roundNumber,
            totalPool: Number(activeRound.totalPool),
            winnerPool: Number(activeRound.winnerPool),
            adminFee: Number(activeRound.adminFee),
            totalBets: activeRound.totalBets,
            drawTime: activeRound.drawTime,
          }
        : null,
      latestRound: latestRound
        ? {
            roundNumber: latestRound.roundNumber,
            winningBlock: latestRound.winningBlock,
            totalPool: Number(latestRound.totalPool),
            status: latestRound.status,
            drawnAt: latestRound.drawnAt,
          }
        : null,
    };
  }

  private maskUsername(username: string): string {
    if (!username || username.length <= 3) {
      return username;
    }
    return username.substring(0, 2) + '***' + username.substring(username.length - 1);
  }

  /**
   * Get recent completed rounds with winning numbers
   * This returns ALL completed rounds, not just those with winners
   */
  async getRecentRounds(limit: number = 20) {
    const completedRounds = await this.lotteryRoundRepository.find({
      where: { status: LotteryRoundStatus.COMPLETED },
      order: { drawnAt: 'DESC' },
      take: limit,
      relations: ['bets'],
    });

    return completedRounds.map(round => {
      // Count winners on this block
      const winnersCount = round.winningBlock
        ? round.bets.filter(bet => bet.blockNumber === round.winningBlock && bet.isWinner).length
        : 0;
      
      // Calculate total payout for winners
      const totalPayout = round.bets
        .filter(bet => bet.blockNumber === round.winningBlock && bet.isWinner)
        .reduce((sum, bet) => sum + Number(bet.payout || 0), 0);

      return {
        roundNumber: round.roundNumber,
        winningBlock: round.winningBlock,
        winnersCount,
        totalPool: Number(round.totalPool),
        winnerPool: Number(round.winnerPool),
        totalPayout,
        drawnAt: round.drawnAt,
      };
    });
  }
}
