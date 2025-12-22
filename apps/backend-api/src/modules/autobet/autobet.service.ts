import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AutoBetPlan, AutoBetPlanStatus } from './entities/autobet-plan.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { BetsService } from '../bets/bets.service';
import { LotteryService } from '../lottery/lottery.service';
import { SystemService } from '../system/system.service';

@Injectable()
export class AutoBetService {
  private readonly logger = new Logger(AutoBetService.name);
  
  // Track last executed round per plan to avoid multiple executions in the same round
  private lastExecutedRound: Map<string, string> = new Map();

  constructor(
    @InjectRepository(AutoBetPlan)
    private autobetRepository: Repository<AutoBetPlan>,
    private usersService: UsersService,
    private betsService: BetsService,
    private lotteryService: LotteryService,
    private systemService: SystemService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async createPlan(
    userId: string,
    blocks: number[],
    betAmountPerBlock: number,
    totalRounds: number,
  ): Promise<AutoBetPlan> {
    // Validate blocks
    if (blocks.length === 0 || blocks.length > 25) {
      throw new BadRequestException('Must select 1-25 blocks');
    }

    for (const block of blocks) {
      if (block < 1 || block > 25) {
        throw new BadRequestException('Block numbers must be between 1 and 25');
      }
    }

    // Validate bet amount
    if (betAmountPerBlock < 1000) {
      throw new BadRequestException('Minimum bet per block is 1,000 KYAT');
    }

    // Validate rounds
    if (totalRounds < 1) {
      throw new BadRequestException('Must have at least 1 round');
    }

    // Calculate total locked amount
    const totalLockedAmount = blocks.length * betAmountPerBlock * totalRounds;

    // Check if this would exceed max bet per round (100K per round)
    const totalPerRound = blocks.length * betAmountPerBlock;
    if (totalPerRound > 100000) {
      throw new BadRequestException(
        `Total bets per round (${totalPerRound} KYAT) cannot exceed 100,000 KYAT`,
      );
    }

    // Check if this would exceed max bets per round (10)
    if (blocks.length > 10) {
      throw new BadRequestException('Maximum 10 bets per round');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check user balance
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (Number(user.kyatBalance) < totalLockedAmount) {
        throw new BadRequestException('Insufficient balance');
      }

      // Lock balance
      user.kyatBalance = Number(user.kyatBalance) - totalLockedAmount;
      await queryRunner.manager.save(user);

      // Create plan
      const plan = queryRunner.manager.create(AutoBetPlan, {
        userId,
        blocks,
        betAmountPerBlock,
        roundsRemaining: totalRounds,
        totalRounds,
        totalLockedAmount,
        status: AutoBetPlanStatus.ACTIVE,
      });

      const savedPlan = await queryRunner.manager.save(plan);
      await queryRunner.commitTransaction();

      // Execute bets immediately for the current round
      // This ensures the pool increases right away, not waiting for the next hour
      try {
        const activeRound = await this.lotteryService.getActiveRound();
        if (activeRound) {
          this.logger.log(`[AUTOBET] Executing immediate bets for new plan ${savedPlan.id} in round ${activeRound.id}`);
          // Execute bets for current round immediately
          await this.executePlanBets(savedPlan, activeRound.id);
          // IMPORTANT: Mark this round as executed to prevent the cron job from double-executing
          this.lastExecutedRound.set(savedPlan.id, activeRound.id);
          this.logger.log(`[AUTOBET] Immediate execution complete. Marked round ${activeRound.id} as executed for plan ${savedPlan.id}`);
        }
      } catch (error) {
        // Log error but don't fail the plan creation
        // The cron job will retry on the next round
        this.logger.error(`[AUTOBET] Error executing immediate bets for plan ${savedPlan.id}:`, error);
      }

      return savedPlan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async cancelPlan(planId: string, userId: string): Promise<AutoBetPlan> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const plan = await queryRunner.manager.findOne(AutoBetPlan, {
        where: { id: planId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!plan) {
        throw new NotFoundException('AutoBet plan not found');
      }

      if (plan.status !== AutoBetPlanStatus.ACTIVE) {
        throw new BadRequestException('Plan is not active');
      }

      // Calculate refund: (roundsRemaining / totalRounds) * totalLockedAmount
      const refundAmount =
        (plan.roundsRemaining / plan.totalRounds) * Number(plan.totalLockedAmount);

      // Refund to user
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (user) {
        user.kyatBalance = Number(user.kyatBalance) + refundAmount;
        await queryRunner.manager.save(user);
      }

      plan.status = AutoBetPlanStatus.CANCELLED;
      await queryRunner.manager.save(plan);
      await queryRunner.commitTransaction();

      return plan;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async executeAutoBets(): Promise<void> {
    // Get all active plans
    const activePlans = await this.autobetRepository.find({
      where: { status: AutoBetPlanStatus.ACTIVE },
      relations: ['user'],
    });

    // Check if betting is paused
    const bettingPaused = await this.systemService.isBettingPaused();
    if (bettingPaused) {
      return;
    }

    const activeRound = await this.lotteryService.getActiveRound();
    if (!activeRound) {
      return;
    }

    for (const plan of activePlans) {
      // Skip if this plan already executed for this round
      const lastRoundId = this.lastExecutedRound.get(plan.id);
      if (lastRoundId === activeRound.id) {
        this.logger.debug(`[AUTOBET] Skipping plan ${plan.id} - already executed for round ${activeRound.id}`);
        continue;
      }
      try {
        this.logger.log(`[AUTOBET] Executing plan ${plan.id} for round ${activeRound.id} (${plan.blocks.length} blocks x ${plan.betAmountPerBlock} KYAT)`);
        await this.executePlanBets(plan, activeRound.id);
        // Mark as executed for this round
        this.lastExecutedRound.set(plan.id, activeRound.id);
        this.logger.log(`[AUTOBET] Plan ${plan.id} executed successfully for round ${activeRound.id}`);
      } catch (error) {
        // Log error but continue with other plans
        this.logger.error(`[AUTOBET] Error executing plan ${plan.id}:`, error);
      }
    }
  }

  private async executePlanBets(plan: AutoBetPlan, roundId: string): Promise<void> {
    // First, check and update plan status in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let lockedPlan: AutoBetPlan;
    let totalNeeded: number;

    try {
      // Reload plan with lock
      lockedPlan = await queryRunner.manager.findOne(AutoBetPlan, {
        where: { id: plan.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedPlan || lockedPlan.status !== AutoBetPlanStatus.ACTIVE) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Check if plan has remaining rounds
      if (lockedPlan.roundsRemaining <= 0) {
        lockedPlan.status = AutoBetPlanStatus.COMPLETED;
        await queryRunner.manager.save(lockedPlan);
        await queryRunner.commitTransaction();
        return;
      }

      // Check user exists
      const user = await queryRunner.manager.findOne(User, {
        where: { id: plan.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Calculate amount needed for this round
      totalNeeded = plan.blocks.length * Number(plan.betAmountPerBlock);

      // Note: Balance was already deducted when plan was created (totalLockedAmount)
      // But placeBet will try to deduct again, so we need to temporarily add it back
      // Add back the amount for this round so placeBet can deduct it
      user.kyatBalance = Number(user.kyatBalance) + totalNeeded;
      await queryRunner.manager.save(user);

      // Commit this transaction so placeBet can see the updated balance
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Now place bets (placeBet uses its own transaction)
    // If any bet fails, we need to revert the balance and pause the plan
    try {
      for (const block of plan.blocks) {
        await this.betsService.placeBet(
          plan.userId,
          block,
          Number(plan.betAmountPerBlock),
        );
      }

      // All bets succeeded, update plan rounds
      const updateRunner = this.dataSource.createQueryRunner();
      await updateRunner.connect();
      await updateRunner.startTransaction();

      try {
        const planToUpdate = await updateRunner.manager.findOne(AutoBetPlan, {
          where: { id: plan.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (planToUpdate && planToUpdate.status === AutoBetPlanStatus.ACTIVE) {
          planToUpdate.roundsRemaining -= 1;

          if (planToUpdate.roundsRemaining <= 0) {
            planToUpdate.status = AutoBetPlanStatus.COMPLETED;
          }

          await updateRunner.manager.save(planToUpdate);
          await updateRunner.commitTransaction();
        } else {
          await updateRunner.rollbackTransaction();
        }
      } catch (error) {
        await updateRunner.rollbackTransaction();
        throw error;
      } finally {
        await updateRunner.release();
      }
    } catch (error) {
      // If bet fails, revert the balance addition and pause plan
      const revertRunner = this.dataSource.createQueryRunner();
      await revertRunner.connect();
      await revertRunner.startTransaction();

      try {
        const user = await revertRunner.manager.findOne(User, {
          where: { id: plan.userId },
          lock: { mode: 'pessimistic_write' },
        });

        const planToPause = await revertRunner.manager.findOne(AutoBetPlan, {
          where: { id: plan.id },
          lock: { mode: 'pessimistic_write' },
        });

        if (user) {
          // Revert the balance addition
          user.kyatBalance = Number(user.kyatBalance) - totalNeeded;
          await revertRunner.manager.save(user);
        }

        if (planToPause) {
          planToPause.status = AutoBetPlanStatus.PAUSED;
          await revertRunner.manager.save(planToPause);
        }

        await revertRunner.commitTransaction();
      } catch (revertError) {
        await revertRunner.rollbackTransaction();
        console.error('Error reverting balance after bet failure:', revertError);
      } finally {
        await revertRunner.release();
      }

      throw error;
    }
  }

  async getUserPlans(userId: string): Promise<AutoBetPlan[]> {
    return this.autobetRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

