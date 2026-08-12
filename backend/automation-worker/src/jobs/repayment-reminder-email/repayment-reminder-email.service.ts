import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  Loan,
  MasterStatus,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  renderRepaymentReminderHtml,
  renderRepaymentReminderSubject,
} from '../../templates/email/repayment-reminder-email.template';

export interface RepaymentReminderBucketConfig {
  cronName: string;
  /** Days before the repayment date this reminder fires (0 = due today). */
  daysBefore: number;
}

/**
 * Ports `Reminders::emailPrepayment($days)` (`CronJobs/Reminders.php`) —
 * confirmed live via the real production crontab (`emailPrepayment 1`..`5`,
 * `9 * * * *`, no day-0 entry). Its query
 * (`SMSModel::getAllRepaymentReminderSMS(true, $days)`) resolves
 * `$current_date`/`$reminder_date` to the *same* value (`today + $days`)
 * when called with `reminder_flag=true`, so the underlying SQL window is a
 * single exact day, not a cumulative range — this port's day-exact bucket
 * matching was already correct, confirmed against the real query rather than
 * inferred.
 *
 * Earlier drafts of this port were based on `CronEmailerController.php`'s
 * near-identical `repaymentReminder5Day()`..`repaymentReminder0Day()` (same
 * content, same query shape) — that file is not what's actually scheduled;
 * `Reminders.php` is. The one real behavioral difference: legacy's crontab
 * never calls `emailPrepayment(0)`, so no day-0 reminder is sent in
 * production — this port only schedules buckets 5..1.
 *
 * `lead_data_source_id NOT IN(21,27)` is omitted (seed-data gap, neither
 * legacy id exists in `seed-data/data-sources.json`).
 *
 * Sends via `integrations-api`'s generic `POST /email/send`. Legacy's
 * brand-logo/day-count images and social icons are dropped, and the
 * phone/collection-email contact line is dropped rather than fabricated
 * (see `repayment-reminder-email.template.ts`'s doc comment).
 */
@Injectable()
export class RepaymentReminderEmailService implements OnModuleInit {
  private readonly logger = new Logger(RepaymentReminderEmailService.name);

  static readonly BUCKETS: RepaymentReminderBucketConfig[] = [
    5, 4, 3, 2, 1,
  ].map((daysBefore) => ({
    cronName: `repayment-reminder-email-${daysBefore}-day`,
    daysBefore,
  }));

  private static readonly CRON_EXPRESSION = '0 9 * * *';
  private static readonly DISBURSED_STATUS_NAMES = [
    'DISBURSED',
    'PART-PAYMENT',
  ];
  /** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
  private static readonly EMAIL_TYPE_ID = 7;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    for (const bucket of RepaymentReminderEmailService.BUCKETS) {
      this.jobRunner.schedule(
        bucket.cronName,
        RepaymentReminderEmailService.CRON_EXPRESSION,
        async () => {
          await this.runBucket(bucket);
        },
      );
    }
  }

  async runBucket(
    bucket: RepaymentReminderBucketConfig,
  ): Promise<{ found: number; notified: number; failed: number }> {
    const disbursedStatuses = await this.masterStatusRepository.find({
      where: { name: In(RepaymentReminderEmailService.DISBURSED_STATUS_NAMES) },
    });
    if (disbursedStatuses.length === 0) {
      this.logger.warn(
        `${bucket.cronName}: no master_statuses rows for DISBURSED/PART-PAYMENT`,
      );
      return { found: 0, notified: 0, failed: 0 };
    }

    const targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);
    targetDate.setDate(targetDate.getDate() + bucket.daysBefore);
    const endOfTargetDate = new Date(targetDate);
    endOfTargetDate.setHours(23, 59, 59, 999);

    const cams = await this.camRepository.find({
      where: {
        repaymentDate: Between(targetDate, endOfTargetDate),
        lead: { leadStatus: { id: In(disbursedStatuses.map((s) => s.id)) } },
      },
      relations: { lead: true },
    });
    if (cams.length === 0) {
      this.logger.debug(`${bucket.cronName}: no loans due in this bucket`);
      return { found: 0, notified: 0, failed: 0 };
    }

    const pendingCollections = await this.collectionRepository.find({
      where: {
        lead: { id: In(cams.map((cam) => cam.lead.id)) },
        verificationStatus: CollectionVerificationStatus.PENDING,
        isDeleted: false,
      },
    });
    const excludedLeadIds = new Set(
      pendingCollections.map((collection) => collection.lead.id),
    );
    const eligibleCams = cams.filter(
      (cam) => !excludedLeadIds.has(cam.lead.id),
    );

    if (eligibleCams.length === 0) {
      this.logger.debug(
        `${bucket.cronName}: all matching loans already have a pending collection entry`,
      );
      return { found: 0, notified: 0, failed: 0 };
    }

    const loans = await this.loanRepository.find({
      where: { lead: { id: In(eligibleCams.map((cam) => cam.lead.id)) } },
      relations: { lead: true },
    });
    const loanByLeadId = new Map(loans.map((loan) => [loan.lead.id, loan]));

    const brandName = this.configService.get<string>('BRAND_NAME', 'Finance CRM');
    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    const repaymentLinkUrl = `${lmsUrl}/repay-now`;

    let notified = 0;
    let failed = 0;
    for (const cam of eligibleCams) {
      const loan = loanByLeadId.get(cam.lead.id);
      const email = cam.lead.email?.trim();
      if (!loan?.loanNumber || !email) continue;
      const loanNumber = loan.loanNumber;

      const repaymentDate = cam.repaymentDate
        ? new Date(cam.repaymentDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '';

      try {
        await this.integrationsApiClient.post('/email/send', {
          leadId: cam.lead.id,
          email,
          subject: renderRepaymentReminderSubject(
            bucket.daysBefore,
            loanNumber,
          ),
          html: renderRepaymentReminderHtml({
            custFullName: cam.lead.firstName,
            loanNo: loanNumber,
            repaymentAmount: Number(cam.repaymentAmount).toLocaleString(
              'en-IN',
            ),
            repaymentDate,
            daysBefore: bucket.daysBefore,
            brandName,
            repaymentLinkUrl,
          }),
          typeId: RepaymentReminderEmailService.EMAIL_TYPE_ID,
        });
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `${bucket.cronName}: failed to notify lead ${cam.lead.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `${bucket.cronName}: found=${eligibleCams.length} notified=${notified} failed=${failed}`,
    );
    return { found: eligibleCams.length, notified, failed };
  }
}
