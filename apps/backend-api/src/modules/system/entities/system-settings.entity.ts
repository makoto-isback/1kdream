import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryColumn({ default: 'main' })
  id: string;

  @Column({ default: false })
  withdrawalsPaused: boolean;

  @Column({ default: false })
  bettingPaused: boolean;

  @Column({ default: false })
  newRoundsPaused: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}

