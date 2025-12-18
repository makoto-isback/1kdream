import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { WalletModule } from '../wallet/wallet.module';
import { UsersModule } from '../users/users.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';
import { LotteryModule } from '../lottery/lottery.module';
import { UsdtDepositsModule } from '../wallet/usdt-deposits/usdt-deposits.module';
import { UsdtWithdrawalsModule } from '../wallet/usdt-withdrawals/usdt-withdrawals.module';

@Module({
  imports: [
    WalletModule,
    UsersModule,
    SystemModule,
    forwardRef(() => LotteryModule),
    forwardRef(() => AuthModule),
    UsdtDepositsModule,
    UsdtWithdrawalsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
