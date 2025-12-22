import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { BetsModule } from './modules/bets/bets.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WithdrawalsModule } from './modules/wallet/withdrawals/withdrawals.module';
import { UsdtWithdrawalsModule } from './modules/wallet/usdt-withdrawals/usdt-withdrawals.module';
import { AdminModule } from './modules/admin/admin.module';
import { TonModule } from './ton/ton.module';
import { AutoBetModule } from './modules/autobet/autobet.module';
import { PointsModule } from './modules/points/points.module';
import { SystemModule } from './modules/system/system.module';
import { TreasuryModule } from './modules/treasury/treasury.module';
import { HourlyDrawJob } from './jobs/hourly-draw.job';
import { AutoBetExecutionJob } from './jobs/autobet-execution.job';
import { StartupInitJob } from './jobs/startup-init.job';
import { UsdtWithdrawalExecutionJob } from './jobs/usdt-withdrawal-execution.job';
import { WithdrawalReadyNotificationJob } from './jobs/withdrawal-ready-notification.job';
import { EventsModule } from './gateways/events.module';
import { TelegramNotificationModule } from './services/telegram-notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    LotteryModule,
    BetsModule,
    WalletModule,
    WithdrawalsModule, // Required for WithdrawalReadyNotificationJob
    UsdtWithdrawalsModule, // Required for UsdtWithdrawalExecutionJob
    AdminModule,
    TonModule,
    AutoBetModule,
    PointsModule,
    SystemModule,
    TreasuryModule,
    EventsModule,
    TelegramNotificationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    HourlyDrawJob,
    AutoBetExecutionJob,
    StartupInitJob,
    UsdtWithdrawalExecutionJob,
    WithdrawalReadyNotificationJob,
  ],
})
export class AppModule {}
