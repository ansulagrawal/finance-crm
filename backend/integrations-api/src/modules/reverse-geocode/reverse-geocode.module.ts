import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { GoogleMapsModule } from '../google-maps/google-maps.module';
import { SignzyModule } from '../signzy/signzy.module';
import { ReverseGeocodeController } from './reverse-geocode.controller';
import { ReverseGeocodeService } from './reverse-geocode.service';

@Module({
  imports: [CommonModule, SignzyModule, GoogleMapsModule],
  controllers: [ReverseGeocodeController],
  providers: [ReverseGeocodeService],
})
export class ReverseGeocodeModule {}
