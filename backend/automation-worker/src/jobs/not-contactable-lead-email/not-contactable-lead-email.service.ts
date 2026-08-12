import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import { Lead, MasterStatus, RejectionReason } from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  renderNotContactableHtml,
  renderNotContactableSubject,
} from '../../templates/email/not-contactable-lead-email.template';

/**
 * Ports `freshNotContactableCustomerEmailer()` from
 * `CronEmailerController.php` — the email counterpart to CronSMS's
 * `NotContactableLeadSmsService` (same "NOT CONTACTABLE" rejected-lead
 * segment, but a 30-day lookback window instead of SMS's 5-day one, and
 * targeting `email` instead of `mobile`).
 *
 * Scheduling and schema/seed-gap reasoning are identical to the SMS sibling
 * (see its doc comment and TODO.md Phase 6 #58): the legacy 30-minute dedup
 * guard is boilerplate, not a real cadence signal, and resending this every
 * 30 minutes with no per-recipient dedup would spam the same addresses all
 * day, so this runs once daily. `lead_data_source_id NOT IN(21,27)` is
 * omitted (seed-data gap, neither legacy id exists in
 * `seed-data/data-sources.json`).
 *
 * Sends via `integrations-api`'s generic `POST /email/send`. Legacy's
 * marketing images (banner, rupee icon, apply button, app-store/social
 * icons) have no configured asset URLs anywhere in this backend — ported
 * with placeholder image URLs (see `not-contactable-lead-email.template.ts`)
 * until real ones are configured.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_NOT_CONTACTABLE_LEAD_EMAIL` is set to a real cron expression.
 */
@Injectable()
export class NotContactableLeadEmailService implements OnModuleInit {
  private readonly logger = new Logger(NotContactableLeadEmailService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  private static readonly LOOKBACK_DAYS = 30;
  private static readonly REJECT_STATUS_NAME = 'REJECT';
  private static readonly NOT_CONTACTABLE_REASON_TEXT = 'NOT CONTACTABLE';
  private static readonly EXCLUDE_STATUS_NAMES = [
    'DISBURSED',
    'SETTLED',
    'WRITEOFF',
    'PART-PAYMENT',
    'LEAD-NEW',
    'LEAD-INPROCESS',
  ];
  /** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
  private static readonly EMAIL_TYPE_ID = 3;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(RejectionReason)
    private readonly rejectionReasonRepository: Repository<RejectionReason>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'not-contactable-lead-email',
      NotContactableLeadEmailService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ notified: number; failed: number }> {
    const rejectStatus = await this.masterStatusRepository.findOne({
      where: { name: NotContactableLeadEmailService.REJECT_STATUS_NAME },
    });
    const notContactableReasons = await this.rejectionReasonRepository.find({
      where: {
        reason: NotContactableLeadEmailService.NOT_CONTACTABLE_REASON_TEXT,
      },
    });
    if (!rejectStatus || notContactableReasons.length === 0) {
      this.logger.error(
        "not-contactable-lead-email: missing 'REJECT' master_statuses row or 'NOT CONTACTABLE' rejection_reasons row(s)",
      );
      return { notified: 0, failed: 0 };
    }

    const excludeStatuses = await this.masterStatusRepository.find({
      where: {
        name: In(NotContactableLeadEmailService.EXCLUDE_STATUS_NAMES),
      },
    });
    const excludedLeads =
      excludeStatuses.length > 0
        ? await this.leadRepository.find({
            where: {
              leadStatus: { id: In(excludeStatuses.map((s) => s.id)) },
            },
          })
        : [];
    const excludedEmails = new Set(
      excludedLeads
        .map((lead) => lead.email?.trim().toLowerCase())
        .filter(Boolean),
    );

    const lookbackDate = new Date();
    lookbackDate.setDate(
      lookbackDate.getDate() - NotContactableLeadEmailService.LOOKBACK_DAYS,
    );

    const candidates = await this.leadRepository.find({
      where: {
        leadEntryDate: MoreThanOrEqual(lookbackDate),
        leadStatus: { id: rejectStatus.id },
        rejectionReason: { id: In(notContactableReasons.map((r) => r.id)) },
      },
    });

    const recipients: { leadId: number; email: string }[] = [];
    const seenEmails = new Set<string>();
    for (const lead of candidates) {
      const email = lead.email?.trim().toLowerCase();
      if (!email || excludedEmails.has(email) || seenEmails.has(email))
        continue;
      seenEmails.add(email);
      recipients.push({ leadId: lead.id, email });
    }

    if (recipients.length === 0) {
      this.logger.debug('not-contactable-lead-email: no eligible emails today');
      return { notified: 0, failed: 0 };
    }

    const brandName = this.configService.get<string>('BRAND_NAME', 'Finance CRM');
    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    const fromEmail = this.configService.get<string>(
      'EMAIL_FROM',
      'no-reply@financecrm.co.in',
    );
    const campaignName = `NCCUSTEMAIL${new Date().getFullYear()}`;
    const applyNowUrl = `${lmsUrl}/apply-now?utm_source=EMAIL&utm_campaign=${campaignName}`;
    const subject = renderNotContactableSubject(brandName);
    const html = renderNotContactableHtml(
      brandName,
      applyNowUrl,
      lmsUrl,
      fromEmail,
    );

    let notified = 0;
    let failed = 0;
    for (const recipient of recipients) {
      try {
        await this.integrationsApiClient.post('/email/send', {
          leadId: recipient.leadId,
          email: recipient.email,
          subject,
          html,
          typeId: NotContactableLeadEmailService.EMAIL_TYPE_ID,
        });
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `not-contactable-lead-email: failed to notify lead ${recipient.leadId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `not-contactable-lead-email: notified=${notified} failed=${failed}`,
    );
    return { notified, failed };
  }
}
