import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute in milliseconds
        limit: 2000, // 2000 requests per minute for authenticated endpoints (33 req/sec - very high for normal usage)
      },
      {
        name: 'strict',
        ttl: 60000, // 1 minute
        limit: 1000, // 1000 requests per minute (not used much since public endpoints skip throttling)
      },
      {
        name: 'bets',
        ttl: 60000, // 1 minute
        limit: 500, // 500 bet placements per minute (allows many bets + refetches)
      },
      {
        name: 'auth',
        ttl: 900000, // 15 minutes
        limit: 5, // 5 login attempts per 15 minutes to prevent brute force
      },
    ]),
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
    TelegramBotModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    HourlyDrawJob,
    AutoBetExecutionJob,
    StartupInitJob,
    UsdtWithdrawalExecutionJob,
    WithdrawalReadyNotificationJob,
    // Apply rate limiting globally (can be overridden per route)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
