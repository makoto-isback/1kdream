import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { User } from '../../users/entities/user.entity';
import { UsersModule } from '../../users/users.module';
import { TonModule } from '../../../ton/ton.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    forwardRef(() => TonModule),
  ],
  controllers: [ActivationController],
  providers: [ActivationService],
  exports: [ActivationService],
})
export class ActivationModule {}

