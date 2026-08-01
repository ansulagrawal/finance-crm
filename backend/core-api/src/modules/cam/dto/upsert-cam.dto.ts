import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Legacy `CAMController::savePaydayCAMDetails()` hard-rejects any
 * `loan_recommended > 115000` server-side ("Loan recommended cannot be
 * grater then Rs. 1,15,000."). */
const MAX_RECOMMENDED_LOAN_AMOUNT = 115000;

export class UpsertCamDto {
  @ApiProperty({ description: 'Recommended loan amount', example: 45000 })
  @IsNumber()
  @Max(MAX_RECOMMENDED_LOAN_AMOUNT)
  recommendedLoanAmount: number;

  @ApiProperty({ description: 'Rate of interest (%)', example: 24 })
  @IsNumber()
  roi: number;

  @ApiPropertyOptional({
    description: 'Penal rate of interest (%)',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  penalRoi?: number;

  @ApiProperty({ description: 'Loan tenure in days', example: 90 })
  @IsInt()
  tenureDays: number;

  @ApiPropertyOptional({
    description: 'Processing fee percentage',
    example: 2.5,
  })
  @IsOptional()
  @IsNumber()
  processingFeePercent?: number;

  @ApiPropertyOptional({ description: 'Admin fee amount', example: 500 })
  @IsOptional()
  @IsNumber()
  adminFee?: number;

  @ApiProperty({
    description: 'Net amount to be disbursed after fee deductions',
    example: 42500,
  })
  @IsNumber()
  netDisbursalAmount: number;

  @ApiProperty({ description: 'Total repayment amount due', example: 55000 })
  @IsNumber()
  repaymentAmount: number;

  @ApiPropertyOptional({
    description: 'Planned disbursal date (ISO date string)',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString()
  disbursalDate?: string;

  @ApiPropertyOptional({
    description: 'Planned repayment date (ISO date string)',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString()
  repaymentDate?: string;

  @ApiPropertyOptional({
    description: 'Eligible FOIR (fixed obligation to income ratio) percentage',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  eligibleFoirPercentage?: number;

  @ApiPropertyOptional({
    description: 'Final FOIR percentage after appraisal',
    example: 45,
  })
  @IsOptional()
  @IsNumber()
  finalFoirPercentage?: number;

  @ApiProperty({
    description: 'Appraised monthly income',
    example: 35000,
  })
  @IsPositive()
  appraisedMonthlyIncome: number;

  @ApiProperty({
    description: 'Appraised monthly obligations',
    example: 8000,
  })
  @IsNumber()
  @Min(0)
  appraisedObligations: number;

  @ApiPropertyOptional({
    description: 'Risk profile classification',
    example: 'Low',
  })
  @IsOptional()
  @IsString()
  riskProfile?: string;

  @ApiPropertyOptional({ description: 'Computed risk score', example: 72 })
  @IsOptional()
  @IsNumber()
  riskScore?: number;

  @ApiPropertyOptional({ description: 'Free-text remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
