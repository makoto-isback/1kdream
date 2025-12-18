import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Bet } from '../../bets/entities/bet.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  telegramId: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  kyatBalance: number;

  @Column('decimal', { precision: 18, scale: 2, default: 0 })
  points: number;

  @Column({ nullable: true })
  tonAddress: string; // Registered TON address for deposits

  @Column({ default: false })
  isAdmin: boolean; // Admin access flag

  @Column({ default: false })
  isActivated: boolean; // One-time 1 TON activation fee paid

  @Column('timestamp', { nullable: true })
  activatedAt: Date; // When user paid activation fee

  @OneToMany(() => Bet, (bet) => bet.user)
  bets: Bet[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
