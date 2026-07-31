import { IntegrationsApiClient } from '@finance-crm/common';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Delivers the password-reset OTP, via `integrations-api`'s
 * `/email/password-reset-otp` over the signed internal path
 * (`IntegrationsApiClient`) — the same route every other outbound vendor
 * call in this codebase takes.
 *
 * This was a log-only stub until now, which meant the whole forgot-password
 * flow issued an OTP nobody received. It blocked first sign-in for every
 * migrated legacy user, since none of them has a usable `passwordHash`.
 * Legacy's own `ForgetPasswordController::verifyUser()` never worked either
 * (it short-circuits with "Work in progress for the same." before sending),
 * so there was no working behaviour to port — only its intended email
 * design, which `password-reset-otp-email.template.ts` follows.
 *
 * **Never log the OTP.** It is the sole factor guarding a password reset,
 * and application logs reach far more people than a staff mailbox does.
 * `AUTH_OTP_DEBUG_LOG=true` prints it for local development only, where
 * there is usually no mail transport configured at all.
 *
 * A send failure does NOT throw. `AuthService.requestPasswordReset` returns
 * the same generic response whether or not the email exists, so surfacing a
 * transport error to the caller would leak account existence — and the OTP
 * row is already committed, so failing the request would be misleading
 * anyway. Failures are logged for an operator instead.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly integrationsApiClient: IntegrationsApiClient,
  ) {}

  async sendPasswordResetOtp(
    email: string,
    otp: string,
    context: { name: string; ipAddress?: string; userAgent?: string } = {
      name: '',
    },
  ): Promise<void> {
    if (
      this.configService.get<string>('AUTH_OTP_DEBUG_LOG', 'false') === 'true'
    ) {
      this.logger.warn(
        `AUTH_OTP_DEBUG_LOG is on (local development only) — OTP for ${email} is ${otp}`,
      );
    }

    try {
      await this.integrationsApiClient.post('/email/password-reset-otp', {
        email,
        name: context.name || email,
        otp,
        ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
        ...(context.userAgent ? { userAgent: context.userAgent } : {}),
      });
      this.logger.log(`Password reset OTP email dispatched for ${email}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to dispatch password reset OTP email for ${email}: ${message}`,
      );
    }
  }
}
