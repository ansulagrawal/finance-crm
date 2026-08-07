import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleMapsClientService } from './google-maps-client.service';

@Module({
  imports: [ConfigModule],
  providers: [GoogleMapsClientService],
  exports: [GoogleMapsClientService],
})
export class GoogleMapsModule {}
