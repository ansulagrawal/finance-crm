import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DigitapClientService } from './digitap-client.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [DigitapClientService],
  exports: [DigitapClientService],
})
export class DigitapModule {}
