import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsString } from 'class-validator';

export class CreateVideoKycSessionDto {
  @ApiProperty({
    description: 'Lead ID this video KYC session belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Full name of the customer, spoken in the consent script',
  })
  @IsString()
  customerFullName: string;

  @ApiProperty({
    description: 'Loan amount, spoken in the consent script',
    example: 25000,
  })
  @IsNumber()
  loanAmount: number;

  @ApiProperty({
    description: 'Repayment due date, spoken in the consent script',
  })
  @IsString()
  repaymentDate: string;

  @ApiProperty({
    description: 'Total repayment amount, spoken in the consent script',
    example: 27500,
  })
  @IsNumber()
  repaymentAmount: number;
}
