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
import { User } from '../../users/entities/user.entity';

export enum UserDepositStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
}

@Entity('user_deposits')
@Index(['txHash'], { unique: true })
export class UserDeposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  txHash: string;

  @Column()
  asset: string; // 'TON' | 'USDT'

  @Column('decimal', { precision: 38, scale: 18 })
  amount: string;

  @Column('decimal', { precision: 38, scale: 2 })
  kyatAmount: string;

  @Column({
    type: 'enum',
    enum: UserDepositStatus,
    default: UserDepositStatus.PENDING,
  })
  status: UserDepositStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

