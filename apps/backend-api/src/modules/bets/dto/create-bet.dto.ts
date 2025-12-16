import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateBetDto {
  @IsInt()
  @Min(1)
  blockNumber: number; // 1-25

  @IsNumber()
  @Min(1000)
  amount: number; // in KYAT, minimum 1000
}
