import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import { Lead, MasterStatus, RejectionReason } from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';

/**
 * Ports `freshNotContactableCustomerSMS()` from `CronSMSController.php` — a
 * marketing re-engagement SMS to leads rejected in the last 5 days for
 * "NOT CONTACTABLE", excluding any mobile number that already has a lead in
 * an active/successful state elsewhere.
 *
 * **Scheduling note**: legacy's dedup guard used a generic +/-30 minute
 * `cron_scheduler_logs` window — but that exact same window is copy-pasted
 * verbatim across every method in `CronSMSController.php`, so it's boilerplate,
 * not a real per-job frequency signal. Since nothing here (or in legacy)
 * tracks "already notified this mobile", running it every 30 minutes would
 * resend the same promotional SMS to the same numbers all day — so this port
 * schedules it once daily instead.
 *
 * **Schema/seed gaps**:
 * - Legacy excluded `lead_data_source_id NOT IN(21,27)`. Neither legacy id
 *   exists in `seed-data/data-sources.json` — filter omitted here too.
 * - `integrations-api` now has a generic `POST /sms/send` endpoint
 *   (`SmsService.sendGenericSms`), but wiring a real send here needs the
 *   exact legacy message content (a bit.ly-linked "get an instant loan"
 *   promo) and, critically, the real Vapio DLT template id it was
 *   registered under — India's DLT regulations reject SMS sent under the
 *   wrong template id, so guessing one would be worse than not sending at
 *   all. Neither is available in the ported code or `old-php-files`. This
 *   job stays **log-only** — it finds eligible mobiles and logs the
 *   notification intent via `Logger` — until the real template id/copy is
 *   supplied (see `docs/TODO.md`).
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_NOT_CONTACTABLE_LEAD_SMS` is set to a real cron expression.
 */
@Injectable()
export class NotContactableLeadSmsService implements OnModuleInit {
  private readonly logger = new Logger(NotContactableLeadSmsService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  private static readonly LOOKBACK_DAYS = 5;
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

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(RejectionReason)
    private readonly rejectionReasonRepository: Repository<RejectionReason>,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'not-contactable-lead-sms',
      NotContactableLeadSmsService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ notified: number }> {
    const rejectStatus = await this.masterStatusRepository.findOne({
      where: { name: NotContactableLeadSmsService.REJECT_STATUS_NAME },
    });
    const notContactableReasons = await this.rejectionReasonRepository.find({
      where: {
        reason: NotContactableLeadSmsService.NOT_CONTACTABLE_REASON_TEXT,
      },
    });
    if (!rejectStatus || notContactableReasons.length === 0) {
      this.logger.error(
        "not-contactable-lead-sms: missing 'REJECT' master_statuses row or 'NOT CONTACTABLE' rejection_reasons row(s)",
      );
      return { notified: 0 };
    }

    const excludeStatuses = await this.masterStatusRepository.find({
      where: { name: In(NotContactableLeadSmsService.EXCLUDE_STATUS_NAMES) },
    });
    const excludedLeads =
      excludeStatuses.length > 0
        ? await this.leadRepository.find({
            where: {
              leadStatus: { id: In(excludeStatuses.map((s) => s.id)) },
            },
          })
        : [];
    const excludedMobiles = new Set(
      excludedLeads.map((lead) => lead.mobile?.trim()).filter(Boolean),
    );

    const lookbackDate = new Date();
    lookbackDate.setDate(
      lookbackDate.getDate() - NotContactableLeadSmsService.LOOKBACK_DAYS,
    );

    const candidates = await this.leadRepository.find({
      where: {
        leadEntryDate: MoreThanOrEqual(lookbackDate),
        leadStatus: { id: rejectStatus.id },
        rejectionReason: { id: In(notContactableReasons.map((r) => r.id)) },
      },
    });

    const distinctMobiles = new Set<string>();
    for (const lead of candidates) {
      const mobile = lead.mobile?.trim();
      if (!mobile || excludedMobiles.has(mobile)) continue;
      distinctMobiles.add(mobile);
    }

    if (distinctMobiles.size === 0) {
      this.logger.debug('not-contactable-lead-sms: no eligible mobiles today');
      return { notified: 0 };
    }

    this.logger.log(
      `not-contactable-lead-sms: would send re-engagement SMS to ${distinctMobiles.size} mobile(s) - ${Array.from(
        distinctMobiles,
      ).join(
        ', ',
      )} (log-only, real Vapio DLT template id/message copy not yet supplied)`,
    );
    return { notified: distinctMobiles.size };
  }
}
