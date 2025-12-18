import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsdtWithdrawalsController } from './usdt-withdrawals.controller';
import { UsdtWithdrawalsService } from './usdt-withdrawals.service';
import { UsdtWithdrawal } from './entities/usdt-withdrawal.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';
import { EventsModule } from '../../../gateways/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsdtWithdrawal]),
    UsersModule,
    forwardRef(() => TonModule),
    EventsModule,
  ],
  controllers: [UsdtWithdrawalsController],
  providers: [UsdtWithdrawalsService],
  exports: [UsdtWithdrawalsService],
})
export class UsdtWithdrawalsModule {}

