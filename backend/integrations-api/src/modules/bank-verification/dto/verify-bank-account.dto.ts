import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

export class VerifyBankAccountDto {
  @ApiProperty({
    description: 'Lead ID this bank verification belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'Beneficiary bank account number' })
  @IsString()
  beneficiaryAccount: string;

  @ApiProperty({
    description: 'Beneficiary name to fuzzy-match against the bank record',
  })
  @IsString()
  beneficiaryName: string;

  @ApiProperty({
    description: 'Beneficiary bank IFSC code',
    example: 'HDFC0000123',
  })
  @IsString()
  beneficiaryIfsc: string;

  @ApiPropertyOptional({ description: 'Beneficiary mobile number' })
  @IsOptional()
  @IsString()
  beneficiaryMobile?: string;

  @ApiPropertyOptional({ description: 'Beneficiary email address' })
  @IsOptional()
  @IsEmail()
  beneficiaryEmail?: string;
}
