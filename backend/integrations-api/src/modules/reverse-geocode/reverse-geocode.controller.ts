import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReverseGeocodeDto } from './dto/reverse-geocode.dto';
import { ReverseGeocodeService } from './reverse-geocode.service';

@ApiTags('Reverse Geocode')
@ApiCookieAuth()
@Controller('reverse-geocode')
export class ReverseGeocodeController {
  constructor(private readonly reverseGeocodeService: ReverseGeocodeService) {}

  @Post()
  @ApiOperation({
    summary:
      'Resolve a device lat/long fix to a human-readable address via Signzy reverse geocoding',
  })
  @ApiResponse({ status: 201, description: 'Reverse geocode result logged' })
  resolve(@Body() dto: ReverseGeocodeDto) {
    return this.reverseGeocodeService.resolve(dto);
  }
}
