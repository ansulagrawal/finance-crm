import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import { LeadCustomer } from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  renderBirthdayHtml,
  renderBirthdaySubject,
} from '../../templates/email/birthday-email.template';

/**
 * Ports `birthdayemailer()` from `CronEmailerController.php` — a birthday
 * greeting email to every lead whose `lead_customer.dob` matches today's
 * month/day. This is the **only** method across both `CronEmailerController`
 * and `CronSMSController` with a real `routes.php` alias
 * (`$route['cronEmailer'] = 'CronJobs/CronEmailerController/birthdayemailer'`),
 * confirming it's genuinely live rather than only reachable by full URL.
 *
 * Legacy matches month/day via `DATE_FORMAT(DATE(LC.dob),'%m-%d')` in SQL;
 * this port instead loads every customer row with a non-null `dob` and
 * compares month/day in application code — avoids a raw SQL date-format
 * expression for a query whose result set (customers with a birthday
 * *today*) is a small fraction of the table, and keeps the test suite
 * simple (mocked `.find()`, matching every other job in this codebase)
 * rather than requiring a `QueryBuilder` mock.
 *
 * Legacy's 30-minute dedup guard is boilerplate (see #58 write-up in
 * TODO.md); a birthday only needs one send per day, so this runs once daily,
 * mid-morning.
 *
 * Sends via `integrations-api`'s generic `POST /email/send` (added
 * specifically to unblock this and every other previously-log-only email
 * job — see `docs/TODO.md`/`COMPLETED.md`). Legacy's footer social-icon
 * row isn't ported (see `birthday-email.template.ts`'s doc comment).
 *
 * **Disabled by default** — absent from the real production crontab (see
 * `docs/TODO.md`); the `routes.php` alias noted above means legacy may
 * still trigger it via a direct URL hit (e.g. a hosted external scheduler)
 * rather than the server's own crontab, which this backend has no
 * equivalent visibility into. Built and tested, off everywhere unless
 * `CRON_BIRTHDAY_EMAIL` is set to a real cron expression.
 */
@Injectable()
export class BirthdayEmailService implements OnModuleInit {
  private readonly logger = new Logger(BirthdayEmailService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  /** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
  private static readonly EMAIL_TYPE_ID = 2;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'birthday-email',
      BirthdayEmailService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ notified: number; failed: number }> {
    const customersWithDob = await this.leadCustomerRepository.find({
      where: { dob: Not(IsNull()) },
      relations: { lead: true },
    });

    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();

    const recipients: { leadId: number; email: string; firstName: string }[] =
      [];
    const seenLeadIds = new Set<number>();
    for (const customer of customersWithDob) {
      if (!customer.dob) continue;
      const dob = new Date(customer.dob);
      if (dob.getMonth() !== month || dob.getDate() !== day) continue;
      const leadId = customer.lead?.id;
      const email = customer.lead?.email?.trim().toLowerCase();
      const firstName = customer.lead?.firstName?.trim();
      if (!leadId || !email || !firstName || seenLeadIds.has(leadId)) continue;
      seenLeadIds.add(leadId);
      recipients.push({ leadId, email, firstName });
    }

    if (recipients.length === 0) {
      this.logger.debug('birthday-email: no birthdays today');
      return { notified: 0, failed: 0 };
    }

    const brandName = this.configService.get<string>('BRAND_NAME', 'Finance CRM');
    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    const applyNowUrl = `${lmsUrl}/apply-now?utm_source=EMAIL&utm_campaign=birthday_wish_${today
      .toISOString()
      .slice(0, 10)}`;

    let notified = 0;
    let failed = 0;
    for (const recipient of recipients) {
      try {
        await this.integrationsApiClient.post('/email/send', {
          leadId: recipient.leadId,
          email: recipient.email,
          subject: renderBirthdaySubject(recipient.firstName),
          html: renderBirthdayHtml(recipient.firstName, brandName, applyNowUrl),
          typeId: BirthdayEmailService.EMAIL_TYPE_ID,
        });
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `birthday-email: failed to notify lead ${recipient.leadId}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(`birthday-email: notified=${notified} failed=${failed}`);
    return { notified, failed };
  }
}
