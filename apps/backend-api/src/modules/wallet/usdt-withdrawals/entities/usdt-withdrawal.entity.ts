import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

export enum UsdtWithdrawalStatus {
  SIGNED = 'signed', // User signed withdrawal request
  QUEUED = 'queued', // Waiting for 1 hour delay
  SENT = 'sent', // USDT sent on-chain
  FAILED = 'failed', // Failed to send
  CANCELLED = 'cancelled', // Cancelled by admin
}

@Entity('usdt_withdrawals')
export class UsdtWithdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('decimal', { precision: 18, scale: 8 })
  usdtAmount: number;

  @Column('decimal', { precision: 18, scale: 2 })
  kyatAmount: number; // usdtAmount * 5000

  @Column()
  tonAddress: string; // Destination wallet address

  @Column({
    type: 'enum',
    enum: UsdtWithdrawalStatus,
    default: UsdtWithdrawalStatus.SIGNED,
  })
  status: UsdtWithdrawalStatus;

  @Column('timestamp')
  signedAt: Date; // When user signed withdrawal request

  @Column('timestamp')
  @Index()
  executeAfter: Date; // signedAt + 1 hour (when to execute)

  @Column({ nullable: true })
  tonTxHash: string; // Transaction hash after sending

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

