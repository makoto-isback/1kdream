import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsdtDepositsController } from './usdt-deposits.controller';
import { UsdtDepositsService } from './usdt-deposits.service';
import { UsdtDeposit } from './entities/usdt-deposit.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';
import { EventsModule } from '../../../gateways/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsdtDeposit]),
    UsersModule,
    forwardRef(() => TonModule),
    EventsModule,
  ],
  controllers: [UsdtDepositsController],
  providers: [UsdtDepositsService],
  exports: [UsdtDepositsService],
})
export class UsdtDepositsModule {}

