import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PointsRedemption } from './entities/points-redemption.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

const POINTS_PER_KYAT = 1; // 1,000 points = 1,000 KYAT (1:1 ratio)
const MIN_REDEEM_POINTS = 10000;

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointsRedemption)
    private redemptionRepository: Repository<PointsRedemption>,
    private usersService: UsersService,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  async redeemPoints(userId: string, pointsToRedeem: number): Promise<PointsRedemption> {
    // Validate minimum redemption
    if (pointsToRedeem < MIN_REDEEM_POINTS) {
      throw new BadRequestException(
        `Minimum redemption is ${MIN_REDEEM_POINTS} points`,
      );
    }

    // Calculate KYAT: 1,000 points = 1,000 KYAT (1:1 ratio)
    const kyatGranted = pointsToRedeem; // 1:1 ratio

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check user points (with lock)
      const user = await queryRunner.manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (Number(user.points) < pointsToRedeem) {
        throw new BadRequestException('Insufficient points');
      }

      // Deduct points
      user.points = Number(user.points) - pointsToRedeem;
      // Add KYAT (1:1 ratio)
      user.kyatBalance = Number(user.kyatBalance) + kyatGranted;

      await queryRunner.manager.save(user);

      // Create redemption record
      const redemption = queryRunner.manager.create(PointsRedemption, {
        userId,
        pointsUsed: pointsToRedeem,
        kyatGranted,
      });

      const savedRedemption = await queryRunner.manager.save(redemption);
      await queryRunner.commitTransaction();

      return savedRedemption;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserRedemptions(userId: string): Promise<PointsRedemption[]> {
    return this.redemptionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

