import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsString } from 'class-validator';

export class InitiateEnachTransactionDto {
  @ApiProperty({ description: 'Loan number this eNACH transaction belongs to' })
  @IsString()
  loanNumber: string;

  @ApiProperty({ description: 'Registered eNACH mandate registration number' })
  @IsString()
  mandateRegistrationNo: string;

  @ApiProperty({
    description: 'Amount to collect via the mandate, in rupees',
    example: 5000,
  })
  @IsInt()
  requestedAmount: number;

  @ApiProperty({
    description: 'ISO 8601 end date by which the transaction must complete',
  })
  @IsISO8601()
  requestedEndDate: string;
}
