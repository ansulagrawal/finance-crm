import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  LeadCustomer,
  LegalEmailLog,
  Loan,
  MasterStatus,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import {
  renderLegalNoticeEmailHtml,
  renderLegalNoticeEmailSubject,
} from '../../templates/email/legal-notice-email.template';

interface EmailSendResponse {
  id: number;
}

/** Ports the `'dn'` (Demand Notice) branch — `no_of_days = "07"`. */
const DAYS_TO_RESPOND = 7;
/** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
const EMAIL_TYPE_ID = 8;
/**
 * `LegalEmailLog` has no per-notice-type column at all (legacy's own
 * `legal_email_type_id` is a single generic "1=>Legal Email" value per the
 * entity's doc comment, not a `'dn'`/`'fn'`/`'lrn'` split) — this service
 * only ever sends the `'dn'` notice type, so dedup is by lead alone, and
 * `typeId` is written as this one generic value.
 */
const LEGAL_EMAIL_TYPE_ID = 1;

/**
 * Ports `CronLegalEmailerController::legalNoticeEmailer('dn', 60, 90)`
 * (`CronJobs/CronLegalEmailerController.php`) — confirmed live via the
 * real production crontab (`legalNoticeEmailer dn 60 90`, `45 9 * * *`).
 * Correct current entity (Acme Financial Services Pvt Ltd / Finance CRM),
 * NOT the wrong-entity "Naman Finlease"/"Loanwalle.com" content this
 * session earlier and correctly excluded (that was a different,
 * differently-scoped function in `CronEmailerController.php`).
 *
 * DPD window: `DATEDIFF(CURDATE(), CAM.repayment_date) BETWEEN 60 AND 90`
 * — ported as an inclusive both-ends date range, same normalization
 * pattern used throughout this codebase's DPD-bucket jobs
 * (`CollectionDefaulterEscalationService`). `lead_status_id IN(14,19)` —
 * DISBURSED/PART-PAYMENT, same filter every collections job in this
 * codebase uses.
 *
 * Dedup: legacy LEFT JOINs `legal_email_logs` on
 * `(lead_id, notice_type, loan_no)` to skip loans that already got this
 * notice type. The real `LegalEmailLog` entity has no `notice_type`
 * column (see `LEGAL_EMAIL_TYPE_ID`'s doc comment) — dedup here is by
 * lead alone, which is equivalent since this service only ever sends one
 * notice type.
 *
 * Outstanding-amount: legacy calls a ~150-line
 * `LeadModel::getLoanRepaymentDetails()` with its own discount/penalty/
 * FOIR-adjustment logic. Reuses this codebase's already-established
 * simplification instead (`core-api`'s `LegalNoticeService`):
 * `CAM.repaymentAmount` net of verified (`APPROVED`, non-deleted)
 * `Collection.receivedAmount` — same computation, same justification,
 * not re-deriving a second inconsistent formula.
 *
 * Legacy's body says "Please find attached a Demand Notice" — no PDF is
 * attached here (see the template's doc comment for why: this backend's
 * only legal-notice PDF is a "NOT REVIEWED BY LEGAL COUNSEL" placeholder
 * that must not go out on a real notice); the notice text itself is
 * stated inline instead.
 *
 * `LegalEmailLog.sentTo`/`sentBcc` are NOT NULL with no DB default and
 * the old code never set them (it only set `lead`/`loanNumber`/
 * `noticeType`, and `noticeType` doesn't even exist on the real entity).
 * `sentTo` is filled from the actual recipient email (unambiguous);
 * `sentBcc` has no source anywhere in the ported code or legacy
 * PHP-derived doc comments — defaulted to empty string, flagged in
 * `docs/TODO.md` rather than guessed at a real address.
 */
@Injectable()
export class LegalNoticeEmailService implements OnModuleInit {
  private readonly logger = new Logger(LegalNoticeEmailService.name);

  private static readonly CRON_NAME = 'legal-notice-email-60-90-dpd';
  private static readonly CRON_EXPRESSION = '45 9 * * *';
  private static readonly DPD_FROM = 60;
  private static readonly DPD_TO = 90;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(LegalEmailLog)
    private readonly legalEmailLogRepository: Repository<LegalEmailLog>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      LegalNoticeEmailService.CRON_NAME,
      LegalNoticeEmailService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ found: number; notified: number; failed: number }> {
    const disbursedStatuses = await this.masterStatusRepository.find({
      where: { name: In(['DISBURSED', 'PART-PAYMENT']) },
    });
    if (disbursedStatuses.length === 0) {
      this.logger.warn(
        `${LegalNoticeEmailService.CRON_NAME}: no master_statuses rows for DISBURSED/PART-PAYMENT`,
      );
      return { found: 0, notified: 0, failed: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = this.daysBefore(today, LegalNoticeEmailService.DPD_TO);
    const to = this.daysBefore(today, LegalNoticeEmailService.DPD_FROM);

    const cams = await this.camRepository.find({
      where: {
        repaymentDate: Between(from, to),
        lead: { leadStatus: { id: In(disbursedStatuses.map((s) => s.id)) } },
      },
      relations: { lead: true },
    });
    if (cams.length === 0) {
      this.logger.debug(
        `${LegalNoticeEmailService.CRON_NAME}: no loans in this DPD bucket`,
      );
      return { found: 0, notified: 0, failed: 0 };
    }

    const [loans, customers, verifiedCollections, existingLogs] =
      await Promise.all([
        this.loanRepository.find({
          where: { lead: { id: In(cams.map((c) => c.lead.id)) } },
          relations: { lead: true },
        }),
        this.leadCustomerRepository.find({
          where: { lead: { id: In(cams.map((c) => c.lead.id)) } },
          relations: { lead: true },
        }),
        this.collectionRepository.find({
          where: {
            lead: { id: In(cams.map((c) => c.lead.id)) },
            verificationStatus: CollectionVerificationStatus.APPROVED,
            isDeleted: false,
          },
          relations: { lead: true },
        }),
        this.legalEmailLogRepository.find({
          where: {
            lead: { id: In(cams.map((c) => c.lead.id)) },
          },
          relations: { lead: true },
        }),
      ]);

    const loanByLeadId = new Map(loans.map((loan) => [loan.lead.id, loan]));
    const customerByLeadId = new Map(
      customers.map((customer) => [customer.lead.id, customer]),
    );
    const receivedByLeadId = new Map<number, number>();
    for (const collection of verifiedCollections) {
      const leadId = collection.lead.id;
      receivedByLeadId.set(
        leadId,
        (receivedByLeadId.get(leadId) ?? 0) + Number(collection.receivedAmount),
      );
    }
    const alreadyNotifiedLeadIds = new Set(
      existingLogs
        .filter((log) => log.lead)
        .map((log) => (log.lead as { id: number }).id),
    );

    const companyName = this.configService.get<string>(
      'COMPANY_NAME',
      'Acme Financial Services Pvt Ltd.',
    );
    const legalEmail = this.configService.get<string>(
      'LEGAL_EMAIL',
      'legal@financecrm.com',
    );

    let notified = 0;
    let failed = 0;
    let found = 0;
    for (const cam of cams) {
      if (alreadyNotifiedLeadIds.has(cam.lead.id)) continue;
      const loan = loanByLeadId.get(cam.lead.id);
      const customer = customerByLeadId.get(cam.lead.id);
      const email = cam.lead.email?.trim();
      if (!loan?.loanNumber || !customer || !email) continue;
      found += 1;
      const loanNumber = loan.loanNumber;

      const custFullName =
        [customer.firstName, customer.middleName, customer.surName]
          .filter(Boolean)
          .join(' ') || cam.lead.firstName;
      const receivedAmount = receivedByLeadId.get(cam.lead.id) ?? 0;
      const outstandingAmount = (
        Number(cam.repaymentAmount) - receivedAmount
      ).toLocaleString('en-IN');

      try {
        await this.integrationsApiClient.post<EmailSendResponse>(
          '/email/send',
          {
            leadId: cam.lead.id,
            email,
            cc: legalEmail,
            subject: renderLegalNoticeEmailSubject(loanNumber, custFullName),
            html: renderLegalNoticeEmailHtml({
              custFullName,
              companyName,
              loanNo: loanNumber,
              outstandingAmount,
              daysToRespond: DAYS_TO_RESPOND,
            }),
            typeId: EMAIL_TYPE_ID,
          },
        );

        await this.legalEmailLogRepository.save(
          this.legalEmailLogRepository.create({
            lead: cam.lead,
            loanNumber,
            typeId: LEGAL_EMAIL_TYPE_ID,
            sentTo: email,
            sentCc: legalEmail,
            sentBcc: '',
            sentAt: new Date(),
          }),
        );
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `${LegalNoticeEmailService.CRON_NAME}: failed to notify lead ${cam.lead.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `${LegalNoticeEmailService.CRON_NAME}: found=${found} notified=${notified} failed=${failed}`,
    );
    return { found, notified, failed };
  }

  private daysBefore(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }
}
