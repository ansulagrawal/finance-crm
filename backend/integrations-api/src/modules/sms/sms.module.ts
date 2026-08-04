import { HttpModule, HttpService } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CommonModule } from '../../common/common.module';
import { VapioSmsSender } from './senders/vapio-sms-sender';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { SMS_SENDER } from './sms.tokens';

/**
 * `SMS_PROVIDER` picks the sender, same factory-provider toggle pattern as
 * `StorageModule`'s local/S3 switch. Vapio (the legacy live path) is the only
 * implemented sender — every other SMS/WhatsApp vendor that appeared in
 * legacy is deliberately out of scope, see `docs/EXCLUDED.md`. Defaulting
 * unconditionally to Vapio keeps the switch statement ready for more
 * providers without a real alternative to test against yet.
 */
@Module({
  imports: [HttpModule, ConfigModule, CommonModule],
  controllers: [SmsController],
  providers: [
    {
      provide: SMS_SENDER,
      inject: [HttpService, ConfigService],
      // Only `vapio` is implemented today (no second provider has a real
      // legacy flow to port yet — see docs/COMPLETED.md). Add an
      // `SMS_PROVIDER`-driven switch here once a second one exists.
      useFactory: (httpService: HttpService, config: ConfigService) =>
        new VapioSmsSender(httpService, config),
    },
    SmsService,
  ],
})
export class SmsModule {}
