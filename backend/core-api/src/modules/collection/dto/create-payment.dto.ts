import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Loan number this payment is against (Collection.loanNumber)',
    example: 'LN0000123',
  })
  @IsString()
  loanNumber: string;

  @ApiProperty({ description: 'Amount received', example: 5000 })
  @IsNumber()
  receivedAmount: number;

  @ApiPropertyOptional({ description: 'Payment mode lookup ID', example: 1 })
  @IsOptional()
  @IsInt()
  paymentModeId?: number;

  @ApiProperty({
    description:
      'Repayment type — a MasterStatus id, stored as a plain varchar column ' +
      '(legacy has no real FK here)',
    example: 1,
  })
  @IsInt()
  repaymentTypeId: number;

  @ApiPropertyOptional({ description: 'Discount amount applied', example: 0 })
  @IsOptional()
  @IsNumber()
  discount?: number;

  @ApiPropertyOptional({ description: 'Refund amount', example: 0 })
  @IsOptional()
  @IsNumber()
  refund?: number;

  @ApiProperty({
    description: 'Payment reference/transaction number',
    example: 'TXN123456',
  })
  @IsString()
  referenceNo: string;

  @ApiPropertyOptional({
    description: 'Date the payment was received (ISO date string)',
    example: '2026-07-26',
  })
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiPropertyOptional({ description: 'Free-text remarks' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
