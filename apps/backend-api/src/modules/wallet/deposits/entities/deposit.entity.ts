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

export enum DepositStatus {
  PENDING = 'pending',
  PENDING_MANUAL = 'pending_manual', // Unknown sender, needs admin review
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

@Entity('deposits')
export class Deposit {
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
  tonTxHash: string;

  @Column({ nullable: true })
  senderTonAddress: string; // Sender's TON address

  @Column({ nullable: true, unique: true })
  depositMemo: string; // Unique memo for deposit matching (e.g. "ADR-XXXXXX")

  @Column({
    type: 'enum',
    enum: DepositStatus,
    default: DepositStatus.PENDING,
  })
  status: DepositStatus;

  @Column('timestamp', { nullable: true })
  confirmedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
