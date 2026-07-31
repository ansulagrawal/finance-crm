import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', example: 'Finance CRM Pvt Ltd' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ description: 'Short company code', example: 'FLP' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://financecrm.com',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Company address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Company contact number',
    example: '9876543210',
  })
  @IsOptional()
  @IsString()
  contactNumber?: string;

  @ApiPropertyOptional({
    description: 'Corporate Identification Number',
    example: 'U74899DL1993PTC053939',
  })
  @IsOptional()
  @IsString()
  cin?: string;

  @ApiPropertyOptional({
    description: 'Storage key of the uploaded company logo',
  })
  @IsOptional()
  @IsString()
  logoFileKey?: string;

  @ApiPropertyOptional({ description: 'Company type label', example: 'NBFC' })
  @IsOptional()
  @IsString()
  companyType?: string;
}
