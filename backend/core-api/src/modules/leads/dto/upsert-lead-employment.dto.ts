import { IncomeType } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertLeadEmploymentDto {
  @ApiProperty({ description: 'Type of income', enum: IncomeType })
  @IsEnum(IncomeType)
  incomeType: IncomeType;

  @ApiPropertyOptional({ description: 'Monthly income amount', example: 35000 })
  @IsOptional()
  @IsNumber()
  monthlyIncome?: number;

  @ApiPropertyOptional({
    description: 'Mode of salary payment',
    example: 'Bank transfer',
  })
  @IsOptional()
  @IsString()
  salaryMode?: string;

  @ApiPropertyOptional({ description: 'Employer/company name' })
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional({ description: 'Job designation' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ description: 'Department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Type of employer', example: 'Private' })
  @IsOptional()
  @IsString()
  employerType?: string;

  @ApiPropertyOptional({ description: 'Employer address line 1' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ description: 'Employer address line 2' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ description: 'Employer address landmark' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiPropertyOptional({
    description: 'Employer address pincode',
    example: '400001',
  })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ description: 'Duration at current residence' })
  @IsOptional()
  @IsString()
  residenceSince?: string;

  @ApiPropertyOptional({ description: 'Duration of service/employment' })
  @IsOptional()
  @IsString()
  serviceTenure?: string;

  @ApiPropertyOptional({
    description: 'State ID of employer address',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  stateId?: number;

  @ApiPropertyOptional({
    description: 'City ID of employer address',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  cityId?: number;
}
