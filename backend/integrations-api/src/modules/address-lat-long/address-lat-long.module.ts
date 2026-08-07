import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { DigitapModule } from '../digitap/digitap.module';
import { AddressLatLongController } from './address-lat-long.controller';
import { AddressLatLongService } from './address-lat-long.service';

@Module({
  imports: [CommonModule, DigitapModule],
  controllers: [AddressLatLongController],
  providers: [AddressLatLongService],
})
export class AddressLatLongModule {}
