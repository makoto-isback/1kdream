import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemService } from './system.service';
import { SystemSettings } from './entities/system-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings])],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}

