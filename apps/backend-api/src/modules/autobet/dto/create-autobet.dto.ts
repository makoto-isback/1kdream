import { IsArray, IsNumber, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CreateAutoBetDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  blocks: number[]; // 1-25

  @IsNumber()
  @Min(1000)
  betAmountPerBlock: number; // Minimum 1,000 KYAT

  @IsNumber()
  @Min(1)
  @Max(1000) // Reasonable max
  totalRounds: number;
}

