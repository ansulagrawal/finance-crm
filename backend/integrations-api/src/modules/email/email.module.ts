import { SESClient } from '@aws-sdk/client-ses';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { SendMailClient } from 'zeptomail';
import { CommonModule } from '../../common/common.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EMAIL_SENDER } from './email.tokens';
import { SesEmailSender } from './senders/ses-email-sender';
import { SmtpEmailSender } from './senders/smtp-email-sender';
import { ZeptoMailEmailSender } from './senders/zeptomail-email-sender';

/**
 * `EMAIL_PROVIDER` picks the send mechanism, same factory-provider toggle
 * pattern as `StorageModule`'s local/S3 switch:
 * - `smtp` (default) — generic SMTP via `nodemailer`, zero-config-safe.
 * - `zeptomail` — legacy's actual live production sender
 *   (`common_send_email()`'s `$active_id == 1` branch).
 * - `ses` — legacy's configured-but-never-called AWS SES path.
 */
@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [EmailController],
  providers: [
    {
      provide: EMAIL_SENDER,
      inject: [ConfigService],
      // Uses `.get()` with fallbacks, not `.getOrThrow()` — this factory
      // runs eagerly at app boot (Nest instantiates every provider on
      // startup), so throwing here would crash the whole service if
      // credentials aren't configured yet, unlike every other adapter's
      // getOrThrow calls, which only run lazily inside a request handler.
      // An unconfigured sender simply fails at actual send time, matching
      // the "won't function until real keys are supplied" architecture
      // decision instead of blocking the entire app's boot.
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('EMAIL_PROVIDER', 'smtp');

        if (provider === 'zeptomail') {
          return new ZeptoMailEmailSender(
            new SendMailClient({
              url: config.get<string>('ZEPTOMAIL_URL', 'api.zeptomail.in/'),
              token: config.get<string>('ZEPTOMAIL_TOKEN', ''),
            }),
          );
        }

        if (provider === 'ses') {
          return new SesEmailSender(
            new SESClient({
              region: config.get<string>('AWS_REGION', 'ap-south-1'),
            }),
          );
        }

        return new SmtpEmailSender(
          createTransport({
            // `localhost`, not a vendor's hostname (this defaulted to
            // `smtp.mailgun.org`) and not `getOrThrow` either — this factory
            // runs at boot, and `EMAIL_PROVIDER` defaults to `smtp`, so
            // throwing here would make an unset SMTP_HOST a hard boot
            // failure for every service that never sends email. A wrong
            // host must fail at send time, not at startup.
            host: config.get<string>('SMTP_HOST', 'localhost'),
            port: Number(config.get('SMTP_PORT', 587)),
            secure: config.get('SMTP_SECURE', 'false') === 'true',
            auth: {
              user: config.get<string>('SMTP_USER', ''),
              pass: config.get<string>('SMTP_PASS', ''),
            },
          }),
        );
      },
    },
    EmailService,
  ],
})
export class EmailModule {}
