import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('points_redemptions')
export class PointsRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('decimal', { precision: 18, scale: 2 })
  pointsUsed: number;

  @Column('decimal', { precision: 18, scale: 2 })
  kyatGranted: number; // pointsUsed / 1000 * 1000 (1:1 ratio)

  @CreateDateColumn()
  createdAt: Date;
}

