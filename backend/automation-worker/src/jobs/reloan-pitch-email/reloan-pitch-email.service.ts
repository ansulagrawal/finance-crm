import { IntegrationsApiClient, JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Collection,
  CustomerBlacklist,
  Lead,
  MasterStatus,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import {
  RELOAN_PITCH_SUBJECT,
  renderReloanPitchHtml,
} from '../../templates/email/reloan-pitch-email.template';

/**
 * Ports `notificationSendMailAndWhatsapp()` from `CronEmailerController.php`
 * — a "you're eligible for another loan" marketing pitch to customers whose
 * loan just closed, provided they have no other non-terminal (still active)
 * lead under the same PAN and aren't blacklisted.
 *
 * Despite the legacy method's name, the WhatsApp half is dead code (its
 * `call_whatsapp_api()` call is commented out) — only email is ever sent in
 * production. This port is email-only, matching real behavior.
 *
 * Legacy's `customer_black_list` (PAN-keyed, `bl_active=1 AND bl_deleted=0`)
 * is a **global identity blacklist keyed on its own snapshot columns**, not
 * a per-lead flag — `CustomerBlacklist`'s own doc comment is explicit that
 * `pancard` is a snapshot at blacklist-creation time and deliberately
 * doesn't track later edits to the originating lead's own PAN. This port
 * therefore matches against `CustomerBlacklist.pancard` directly (the
 * snapshot), not via the `lead` relation's live PAN — the correct
 * lead-agnostic match legacy's own `checkBlackListedCustomer()` performs.
 *
 * The "no other non-terminal lead with the same PAN" check is ported
 * faithfully: legacy's terminal set was `lead_status_id NOT IN(8,9,16)` i.e.
 * SYSTEM-REJECT/REJECT/CLOSED are the only statuses considered "resolved"
 * for this purpose — this port uses the same three `MasterStatus` names.
 *
 * Legacy's "closure payment" trigger (`collection.closure_payment_updated_on
 * <= today`) maps to `Collection.closedAt`.
 *
 * Sends via `integrations-api`'s generic `POST /email/send`. The brand
 * logo used is real (see `reloan-pitch-email.template.ts`).
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_RELOAN_PITCH_EMAIL` is set to a real cron expression.
 */
@Injectable()
export class ReloanPitchEmailService implements OnModuleInit {
  private readonly logger = new Logger(ReloanPitchEmailService.name);

  private static readonly CRON_EXPRESSION = 'disabled';
  private static readonly CLOSED_STATUS_NAME = 'CLOSED';
  private static readonly TERMINAL_STATUS_NAMES = [
    'SYSTEM-REJECT',
    'REJECT',
    'CLOSED',
  ];
  /** No shared enum for ad-hoc email types — `EmailLog.typeId` is free-form. */
  private static readonly EMAIL_TYPE_ID = 6;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(Collection)
    private readonly collectionRepository: Repository<Collection>,
    @InjectRepository(CustomerBlacklist)
    private readonly customerBlacklistRepository: Repository<CustomerBlacklist>,
    private readonly integrationsApiClient: IntegrationsApiClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      'reloan-pitch-email',
      ReloanPitchEmailService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ notified: number; failed: number }> {
    const closedStatus = await this.masterStatusRepository.findOne({
      where: { name: ReloanPitchEmailService.CLOSED_STATUS_NAME },
    });
    const terminalStatuses = await this.masterStatusRepository.find({
      where: { name: In(ReloanPitchEmailService.TERMINAL_STATUS_NAMES) },
    });
    if (!closedStatus || terminalStatuses.length === 0) {
      this.logger.error(
        "reloan-pitch-email: missing 'CLOSED' or terminal master_statuses rows",
      );
      return { notified: 0, failed: 0 };
    }
    const terminalStatusIds = new Set(terminalStatuses.map((s) => s.id));

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const closedCollections = await this.collectionRepository.find({
      where: {
        closedAt: LessThanOrEqual(today),
        lead: { leadStatus: { id: closedStatus.id } },
      },
      relations: { lead: true },
    });
    if (closedCollections.length === 0) {
      this.logger.debug('reloan-pitch-email: no loans closed today or earlier');
      return { notified: 0, failed: 0 };
    }

    const closedLeads = closedCollections
      .map((collection) => collection.lead)
      .filter(
        (lead): lead is Lead & { pancard: string } => lead.pancard !== null,
      );
    if (closedLeads.length === 0) {
      return { notified: 0, failed: 0 };
    }

    const pancards = [...new Set(closedLeads.map((lead) => lead.pancard))];

    const [allLeadsWithSamePancards, blacklistEntries] = await Promise.all([
      this.leadRepository.find({
        where: { pancard: In(pancards) },
        relations: { leadStatus: true },
      }),
      this.customerBlacklistRepository.find({
        where: {
          pancard: In(pancards),
          isActive: true,
          isDeleted: false,
        },
      }),
    ]);

    const nonTerminalPancards = new Set(
      allLeadsWithSamePancards
        .filter((lead) => !terminalStatusIds.has(lead.leadStatus?.id ?? -1))
        .map((lead) => lead.pancard),
    );
    const blacklistedPancards = new Set(
      blacklistEntries.map((entry) => entry.pancard),
    );

    const eligibleLeads = closedLeads.filter(
      (lead) =>
        !nonTerminalPancards.has(lead.pancard) &&
        !blacklistedPancards.has(lead.pancard),
    );
    if (eligibleLeads.length === 0) {
      this.logger.debug(
        'reloan-pitch-email: every closed borrower is either blacklisted or still has a non-terminal lead under the same PAN',
      );
      return { notified: 0, failed: 0 };
    }

    const distinct = new Map<string, Lead>();
    for (const lead of eligibleLeads) {
      const key = `${lead.pancard}|${lead.mobile}`;
      if (!distinct.has(key)) distinct.set(key, lead);
    }

    const lmsUrl = this.configService.get<string>('LMS_URL', '');
    const campaignName = `EMAIL${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const applyNowUrl = `${lmsUrl}/apply-now?utm_source=EMAIL&utm_campaign=${campaignName}`;

    let notified = 0;
    let failed = 0;
    for (const lead of distinct.values()) {
      const email = lead.email?.trim();
      if (!email) continue;
      try {
        await this.integrationsApiClient.post('/email/send', {
          leadId: lead.id,
          email,
          subject: RELOAN_PITCH_SUBJECT,
          html: renderReloanPitchHtml(lead.firstName, applyNowUrl),
          typeId: ReloanPitchEmailService.EMAIL_TYPE_ID,
        });
        notified += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `reloan-pitch-email: failed to notify lead ${lead.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `reloan-pitch-email: notified=${notified} failed=${failed}`,
    );
    return { notified, failed };
  }
}
