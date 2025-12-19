import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { Deposit } from './entities/deposit.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Deposit]),
    UsersModule,
    TonModule,
    forwardRef(() => AuthModule), // Import AuthModule to access JwtModule for JwtAuthGuard
  ],
  controllers: [DepositsController],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}

