import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive } from 'class-validator';

export class CreateQrRequestDto {
  @ApiProperty({
    description: 'Lead ID whose disbursed loan this collection QR is for',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description: 'Amount to collect via the UPI QR, in rupees',
    example: 1000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
