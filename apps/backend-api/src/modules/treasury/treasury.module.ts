import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TreasuryTransaction } from './entities/treasury-transaction.entity';
import { UserDeposit } from './entities/user-deposit.entity';
import { WithdrawRequest } from './entities/withdraw-request.entity';
import { WithdrawLimitDaily } from './entities/withdraw-limit-daily.entity';
import { TreasuryService } from './treasury.service';
import { TreasuryIndexerWorker } from './treasury-indexer.worker';
import { WithdrawExecutorWorker } from './withdraw-executor.worker';
import { DepositConfirmationWorker } from './deposit-confirmation.worker';
import { DailySummaryJob } from './daily-summary.job';
import { TreasuryController } from './treasury.controller';
import { TonModule } from '../../ton/ton.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TreasuryTransaction,
      UserDeposit,
      WithdrawRequest,
      WithdrawLimitDaily,
      User, // Required for TreasuryService to inject UserRepository
    ]),
    ScheduleModule,
    TonModule,
    UsersModule,
  ],
  providers: [
    TreasuryService,
    TreasuryIndexerWorker,
    WithdrawExecutorWorker,
    DepositConfirmationWorker,
    DailySummaryJob,
  ],
  controllers: [TreasuryController],
  exports: [TreasuryService],
})
export class TreasuryModule {}

