import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { GoogleMapsModule } from '../google-maps/google-maps.module';
import { AddressDistanceController } from './address-distance.controller';
import { AddressDistanceService } from './address-distance.service';

@Module({
  imports: [CommonModule, GoogleMapsModule],
  controllers: [AddressDistanceController],
  providers: [AddressDistanceService],
})
export class AddressDistanceModule {}
