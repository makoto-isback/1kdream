import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TreasuryDirection {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TreasuryAsset {
  TON = 'TON',
  USDT = 'USDT',
}

@Entity('treasury_transactions')
@Index(['txHash'], { unique: true })
export class TreasuryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  txHash: string;

  @Column({
    type: 'enum',
    enum: TreasuryDirection,
  })
  direction: TreasuryDirection;

  @Column({
    type: 'enum',
    enum: TreasuryAsset,
  })
  asset: TreasuryAsset;

  @Column('decimal', { precision: 38, scale: 18 })
  amount: string;

  @Column({ type: 'text', nullable: true })
  memo: string;

  @Column({ default: false })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

