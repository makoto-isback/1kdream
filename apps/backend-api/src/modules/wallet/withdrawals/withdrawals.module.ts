import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsController } from './withdrawals.controller';
import { Withdrawal } from './entities/withdrawal.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Withdrawal]),
    UsersModule,
    TonModule,
    forwardRef(() => AuthModule), // Import AuthModule to access JwtModule for JwtAuthGuard
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}

