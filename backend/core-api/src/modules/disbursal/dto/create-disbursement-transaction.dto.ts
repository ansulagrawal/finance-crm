import { DisbursementTransactionStatus } from '@finance-crm/database';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsString, MinLength } from 'class-validator';

export class CreateDisbursementTransactionDto {
  @ApiProperty({
    description: 'Disbursement bank account ID this transaction posted to',
    example: 1,
  })
  @IsInt()
  disbursementBankId: number;

  @IsString()
  @MinLength(1)
  referenceNo: string;

  @IsEnum(DisbursementTransactionStatus)
  status: DisbursementTransactionStatus;
}
