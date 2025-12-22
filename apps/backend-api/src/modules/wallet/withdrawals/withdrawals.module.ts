import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { Withdrawal } from './entities/withdrawal.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';
import { AuthModule } from '../../auth/auth.module';
import { SystemModule } from '../../system/system.module';
import { TelegramNotificationModule } from '../../../services/telegram-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal]),
    UsersModule,
    TonModule,
    forwardRef(() => AuthModule), // Import AuthModule to access JwtModule for JwtAuthGuard
    SystemModule,
    TelegramNotificationModule,
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService, TypeOrmModule], // Export TypeOrmModule so jobs can inject Withdrawal repository
})
export class WithdrawalsModule {}

