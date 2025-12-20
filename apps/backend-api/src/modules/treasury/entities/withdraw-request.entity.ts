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

export enum WithdrawRequestStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

@Entity('withdraw_requests')
export class WithdrawRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('decimal', { precision: 38, scale: 2 })
  kyatAmount: string;

  @Column()
  destinationAddress: string;

  @Column({ nullable: true, unique: true })
  feeTxHash: string;

  @Column({
    type: 'enum',
    enum: WithdrawRequestStatus,
    default: WithdrawRequestStatus.PENDING,
  })
  status: WithdrawRequestStatus;

  @Column('timestamp', { nullable: true })
  executeAfter: Date;

  @Column({ nullable: true })
  payoutTxHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

