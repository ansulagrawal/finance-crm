import { AddressType } from '@finance-crm/database';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';

export class GetAddressLatLongDto {
  @ApiProperty()
  @IsInt()
  leadId: number;

  @ApiProperty({ description: 'Free-text address to geocode' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: '1 = current address, 2 = Aadhaar/eKYC address',
    enum: AddressType,
  })
  @IsEnum(AddressType)
  addressType: AddressType;
}
