import { LoanPaymentMode, LoanPaymentType } from '@finance-crm/database';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class DisburseLoanDto {
  @ApiProperty({
    description: 'Disbursement bank account ID to disburse from',
    example: 1,
  })
  @IsInt()
  disbursementBankId: number;

  @ApiProperty({
    description: 'Payment mode used for disbursement',
    enum: LoanPaymentMode,
  })
  @IsEnum(LoanPaymentMode)
  paymentMode: LoanPaymentMode;

  @ApiProperty({
    description: 'Payment type used for disbursement',
    enum: LoanPaymentType,
  })
  @IsEnum(LoanPaymentType)
  paymentType: LoanPaymentType;

  @ApiPropertyOptional({
    description: 'Bank reference number for the disbursement transaction',
    example: 'IMPS123456',
  })
  @IsOptional()
  @IsString()
  disbursementReferenceNo?: string;
}
