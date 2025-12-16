import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { LotteryRound } from '../../lottery/entities/lottery-round.entity';

@Entity('bets')
export class Bet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid', { nullable: true })
  lotteryRoundId: string;

  @ManyToOne(() => LotteryRound, { nullable: true })
  @JoinColumn({ name: 'lotteryRoundId' })
  lotteryRound: LotteryRound;

  @Column('int')
  blockNumber: number; // 1-25

  @Column('decimal', { precision: 18, scale: 2 })
  amount: number; // in KYAT

  @Column('decimal', { precision: 18, scale: 2, nullable: true })
  payout: number; // in KYAT, null if not won

  @Column({ default: false })
  isWinner: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
