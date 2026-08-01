import { IsString, MinLength } from 'class-validator';

export class CreateBlacklistedPincodeDto {
  @IsString()
  @MinLength(1)
  pincode: string;
}
