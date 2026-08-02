import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDisbursementBankDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  accountNumber: string;

  @IsOptional()
  @IsBoolean()
  isImpsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isNeftEnabled?: boolean;
}
