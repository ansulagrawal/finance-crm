import { SendMailClient } from 'zeptomail';
import type { EmailSender, SendEmailParams } from './email-sender.interface';

/**
 * Ports `common_send_email()`'s live `$active_id == 1` branch
 * (`components/includes/functions.inc.php`) — legacy's actual production
 * send path, called directly via curl against `api.zeptomail.in/v1.1/email`
 * with a `Zoho-enczapikey` token. Uses ZeptoMail's official SDK instead of
 * a raw HTTP call; request shape (`from.address`, `to[].email_address.address`,
 * `subject`, `htmlbody`) matches the legacy payload.
 */
export class ZeptoMailEmailSender implements EmailSender {
  constructor(private readonly client: SendMailClient) {}

  async send(params: SendEmailParams): Promise<void> {
    await this.client.sendMail({
      from: { address: params.from },
      to: [{ email_address: { address: params.to } }],
      ...(params.cc ? { cc: [{ email_address: { address: params.cc } }] } : {}),
      subject: params.subject,
      htmlbody: params.html,
    });
  }
}
