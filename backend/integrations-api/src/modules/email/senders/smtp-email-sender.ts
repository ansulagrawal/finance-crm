import type { Transporter } from 'nodemailer';
import type { EmailSender, SendEmailParams } from './email-sender.interface';

/**
 * Default provider (`EMAIL_PROVIDER` unset or `smtp`). Ports CodeIgniter's
 * built-in email library relayed through an SMTP endpoint in legacy
 * (`common_send_email()`'s `$active_id == 0` branch, dead in legacy but kept
 * here as the safe zero-config default) via `nodemailer`'s SMTP transport.
 */
export class SmtpEmailSender implements EmailSender {
  constructor(private readonly transporter: Transporter) {}

  async send(params: SendEmailParams): Promise<void> {
    await this.transporter.sendMail(params);
  }
}
