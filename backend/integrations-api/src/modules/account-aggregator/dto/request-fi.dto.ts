import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RequestFiDto {
  @ApiProperty({
    description: 'Start of the bank-statement date range (ISO date)',
    example: '2026-01-01',
  })
  @IsDateString()
  fromDate: string;

  @ApiProperty({
    description: 'End of the bank-statement date range (ISO date)',
    example: '2026-06-30',
  })
  @IsDateString()
  toDate: string;
}
