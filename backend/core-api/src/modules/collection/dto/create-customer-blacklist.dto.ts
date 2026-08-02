import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateCustomerBlacklistDto {
  @IsOptional()
  @IsInt()
  reasonId?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
