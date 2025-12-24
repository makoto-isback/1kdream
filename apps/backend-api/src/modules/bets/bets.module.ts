import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';
import { Bet } from './entities/bet.entity';
import { UsersModule } from '../users/users.module';
import { LotteryModule } from '../lottery/lottery.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../../gateways/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bet]),
    UsersModule,
    forwardRef(() => LotteryModule),
    SystemModule,
    forwardRef(() => AuthModule),
    EventsModule,
  ],
  controllers: [BetsController],
  providers: [BetsService],
  exports: [BetsService],
})
export class BetsModule {}
