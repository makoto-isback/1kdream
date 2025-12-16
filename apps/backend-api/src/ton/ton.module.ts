import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TonService } from './ton.service';
import { UsdtListenerService } from './usdt-listener.service';
import { WalletModule } from '../modules/wallet/wallet.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => WalletModule),
  ],
  providers: [TonService, UsdtListenerService],
  exports: [TonService, UsdtListenerService],
})
export class TonModule {}
