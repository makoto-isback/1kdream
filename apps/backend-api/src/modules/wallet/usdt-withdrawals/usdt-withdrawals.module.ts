import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsdtWithdrawalsController } from './usdt-withdrawals.controller';
import { UsdtWithdrawalsService } from './usdt-withdrawals.service';
import { UsdtWithdrawal } from './entities/usdt-withdrawal.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';
import { EventsModule } from '../../../gateways/events.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsdtWithdrawal]),
    UsersModule,
    forwardRef(() => TonModule),
    EventsModule,
    forwardRef(() => AuthModule), // Import AuthModule to access JwtModule for JwtAuthGuard
  ],
  controllers: [UsdtWithdrawalsController],
  providers: [UsdtWithdrawalsService],
  exports: [UsdtWithdrawalsService],
})
export class UsdtWithdrawalsModule {}

