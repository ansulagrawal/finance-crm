import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddressDistanceService } from './address-distance.service';
import { CalculateAddressDistanceDto } from './dto/calculate-address-distance.dto';

@ApiTags('Address Distance (Google Maps)')
@ApiCookieAuth()
@Controller('address-distance')
export class AddressDistanceController {
  constructor(
    private readonly addressDistanceService: AddressDistanceService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      "Compute the distance between a lead's Aadhaar address and their live location, and store it on LeadCustomer.residenceDistanceKm",
  })
  calculate(@Body() dto: CalculateAddressDistanceDto) {
    return this.addressDistanceService.calculate(dto);
  }
}
