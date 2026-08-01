import { LeadUserType } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateLeadDto {
  @ApiProperty({ description: 'First name of the lead', example: 'Ramesh' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({
    description: 'Mobile number of the lead',
    example: '9876543210',
  })
  @IsString()
  @MinLength(1)
  mobile: string;

  @ApiPropertyOptional({
    description: 'Email address of the lead',
    example: 'ramesh@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'PAN card number',
    example: 'ABCDE1234F',
  })
  @IsOptional()
  @IsString()
  pancard?: string;

  @ApiPropertyOptional({ description: 'Requested loan amount', example: 50000 })
  @IsOptional()
  @IsNumber()
  loanAmount?: number;

  @ApiPropertyOptional({
    description: 'Requested loan tenure in days',
    example: 90,
  })
  @IsOptional()
  @IsInt()
  tenureDays?: number;

  @ApiPropertyOptional({
    description: 'Purpose of the loan',
    example: 'Medical emergency',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ description: 'Type of lead user', enum: LeadUserType })
  @IsOptional()
  @IsEnum(LeadUserType)
  userType?: LeadUserType;

  @ApiPropertyOptional({
    description: 'Pincode of the lead',
    example: '400001',
  })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ description: 'Lead source', example: 'website' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'UTM source tracking parameter',
    example: 'google',
  })
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional({
    description: 'UTM campaign tracking parameter',
    example: 'summer-sale',
  })
  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @ApiPropertyOptional({
    description: 'UTM medium tracking parameter',
    example: 'cpc',
  })
  @IsOptional()
  @IsString()
  utmMedium?: string;

  @ApiPropertyOptional({
    description: 'UTM term tracking parameter',
    example: 'personal+loan',
  })
  @IsOptional()
  @IsString()
  utmTerm?: string;

  @ApiProperty({
    description: 'Company ID the lead is associated with',
    example: 1,
  })
  @IsInt()
  companyId: number;

  @ApiProperty({
    description: 'Product ID the lead is applying for',
    example: 1,
  })
  @IsInt()
  productId: number;

  @ApiPropertyOptional({
    description: 'Data source ID the lead originated from',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  dataSourceId?: number;

  @ApiPropertyOptional({ description: 'State ID of the lead', example: 1 })
  @IsOptional()
  @IsInt()
  stateId?: number;

  @ApiPropertyOptional({ description: 'City ID of the lead', example: 1 })
  @IsOptional()
  @IsInt()
  cityId?: number;

  @ApiPropertyOptional({
    description: 'Branch ID handling the lead',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  branchId?: number;
}
