import type { Client } from '@sendgrid/client';
import type {
  EmailValidationResult,
  EmailValidator,
} from './email-validator.interface';

/**
 * SendGrid email validation — ports `sendgrid_email_validation_api`
 * (`payday_email_verification_api_helper.php`). Uses the official
 * `@sendgrid/client` SDK (generic REST client, same one `@sendgrid/mail`
 * wraps) rather than raw HTTP, per the "use the official SDK when one
 * exists" rule. Real endpoint: `POST /v3/validations/email`.
 */
export class SendGridEmailValidator implements EmailValidator {
  constructor(private readonly client: Client) {}

  async validate(email: string): Promise<EmailValidationResult> {
    const requestJson = JSON.stringify({ email });

    try {
      const [, body] = await this.client.request({
        method: 'POST',
        url: '/v3/validations/email',
        body: { email },
      });
      const result = (body as { result?: { verdict?: string } })?.result;

      return {
        isValid: result?.verdict === 'Valid',
        verdict: result?.verdict ?? null,
        requestJson,
        responseJson: JSON.stringify(body),
        errorMessage: null,
      };
    } catch (error) {
      const sgError = error as {
        response?: { body: unknown };
        message?: string;
      };
      return {
        isValid: false,
        verdict: null,
        requestJson,
        responseJson: sgError.response
          ? JSON.stringify(sgError.response.body)
          : '',
        errorMessage: sgError.message ?? 'SendGrid email validation failed',
      };
    }
  }
}
