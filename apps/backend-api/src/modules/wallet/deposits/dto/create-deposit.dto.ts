import { IsNumber, Min } from 'class-validator';

export class CreateDepositDto {
  @IsNumber()
  @Min(0.2) // 0.2 USDT = 1000 KYAT minimum
  usdtAmount: number;
}
