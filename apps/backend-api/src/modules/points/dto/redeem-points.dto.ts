import { IsNumber, Min } from 'class-validator';

export class RedeemPointsDto {
  @IsNumber()
  @Min(10000) // Minimum 10,000 points
  points: number;
}

