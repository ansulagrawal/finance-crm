import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressLatLongService } from './address-lat-long.service';
import { GetAddressLatLongDto } from './dto/get-address-lat-long.dto';

@ApiTags('Address Lat/Long (Digitap)')
@ApiCookieAuth()
@Controller('address-lat-long')
export class AddressLatLongController {
  constructor(private readonly addressLatLongService: AddressLatLongService) {}

  @Post()
  @ApiOperation({
    summary: 'Geocode a free-text address to lat/long via Digitap',
  })
  getLatLong(@Body() dto: GetAddressLatLongDto) {
    return this.addressLatLongService.getLatLong(dto);
  }
}
