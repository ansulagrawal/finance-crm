import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCustomerBankingDto {
  @ApiProperty({ description: 'Bank name', example: 'HDFC Bank' })
  @IsString()
  @MinLength(1)
  bankName: string;

  @ApiProperty({
    description: 'IFSC code of the branch',
    example: 'HDFC0001234',
  })
  @IsString()
  @MinLength(1)
  ifscCode: string;

  @ApiProperty({ description: 'Bank account number', example: '123456789012' })
  @IsString()
  @MinLength(1)
  accountNumber: string;

  @ApiProperty({
    description: 'Bank account number, repeated for confirmation',
    example: '123456789012',
  })
  @IsString()
  @MinLength(1)
  confirmAccountNumber: string;

  @ApiPropertyOptional({
    description: 'Name of the account beneficiary',
    example: 'Ramesh Kumar',
  })
  @IsOptional()
  @IsString()
  beneficiaryName?: string;

  @ApiPropertyOptional({ description: 'Bank branch name', example: 'MG Road' })
  @IsOptional()
  @IsString()
  branch?: string;
}
