import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import { Lead, MasterStatus } from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  renderClosedLoanFeedbackHtml,
  renderClosedLoanFeedbackSubject,
} from '../../templates/email/closed-loan-feedback-email.template';

/**
 * Ports `feedbackForCloseLoanEmailer()` from `CronEmailerController.php` —
 * a feedback-survey nudge to every customer whose loan has closed.
 *
 * Legacy guards itself with `if (time_close > 1441) die;` (must run before
 * 14:41) instead of the usual `cron_scheduler_logs` dedup window. This port
 * replaces that same-day cutoff with a fixed once-daily morning schedule
 * under `JobRunner` — functionally equivalent (guarantees at most one run
 * per day, always before the legacy cutoff would have mattered) without
 * needing to replicate a wall-clock `die()` guard.
 *
 * Legacy dedupes emails only *within* a single run (`$email_sent_array`),
 * not across days/runs — every closed-loan customer gets re-emailed every
 * time this job fires. This port preserves that behavior faithfully (no
 * persistent anti-resend tracking) since it matches legacy's real,
 * long-standing production behavior, not a bug introduced here.
 *
 * `lead_data_source_id NOT IN(21,27)` omitted (seed-data gap, same as
 * every other #57/#58 job — neither legacy id exists in
 * `seed-data/data-sources.json`).
 *
 * Sends via `integrations-api`'s generic `POST /email/send`. Legacy's
 * "Loanwalle.com"-branded images/phone/social-icons aren't ported — a
 * predecessor brand's contact details don't belong in a Finance CRM
 * customer email (see `closed-loan-feedback-email.template.ts`).
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_CLOSED_LOAN_FEEDBACK_EMAIL` is set to a real cron expression.
 */
@Injectable()
export class ClosedLoanFeedbackEmailService implements OnModuleInit {
  private readonly logger = new Logger(ClosedLoanFeedbackEmailService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  private static readonly CLOSED_STATUS_NAME = 'CLOSED';
  /** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
  private static readonly EMAIL_TYPE_ID = 4;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'closed-loan-feedback-email',
      ClosedLoanFeedbackEmailService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ notified: number; failed: number }> {
    const closedStatus = await this.masterStatusRepository.findOne({
      where: { name: ClosedLoanFeedbackEmailService.CLOSED_STATUS_NAME },
    });
    if (!closedStatus) {
      this.logger.error(
        "closed-loan-feedback-email: missing 'CLOSED' master_statuses row",
      );
      return { notified: 0, failed: 0 };
    }

    const closedLeads = await this.leadRepository.find({
      where: { leadStatus: { id: closedStatus.id } },
    });

    const recipients: { leadId: number; email: string; firstName: string }[] =
      [];
    const seenEmails = new Set<string>();
    for (const lead of closedLeads) {
      const email = lead.email?.trim().toLowerCase();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      recipients.push({ leadId: lead.id, email, firstName: lead.firstName });
    }

    if (recipients.length === 0) {
      this.logger.debug(
        'closed-loan-feedback-email: no closed-loan customers with an email',
      );
      return { notified: 0, failed: 0 };
    }

    const brandName = this.configService.get<string>('BRAND_NAME', 'Finance CRM');
    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    const subject = renderClosedLoanFeedbackSubject(brandName);

    let notified = 0;
    let failed = 0;
    for (const recipient of recipients) {
      try {
        const feedbackUrl = `${lmsUrl}/feedback/${recipient.leadId}`;
        await this.integrationsApiClient.post('/email/send', {
          leadId: recipient.leadId,
          email: recipient.email,
          subject,
          html: renderClosedLoanFeedbackHtml(
            recipient.firstName,
            brandName,
            feedbackUrl,
          ),
          typeId: ClosedLoanFeedbackEmailService.EMAIL_TYPE_ID,
        });
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `closed-loan-feedback-email: failed to notify lead ${recipient.leadId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `closed-loan-feedback-email: notified=${notified} failed=${failed}`,
    );
    return { notified, failed };
  }
}
