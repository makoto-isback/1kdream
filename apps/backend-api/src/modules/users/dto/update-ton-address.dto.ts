import { IsString } from 'class-validator';

export class UpdateTonAddressDto {
  @IsString()
  tonAddress: string;
}

