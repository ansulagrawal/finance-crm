import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class VerifyDualPanDto {
  @ApiProperty({
    description:
      'Lead ID whose customer name the alternate PAN is checked against',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({
    description:
      "Alternate/other PAN number to fraud-check against this lead's name",
    example: 'ABCDE1234F',
  })
  @IsString()
  pan: string;
}
