import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Bet } from '../../bets/entities/bet.entity';

export enum LotteryRoundStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

@Entity('lottery_rounds')
export class LotteryRound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', { unique: true })
  roundNumber: number;

  @Column({
    type: 'enum',
    enum: LotteryRoundStatus,
    default: LotteryRoundStatus.PENDING,
  })
  status: LotteryRoundStatus;

  @Column('int', { nullable: true })
  winningBlock: number; // 1-25, null until drawn

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  totalPool: number; // total bets in KYAT

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  adminFee: number; // 10% of total pool

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  winnerPool: number; // 90% of total pool

  @Column('int', { default: 0 })
  totalBets: number;

  @Column('timestamp')
  drawTime: Date;

  @Column('timestamp', { nullable: true })
  drawnAt: Date;

  @OneToMany(() => Bet, (bet) => bet.lotteryRound)
  bets: Bet[];

  @CreateDateColumn()
  createdAt: Date;
}
