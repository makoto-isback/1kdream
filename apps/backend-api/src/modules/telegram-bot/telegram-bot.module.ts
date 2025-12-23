import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramBotController } from './telegram-bot.controller';
import { TelegramBotService } from '../../services/telegram-bot.service';
import { UsersModule } from '../users/users.module';
import { LotteryModule } from '../lottery/lottery.module';
import { BetsModule } from '../bets/bets.module';
import { AuthModule } from '../auth/auth.module';
import { Bet } from '../bets/entities/bet.entity';
import { LotteryRound } from '../lottery/entities/lottery-round.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bet, LotteryRound]),
    UsersModule,
    LotteryModule,
    BetsModule,
    AuthModule, // Required for JwtAuthGuard and AdminGuard
  ],
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}

