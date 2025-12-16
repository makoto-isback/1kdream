import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotteryService } from './lottery.service';
import { LotteryController } from './lottery.controller';
import { LotteryRound } from './entities/lottery-round.entity';
import { BetsModule } from '../bets/bets.module';
import { UsersModule } from '../users/users.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../../gateways/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LotteryRound]),
    forwardRef(() => BetsModule),
    UsersModule,
    SystemModule,
    forwardRef(() => AuthModule),
    EventsModule,
  ],
  controllers: [LotteryController],
  providers: [LotteryService],
  exports: [LotteryService],
})
export class LotteryModule {}
