import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client } from '@sendgrid/client';
import { CommonModule } from '../../common/common.module';
import { EmailValidationController } from './email-validation.controller';
import { EmailValidationService } from './email-validation.service';
import { EMAIL_VALIDATOR } from './email-validation.tokens';
import { SendGridEmailValidator } from './validators/sendgrid-email-validator';

/**
 * Pluggable email-validation API, `EMAIL_VALIDATOR` token, same
 * factory-provider pattern as `EmailModule`/`SmsModule`. Only SendGrid is
 * implemented for now — no env-driven switch since there's only one real
 * provider, matching `SmsModule`'s precedent (a switch will be added once
 * a second provider has a real flow to port).
 */
@Module({
  imports: [ConfigModule, CommonModule],
  controllers: [EmailValidationController],
  providers: [
    {
      provide: EMAIL_VALIDATOR,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const client = new Client();
        client.setApiKey(config.get<string>('SENDGRID_API_KEY', ''));
        return new SendGridEmailValidator(client);
      },
    },
    EmailValidationService,
  ],
})
export class EmailValidationModule {}
