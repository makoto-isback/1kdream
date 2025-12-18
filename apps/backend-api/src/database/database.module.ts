import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../modules/users/entities/user.entity';
import { Bet } from '../modules/bets/entities/bet.entity';
import { LotteryRound } from '../modules/lottery/entities/lottery-round.entity';
import { Deposit } from '../modules/wallet/deposits/entities/deposit.entity';
import { Withdrawal } from '../modules/wallet/withdrawals/entities/withdrawal.entity';
import { UsdtDeposit } from '../modules/wallet/usdt-deposits/entities/usdt-deposit.entity';
import { UsdtWithdrawal } from '../modules/wallet/usdt-withdrawals/entities/usdt-withdrawal.entity';
import { AutoBetPlan } from '../modules/autobet/entities/autobet-plan.entity';
import { PointsRedemption } from '../modules/points/entities/points-redemption.entity';
import { SystemSettings } from '../modules/system/entities/system-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT') || 5432,
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [
          User,
          Bet,
          LotteryRound,
          Deposit,
          Withdrawal,
          UsdtDeposit,
          UsdtWithdrawal,
          AutoBetPlan,
          PointsRedemption,
          SystemSettings,
        ],
        // Synchronize: Only enable in development OR when explicitly enabled via DATABASE_SYNC=true
        // WARNING: DATABASE_SYNC=true should only be used for initial schema creation in production
        // After first deploy, disable this and use migrations instead
        synchronize: configService.get('NODE_ENV') === 'development' || configService.get('DATABASE_SYNC') === 'true',
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('DATABASE_URL')?.includes('supabase') ? {
          rejectUnauthorized: false,
        } : false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
