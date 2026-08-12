import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  CreditAnalysisMemo,
  Loan,
  LoanRecoveryStage,
  MasterStatus,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, Repository } from 'typeorm';

export interface DefaulterBucketConfig {
  cronName: string;
  label: string;
  /** Days-past-due lower bound (inclusive). */
  dpdFrom: number;
  /** Days-past-due upper bound (inclusive), or null for open-ended (60+). */
  dpdTo: number | null;
  recoveryStage: LoanRecoveryStage;
}

/**
 * Ports `loanDefaulterat1Dayto30Day()` / `loanDefaulterat31Dayto60Day()` /
 * `loanDefaulterat60PlusDay()` from `CronCollectionController.php` —
 * identifies disbursed loans whose CAM repayment date has passed by a given
 * DPD (days-past-due) bucket.
 *
 * Deliberate deviation from legacy (documented in TODO.md Phase 6 #57):
 * the 60+ method's name/email-subject say "60 PLUS DAYS" but its actual SQL
 * window was `repayment_date > today-91 AND <= today-61` (i.e. capped at 90
 * days, silently excluding anything older) — a legacy bug. This port
 * implements the 60+ bucket as genuinely open-ended (`dpdTo: null`).
 *
 * Legacy wrote `loan.loan_recovery_status_id` (1=collection pending,
 * 2=recovery pending, 3=legal pending) to persist the escalation stage on
 * the loan row. `Loan.recoveryStage` (`LoanRecoveryStage` enum) now mirrors
 * this — written per matching loan on every run, matching legacy's own
 * unconditional overwrite (no "already at this stage" guard in
 * `CronCollectionController.php` either). The "CTO summary email" itself
 * stays unported: legacy's `middlewareEmail()` helper's `lw_send_email()`
 * call is commented out in production, so it never actually sent either —
 * only the recovery-status write and a DB log row happened for real.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_COLLECTION_DEFAULTER_1_30_DPD`/`..._31_60_DPD`/`..._60_PLUS_DPD`
 * is set to a real cron expression.
 */
@Injectable()
export class CollectionDefaulterEscalationService implements OnModuleInit {
  private readonly logger = new Logger(
    CollectionDefaulterEscalationService.name,
  );

  static readonly BUCKETS: DefaulterBucketConfig[] = [
    {
      cronName: 'collection-defaulter-1-30-dpd',
      label: 'COLLECTION PENDING (1-30 DPD)',
      dpdFrom: 1,
      dpdTo: 30,
      recoveryStage: LoanRecoveryStage.COLLECTION_PENDING,
    },
    {
      cronName: 'collection-defaulter-31-60-dpd',
      label: 'RECOVERY PENDING (31-60 DPD)',
      dpdFrom: 31,
      dpdTo: 60,
      recoveryStage: LoanRecoveryStage.RECOVERY_PENDING,
    },
    {
      cronName: 'collection-defaulter-60-plus-dpd',
      label: 'LEGAL PENDING (60+ DPD)',
      dpdFrom: 61,
      dpdTo: null,
      recoveryStage: LoanRecoveryStage.LEGAL_PENDING,
    },
  ];

  /** Once-daily, early morning - matches the agent-analysis finding that
   * these methods have no cron-log dedup guard (unlike the ~30min-guarded
   * `calculationOpenCaseLoans()`), which is typical of a daily batch sweep
   * rather than a frequent poll. */
  private static readonly CRON_EXPRESSION = 'disabled';

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
  ) {}

  onModuleInit(): void {
    for (const bucket of CollectionDefaulterEscalationService.BUCKETS) {
      this.jobRunner.schedule(
        bucket.cronName,
        CollectionDefaulterEscalationService.CRON_EXPRESSION,
        async () => {
          await this.runBucket(bucket);
        },
      );
    }
  }

  async runBucket(bucket: DefaulterBucketConfig): Promise<{ found: number }> {
    const disbursedStatuses = await this.masterStatusRepository.find({
      where: { name: In(['DISBURSED', 'PART-PAYMENT']) },
    });
    if (disbursedStatuses.length === 0) {
      this.logger.warn(
        `${bucket.cronName}: no master_statuses rows for DISBURSED/PART-PAYMENT`,
      );
      return { found: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upperBound = new Date(today);
    upperBound.setDate(upperBound.getDate() - bucket.dpdFrom);

    // Inclusive on both ends (repaymentDate between today-dpdTo and
    // today-dpdFrom) - legacy's window was exclusive on the older boundary
    // (`repayment_date > start_date`), an off-by-one this port normalizes
    // rather than replicates, since "DPD 1 to 30 inclusive" is the actually
    // intended bucket.
    const repaymentDateWhere = bucket.dpdTo
      ? Between(this.daysBefore(today, bucket.dpdTo), upperBound)
      : LessThanOrEqual(upperBound);

    const cams = await this.camRepository.find({
      where: {
        repaymentDate: repaymentDateWhere,
        lead: { leadStatus: { id: In(disbursedStatuses.map((s) => s.id)) } },
      },
      relations: { lead: true },
    });

    if (cams.length === 0) {
      this.logger.debug(`${bucket.cronName}: no loans in this DPD bucket`);
      return { found: 0 };
    }

    const loans = await this.loanRepository.find({
      where: { lead: { id: In(cams.map((c) => c.lead.id)) } },
      relations: { lead: true },
    });

    if (loans.length > 0) {
      await this.loanRepository.update(
        { id: In(loans.map((l) => l.id)) },
        { recoveryStage: bucket.recoveryStage },
      );
    }

    this.logger.log(
      `${bucket.cronName} [${bucket.label}]: ${loans.length} loan(s) - ${loans
        .map((l) => l.loanNumber)
        .join(', ')}`,
    );
    return { found: loans.length };
  }

  private daysBefore(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }
}
