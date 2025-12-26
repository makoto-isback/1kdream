import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { UsersModule } from '../modules/users/users.module';
import { LotteryModule } from '../modules/lottery/lottery.module';
import { BetsModule } from '../modules/bets/bets.module';

@Module({
  imports: [
    UsersModule,
    forwardRef(() => LotteryModule),
    forwardRef(() => BetsModule),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}

