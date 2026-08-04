import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { EmailSender, SendEmailParams } from './email-sender.interface';

/**
 * Ports legacy's `AWS`/`SES_API` integration config
 * (`integration_config.php`, case `"AWS"`) — configured with live credentials
 * but never actually wired to a caller in legacy (`functions.inc.php:654`
 * has the lookup commented out), so this has no legacy call-shape to match
 * exactly. Uses AWS's official SES SDK, same pattern as `S3StorageAdapter`.
 */
export class SesEmailSender implements EmailSender {
  constructor(private readonly client: SESClient) {}

  async send(params: SendEmailParams): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        Source: params.from,
        Destination: {
          ToAddresses: [params.to],
          ...(params.cc ? { CcAddresses: [params.cc] } : {}),
        },
        Message: {
          Subject: { Data: params.subject },
          Body: { Html: { Data: params.html } },
        },
      }),
    );
  }
}
