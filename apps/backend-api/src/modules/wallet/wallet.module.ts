import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositsService } from './deposits/deposits.service';
import { DepositsController } from './deposits/deposits.controller';
import { WithdrawalsService } from './withdrawals/withdrawals.service';
import { WithdrawalsController } from './withdrawals/withdrawals.controller';
import { Deposit } from './deposits/entities/deposit.entity';
import { Withdrawal } from './withdrawals/entities/withdrawal.entity';
import { UsersModule } from '../users/users.module';
import { TonModule } from '../../ton/ton.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit, Withdrawal]),
    UsersModule,
    forwardRef(() => TonModule),
    SystemModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [DepositsController, WithdrawalsController],
  providers: [DepositsService, WithdrawalsService],
  exports: [DepositsService, WithdrawalsService],
})
export class WalletModule {}
