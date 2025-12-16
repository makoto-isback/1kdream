import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AutoBetPlanStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('autobet_plans')
export class AutoBetPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('simple-array')
  blocks: number[]; // Array of block numbers (1-25)

  @Column('decimal', { precision: 18, scale: 2 })
  betAmountPerBlock: number; // Amount per block per round

  @Column('int')
  roundsRemaining: number; // Number of rounds left

  @Column('int')
  totalRounds: number; // Original total rounds

  @Column('decimal', { precision: 18, scale: 2 })
  totalLockedAmount: number; // Total KYAT locked

  @Column({
    type: 'enum',
    enum: AutoBetPlanStatus,
    default: AutoBetPlanStatus.ACTIVE,
  })
  status: AutoBetPlanStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

