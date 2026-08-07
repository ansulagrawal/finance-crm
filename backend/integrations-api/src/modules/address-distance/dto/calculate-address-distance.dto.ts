import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class CalculateAddressDistanceDto {
  @ApiProperty()
  @IsInt()
  leadId: number;
}
