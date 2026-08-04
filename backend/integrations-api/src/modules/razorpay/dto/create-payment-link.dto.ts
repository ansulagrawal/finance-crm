import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive } from 'class-validator';

export class CreatePaymentLinkDto {
  @ApiProperty({
    description:
      "Lead ID whose loan's outstanding amount this payment link is for",
    example: 1234,
  })
  @IsInt()
  leadId: number;

  /** Minimum partial amount the customer must pay for a partial payment to be accepted. */
  @ApiProperty({
    description:
      'Minimum partial amount the customer must pay for a partial payment to be accepted, in rupees',
    example: 500,
  })
  @IsNumber()
  @IsPositive()
  minPartialAmount: number;
}
