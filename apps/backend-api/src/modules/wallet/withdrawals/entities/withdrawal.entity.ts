import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('decimal', { precision: 18, scale: 2 })
  kyatAmount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  usdtAmount: number; // kyatAmount / 5000

  @Column()
  tonAddress: string;

  @Column({ nullable: true })
  tonTxHash: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @Column('timestamp', { nullable: true })
  processedAt: Date;

  @Column('timestamp', { nullable: true })
  requestTime: Date; // When withdrawal was requested (for 1-hour delay)

  @Column('timestamp', { nullable: true })
  completedAt: Date;

  @Column('timestamp', { nullable: true })
  rejectedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
