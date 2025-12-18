import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';

export enum UsdtDepositStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
}

@Entity('usdt_deposits')
export class UsdtDeposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  @Index()
  txHash: string; // TON transaction hash (unique to prevent replay)

  @Column('decimal', { precision: 18, scale: 8 })
  usdtAmount: number;

  @Column('decimal', { precision: 18, scale: 2 })
  kyatAmount: number; // usdtAmount * 5000

  @Column({
    type: 'enum',
    enum: UsdtDepositStatus,
    default: UsdtDepositStatus.PENDING,
  })
  status: UsdtDepositStatus;

  @CreateDateColumn()
  createdAt: Date;
}

