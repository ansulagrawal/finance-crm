import { findOrFail } from '@finance-crm/common';
import { ApiCallStatus, EmailLog, Lead } from '@finance-crm/database';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { renderPasswordResetOtpEmailHtml } from '../../templates/email/password-reset-otp-email.template';
import { renderThankYouEmailHtml } from '../../templates/email/thank-you-email.template';
import { SendGenericEmailDto } from './dto/send-generic-email.dto';
import { SendPasswordResetOtpEmailDto } from './dto/send-password-reset-otp-email.dto';
import { SendThankYouEmailDto } from './dto/send-thank-you-email.dto';
import { EMAIL_SENDER } from './email.tokens';
import type { EmailSender } from './senders/email-sender.interface';

const THANK_YOU_EMAIL_TYPE_ID = 1;

/** `api_email_logs.email_type_id` is a free-form id each caller picks for
 * itself (legacy convention, no shared enum) — 2 for the staff
 * password-reset OTP, distinct from the thank-you email's 1. */
const PASSWORD_RESET_OTP_EMAIL_TYPE_ID = 2;

@Injectable()
export class EmailService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(EmailLog)
    private readonly emailLogRepository: Repository<EmailLog>,
    @Inject(EMAIL_SENDER)
    private readonly emailSender: EmailSender,
    private readonly configService: ConfigService,
  ) {}

  /** Ports `common_lead_thank_you_email()`. Send mechanism is pluggable via
   * `EMAIL_PROVIDER` (`smtp` default, `zeptomail`, `ses` — see EmailModule). */
  async sendThankYouEmail(dto: SendThankYouEmailDto): Promise<EmailLog> {
    const html = renderThankYouEmailHtml(dto.name, dto.referenceNo);
    return this.send({
      leadId: dto.leadId,
      email: dto.email,
      subject: 'Thank You. - salaryontime',
      html,
      typeId: THANK_YOU_EMAIL_TYPE_ID,
    });
  }

  /**
   * Staff password-reset OTP. `core-api`'s `NotificationsService` is the only
   * caller — it owns the OTP and the request context, this owns the template
   * and the transport (same split as `sendThankYouEmail`).
   *
   * No `leadId`: a staff reset has no lead, and the log column is nullable.
   * The rendered HTML contains a live OTP, so unlike every other sender here
   * the body is deliberately NOT written to `email_content` — see `send()`.
   */
  /**
   * Absolute URL of the logo this service serves itself (see `main.ts`'s
   * `useStaticAssets`). Built from `PUBLIC_API_URL` — the externally reachable
   * origin — not from `INTEGRATIONS_API_URL`, which is the in-cluster address
   * (`http://integrations-api:3001`) and unreachable from a mail client.
   * Unset returns '', and the template falls back to a text wordmark rather
   * than a broken image.
   */
  private emailLogoUrl(): string {
    const base = this.configService.get<string>('PUBLIC_API_URL', '');
    return base
      ? `${base.replace(/\/+$/, '')}/api/v1/integrations/assets/logo-email.png`
      : '';
  }

  async sendPasswordResetOtpEmail(
    dto: SendPasswordResetOtpEmailDto,
  ): Promise<EmailLog> {
    const html = renderPasswordResetOtpEmailHtml({
      name: dto.name,
      email: dto.email,
      otp: dto.otp,
      crmUrl: this.configService.get<string>('LMS_URL', ''),
      supportEmail: this.configService.get<string>(
        'TECH_EMAIL',
        'tech@financecrm.com',
      ),
      ipAddress: dto.ipAddress ?? null,
      userAgent: dto.userAgent ?? null,
      requestedAt: new Date().toISOString(),
      logoUrl: this.emailLogoUrl(),
    });
    return this.send({
      email: dto.email,
      subject: 'Password reset OTP',
      html,
      typeId: PASSWORD_RESET_OTP_EMAIL_TYPE_ID,
      // The OTP is a live credential. Persisting the body would put it in the
      // database in plaintext, recreating exactly the leak that removing it
      // from the application log closed (core-api Task #142).
      logContent: false,
    });
  }

  /**
   * General-purpose send, for callers (`automation-worker`'s cron jobs)
   * that compose their own subject/HTML rather than needing a dedicated
   * `integrations-api` template — this is the "generic transactional
   * email endpoint" `docs/TODO.md` flagged as missing, unblocking every
   * automation-worker email job that was previously log-only for lack of
   * anywhere to actually send to.
   */
  async sendGenericEmail(dto: SendGenericEmailDto): Promise<EmailLog> {
    return this.send(dto);
  }

  private async send(params: {
    leadId?: number;
    email: string;
    subject: string;
    html: string;
    typeId: number;
    cc?: string;
    /** Defaults to true. Set false for a body containing a live credential —
     * `email_content` is plaintext in the database. */
    logContent?: boolean;
  }): Promise<EmailLog> {
    // Lead is optional: `api_email_logs.email_lead_id` is nullable, and
    // legacy's `common_send_email()` inserts that row with no lead. Staff
    // mail (a password-reset OTP) genuinely has none. Still resolved via
    // `findOrFail` when supplied, so a bad id is a 404 rather than a
    // silently lead-less log row.
    const lead = params.leadId
      ? await findOrFail(this.leadRepository, params.leadId, 'Lead')
      : null;
    const fromAddress = this.configService.get<string>(
      'EMAIL_FROM',
      'no-reply@financecrm.co.in',
    );

    let status = ApiCallStatus.API_ERROR;
    let errorMessage: string | null = null;

    try {
      await this.emailSender.send({
        from: fromAddress,
        to: params.email,
        subject: params.subject,
        html: params.html,
        ...(params.cc ? { cc: params.cc } : {}),
      });
      status = ApiCallStatus.SUCCESS;
    } catch (error) {
      const err = error as { message?: string };
      errorMessage = err.message ?? 'Email send failed';
      status = ApiCallStatus.NETWORK_ERROR;
    }

    const log = this.emailLogRepository.create({
      lead,
      typeId: params.typeId,
      emailAddress: params.email,
      // EmailLog (api_email_logs) has no separate subject column, only
      // content (the HTML body) — unlike the pre-rewrite entity, legacy
      // never logged the subject line at all.
      content:
        params.logContent === false
          ? '[body not logged — contains a one-time credential]'
          : params.html,
      apiStatus: status,
      errors: errorMessage,
      // No requestedAt/respondedAt pair on this entity either, only
      // createdAt (NOT NULL, no DB default).
      createdAt: new Date(),
    });
    return this.emailLogRepository.save(log);
  }
}
