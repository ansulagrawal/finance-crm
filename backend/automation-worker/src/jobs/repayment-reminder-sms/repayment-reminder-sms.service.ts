import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  LeadCustomer,
  Loan,
  MasterStatus,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';

interface SmsSendResponse {
  id: number;
}

export interface RepaymentReminderSmsBucketConfig {
  cronName: string;
  daysBefore: number;
}

/** Vapio DLT template id for the "Waiver" discount-offer message —
 * matches legacy's `$type=1` branch exactly. */
const WAIVER_TEMPLATE_ID = '1707177191819066667';
/** No shared enum for ad-hoc SMS types — `SmsLog.typeId` is free-form. */
const SMS_TYPE_ID = 4;

function buildWaiverMessage(
  amount: string,
  dueDate: string,
  discount: string,
): string {
  return `Payment of INR ${amount} is due on ${dueDate}. Pay today and enjoy a waiver on charges up to INR ${discount}. Pay instantly: https://financecrm.com/pay-now - Finance CRM`;
}

/**
 * Ports `Reminders::smsPrepayment($days, $type)` (`CronJobs/Reminders.php`)
 * — confirmed live via the real production crontab
 * (`smsPrepayment 1..5 1`, `30 9 * * *`), always called with `$type=1`
 * ("Waiver"). Sends a real direct Vapio SMS to the borrower's primary
 * mobile only (`LeadCustomer.mobile`, legacy does not fan out to
 * `alternate_mobile` here, unlike the email sibling job).
 *
 * Superseded an earlier draft of this port based on
 * `CronSMSController::repaymentReminder0DaySMS()` — that file is not what's
 * actually scheduled; `Reminders.php` is, and it never calls a day-0
 * variant, uses direct SMS rather than a WhatsApp-template substitution,
 * and has different content (a discount/waiver offer, not a plain
 * reminder).
 *
 * Underlying query is unchanged from that earlier draft — both jobs
 * ultimately read `SMSModel::getAllRepaymentReminderSMS(true, $days)`,
 * confirmed to resolve to an **exact** day match
 * (`CAM.repayment_date = today + $days`, not a cumulative range) when
 * called with `reminder_flag=true`, `lead_status_id IN(14,19)`
 * (DISBURSED/PART-PAYMENT), excluding leads with a pending
 * (unverified) collection entry — same criteria
 * `RepaymentReminderEmailService` already uses.
 *
 * Discount: `(CAM.recommendedLoanAmount * daysBefore) / 100`, matches
 * legacy's `($customer_data['loan_recommended']*$days)/100` exactly.
 */
@Injectable()
export class RepaymentReminderSmsService implements OnModuleInit {
  private readonly logger = new Logger(RepaymentReminderSmsService.name);

  static readonly BUCKETS: RepaymentReminderSmsBucketConfig[] = [
    5, 4, 3, 2, 1,
  ].map((daysBefore) => ({
    cronName: `repayment-reminder-sms-${daysBefore}-day`,
    daysBefore,
  }));

  private static readonly CRON_EXPRESSION = '30 9 * * *';
  private static readonly DISBURSED_STATUS_NAMES = [
    'DISBURSED',
    'PART-PAYMENT',
  ];

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(CreditAnalysisMemo)
    private readonly camRepository: Repository<CreditAnalysisMemo>,
    @InjectRepository(Loan) private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    private readonly integrationsApiClient: IntegrationsApiClient,
  ) {}

  onModuleInit(): void {
    for (const bucket of RepaymentReminderSmsService.BUCKETS) {
      this.jobRunner.schedule(
        bucket.cronName,
        RepaymentReminderSmsService.CRON_EXPRESSION,
        async () => {
          await this.runBucket(bucket);
        },
      );
    }
  }

  async runBucket(
    bucket: RepaymentReminderSmsBucketConfig,
  ): Promise<{ found: number; notified: number; failed: number }> {
    const disbursedStatuses = await this.masterStatusRepository.find({
      where: { name: In(RepaymentReminderSmsService.DISBURSED_STATUS_NAMES) },
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

    const [loans, customers] = await Promise.all([
      this.loanRepository.find({
        where: { lead: { id: In(eligibleCams.map((c) => c.lead.id)) } },
        relations: { lead: true },
      }),
      this.leadCustomerRepository.find({
        where: { lead: { id: In(eligibleCams.map((c) => c.lead.id)) } },
        relations: { lead: true },
      }),
    ]);
    const loanByLeadId = new Map(loans.map((loan) => [loan.lead.id, loan]));
    const customerByLeadId = new Map(
      customers.map((customer) => [customer.lead.id, customer]),
    );

    let notified = 0;
    let failed = 0;
    for (const cam of eligibleCams) {
      const loan = loanByLeadId.get(cam.lead.id);
      const customer = customerByLeadId.get(cam.lead.id);
      if (!loan || !customer?.mobile) continue;

      const amount = Number(cam.repaymentAmount).toLocaleString('en-IN');
      const dueDate = cam.repaymentDate
        ? new Date(cam.repaymentDate).toLocaleDateString('en-GB')
        : '';
      const discount = Math.round(
        (Number(cam.recommendedLoanAmount) * bucket.daysBefore) / 100,
      ).toLocaleString('en-IN');
      const message = buildWaiverMessage(amount, dueDate, discount);

      try {
        await this.integrationsApiClient.post<SmsSendResponse>('/sms/send', {
          leadId: cam.lead.id,
          mobile: customer.mobile,
          message,
          templateId: WAIVER_TEMPLATE_ID,
          typeId: SMS_TYPE_ID,
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
