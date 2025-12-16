import { Module, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { WalletModule } from '../wallet/wallet.module';
import { UsersModule } from '../users/users.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';
import { LotteryModule } from '../lottery/lottery.module';

@Module({
  imports: [
    WalletModule,
    UsersModule,
    SystemModule,
    forwardRef(() => LotteryModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
