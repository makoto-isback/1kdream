import { IsNumber, IsString, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @IsNumber()
  @Min(5000) // Minimum 5,000 KYAT
  kyatAmount: number;

  @IsString()
  tonAddress: string;
}
