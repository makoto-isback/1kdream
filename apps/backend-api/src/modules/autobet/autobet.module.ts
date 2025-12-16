import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutoBetService } from './autobet.service';
import { AutoBetController } from './autobet.controller';
import { AutoBetPlan } from './entities/autobet-plan.entity';
import { UsersModule } from '../users/users.module';
import { BetsModule } from '../bets/bets.module';
import { LotteryModule } from '../lottery/lottery.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutoBetPlan]),
    UsersModule,
    forwardRef(() => BetsModule),
    forwardRef(() => LotteryModule),
    SystemModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [AutoBetController],
  providers: [AutoBetService],
  exports: [AutoBetService],
})
export class AutoBetModule {}

