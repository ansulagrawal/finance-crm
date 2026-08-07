import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsLatitude, IsLongitude } from 'class-validator';

export class ReverseGeocodeDto {
  @ApiProperty({
    description: 'Lead ID this reverse-geocode lookup belongs to',
    example: 1234,
  })
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'Device latitude fix', example: '19.076090' })
  @IsLatitude()
  latitude: string;

  @ApiProperty({ description: 'Device longitude fix', example: '72.877426' })
  @IsLongitude()
  longitude: string;
}
