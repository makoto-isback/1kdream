import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('withdraw_limits_daily')
@Unique(['userId', 'date'])
@Index(['userId', 'date'])
export class WithdrawLimitDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('timestamp')
  date: Date;

  @Column('decimal', { precision: 38, scale: 2, default: 0 })
  totalKyatWithdrawn: string;

  @CreateDateColumn()
  createdAt: Date;
}

