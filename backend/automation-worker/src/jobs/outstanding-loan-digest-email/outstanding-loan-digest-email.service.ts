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
  renderOutstandingLoanDigestHtml,
  renderOutstandingLoanDigestSubject,
} from '../../templates/email/outstanding-loan-digest-email.template';

/**
 * Ports `loanOutstandingCustomer1To60DaysEmailer()` from
 * `CronEmailerController.php` — a per-loan "your repayment is overdue"
 * digest for loans 1-60 days past their CAM repayment date, computing a
 * late-penal-interest surcharge on top of the scheduled repayment amount.
 *
 * **Real, faithfully-ported deviation**: legacy's own code comments out
 * `$customer_email = $customer_data['email'];` and hardcodes
 * `$customer_email = CTO_EMAIL` instead — in real production, every one of
 * these "customer" emails (plus the run's summary count) goes to the CTO,
 * not the borrower. This isn't a porting mistake; it's what legacy actually
 * does today. Since this job is log-only anyway (see integration gap
 * below), who the intended recipient is doesn't change behavior here, but
 * it's called out because it explains why this reads as a customer digest
 * but is really an internal ops report.
 *
 * **Due-amount formula**, ported verbatim from the controller (not the
 * model — the model only fetches rows, the controller computes the
 * penalty):
 * `dpd = clamp(today - repaymentDate, 0, 60)`
 * `lateInterest = recommendedLoanAmount * (roi * 2) * dpd / 100`
 * `totalDue = lateInterest + repaymentAmount`
 * `finalAmount = totalDue - sum(verified Collection.receivedAmount for that lead)`
 * This intentionally does NOT reimplement legacy's separate
 * `CommonComponent::get_loan_repayment_details()` recompute engine (out of
 * scope — that logic lives outside these controller/model files and wasn't
 * reverse-engineered).
 *
 * DPD window: `getAllDefaulterCustomerApps(1, 60)` → repayment date in
 * `(today-61, today-1]`. `lead_data_source_id NOT IN(21,27)` omitted (seed
 * gap, same as every other collections/emailer job in this codebase).
 *
 * Sends via `integrations-api`'s generic `POST /email/send`, one email
 * per overdue loan, addressed to `CTO_EMAIL` (not the borrower — see
 * above). Plain internal-summary content, not legacy's customer-styled
 * HTML (see `outstanding-loan-digest-email.template.ts`).
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_OUTSTANDING_LOAN_DIGEST_EMAIL` is set to a real cron expression.
 */
@Injectable()
export class OutstandingLoanDigestEmailService implements OnModuleInit {
  private readonly logger = new Logger(OutstandingLoanDigestEmailService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  private static readonly DISBURSED_STATUS_NAMES = [
    'DISBURSED',
    'PART-PAYMENT',
  ];
  private static readonly MIN_DPD = 1;
  private static readonly MAX_DPD = 60;
  /** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
  private static readonly EMAIL_TYPE_ID = 5;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'outstanding-loan-digest-email',
      OutstandingLoanDigestEmailService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ found: number; notified: number; failed: number }> {
    const disbursedStatuses = await this.masterStatusRepository.find({
      where: {
        name: In(OutstandingLoanDigestEmailService.DISBURSED_STATUS_NAMES),
      },
    });
    if (disbursedStatuses.length === 0) {
      this.logger.warn(
        'outstanding-loan-digest-email: no master_statuses rows for DISBURSED/PART-PAYMENT',
      );
      return { found: 0, notified: 0, failed: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upperBound = this.daysBefore(
      today,
      OutstandingLoanDigestEmailService.MIN_DPD,
    );
    const lowerBound = this.daysBefore(
      today,
      OutstandingLoanDigestEmailService.MAX_DPD + 1,
    );

    const cams = await this.camRepository.find({
      where: {
        repaymentDate: Between(lowerBound, upperBound),
        lead: { leadStatus: { id: In(disbursedStatuses.map((s) => s.id)) } },
      },
      relations: { lead: true },
    });
    if (cams.length === 0) {
      this.logger.debug(
        'outstanding-loan-digest-email: no loans in this DPD window',
      );
      return { found: 0, notified: 0, failed: 0 };
    }

    const leadIds = cams.map((cam) => cam.lead.id);
    const [pendingCollections, verifiedCollections, loans] = await Promise.all([
      this.collectionRepository.find({
        where: {
          lead: { id: In(leadIds) },
          verificationStatus: CollectionVerificationStatus.PENDING,
          isDeleted: false,
        },
      }),
      this.collectionRepository.find({
        where: {
          lead: { id: In(leadIds) },
          verificationStatus: CollectionVerificationStatus.APPROVED,
          isDeleted: false,
        },
        relations: { lead: true },
      }),
      this.loanRepository.find({
        where: { lead: { id: In(leadIds) } },
        relations: { lead: true },
      }),
    ]);

    const excludedLeadIds = new Set(
      pendingCollections.map((collection) => collection.lead.id),
    );
    const eligibleCams = cams.filter(
      (cam) => !excludedLeadIds.has(cam.lead.id),
    );
    if (eligibleCams.length === 0) {
      return { found: 0, notified: 0, failed: 0 };
    }

    const verifiedReceivedByLeadId = new Map<number, number>();
    for (const collection of verifiedCollections) {
      const leadId = collection.lead.id;
      verifiedReceivedByLeadId.set(
        leadId,
        (verifiedReceivedByLeadId.get(leadId) ?? 0) +
          Number(collection.receivedAmount),
      );
    }
    const loanByLeadId = new Map(loans.map((loan) => [loan.lead.id, loan]));

    const ctoEmail = this.configService.get<string>('CTO_EMAIL', '');
    const brandName = this.configService.get<string>('BRAND_NAME', 'Finance CRM');

    const summaries: string[] = [];
    let notified = 0;
    let failed = 0;
    for (const cam of eligibleCams) {
      const loan = loanByLeadId.get(cam.lead.id);
      if (!loan?.loanNumber) continue;
      const loanNumber = loan.loanNumber;

      const dpd = this.clampDpd(today, cam.repaymentDate);
      const lateInterest =
        (Number(cam.recommendedLoanAmount) * (Number(cam.roi) * 2) * dpd) / 100;
      const totalDue = lateInterest + Number(cam.repaymentAmount);
      const finalAmount =
        totalDue - (verifiedReceivedByLeadId.get(cam.lead.id) ?? 0);

      summaries.push(`${loanNumber}: dpd=${dpd} due=${finalAmount.toFixed(2)}`);

      if (!ctoEmail) continue;
      try {
        await this.integrationsApiClient.post('/email/send', {
          leadId: cam.lead.id,
          email: ctoEmail,
          subject: renderOutstandingLoanDigestSubject(
            brandName,
            loanNumber,
            dpd,
          ),
          html: renderOutstandingLoanDigestHtml({
            custFullName: cam.lead.firstName,
            loanNo: loanNumber,
            loanAmount: Number(cam.recommendedLoanAmount).toLocaleString(
              'en-IN',
            ),
            finalAmount: finalAmount.toLocaleString('en-IN'),
            dpd,
          }),
          typeId: OutstandingLoanDigestEmailService.EMAIL_TYPE_ID,
        });
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `outstanding-loan-digest-email: failed to notify CTO for lead ${cam.lead.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `outstanding-loan-digest-email: ${summaries.length} loan(s) 1-60 DPD - ${summaries.join('; ')} notified=${notified} failed=${failed}`,
    );
    return { found: summaries.length, notified, failed };
  }

  private clampDpd(today: Date, repaymentDate: Date | null): number {
    if (!repaymentDate) return 0;
    const diffDays = Math.floor(
      (today.getTime() - new Date(repaymentDate).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    return Math.min(
      Math.max(diffDays, 0),
      OutstandingLoanDigestEmailService.MAX_DPD,
    );
  }

  private daysBefore(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }
}
