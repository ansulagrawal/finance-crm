import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString } from 'class-validator';

export class VerifyPanDto {
  @ApiProperty({
    description: 'Lead ID this PAN verification belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'PAN number to verify', example: 'ABCDE1234F' })
  @IsString()
  pan: string;
}
