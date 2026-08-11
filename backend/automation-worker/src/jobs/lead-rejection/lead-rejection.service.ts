import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Lead,
  LeadFollowup,
  LeadUserType,
  MasterStatus,
  RejectionReason,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';

export type RejectionRule =
  | {
      kind: 'assignment-tat';
      cronName: string;
      /** Which lead lifecycle stage codes this rule watches. */
      stageCodes: string[];
      /** Column measured against the TAT threshold. */
      assignedAtField: 'screenerAssignedAt' | 'creditAssignedAt';
      tatHours: number;
      restrictToUserType?: LeadUserType;
    }
  | {
      kind: 'stale-bucket';
      cronName: string;
      stageCodes: string[];
      tatHours: number;
    };

/**
 * Ports `reject_lead()`, `reject_lead_new_bucket()` and
 * `reject_application()` from `CronSanctionController.php` — auto-rejects
 * leads/applications that have breached a TAT (turnaround time) threshold
 * without being progressed.
 *
 * Deviations from legacy, documented per TODO.md:
 * - `reject_application()` originally scoped itself to a hardcoded list of
 *   8 hardcoded `lead_credit_assign_user_id`s. Hardcoding specific
 *   (possibly ex-)employee ids into this codebase would be meaningless and
 *   unmaintainable, so this port applies the TAT rule to every APPLICATION
 *   in stage S5/S6 regardless of who it's assigned to — a deliberate
 *   scope-widening, flagged for business confirmation.
 * - Legacy's `lead_followup` remark text stated the wrong TAT hours in two
 *   of the three methods (e.g. "TAT 90 HOURS COMPLETED" logged even though
 *   the actual threshold checked was 48 hours) — a copy-paste bug. This
 *   port's remark text states the real threshold used.
 * - All three still use the single seeded `rejection_reasons` row with text
 *   "TAT 90 HOURS COMPLETED" (legacy `lead_rejected_reason_id=63`) as the
 *   `RejectionReason` FK, since that's the only auto-TAT-reject reason row
 *   present in `seed-data/rejection-reasons.json` — the FK is reused as-is,
 *   only the human-readable followup remark is corrected.
 * - `reject_lead_new_bucket()`'s legacy dedup/lock and completion-logging
 *   calls were commented out (ran unguarded every invocation); this isn't
 *   an issue here since `JobRunner` already refuses to overlap runs of the
 *   same named job.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`). Built and tested, off everywhere unless
 * `CRON_REJECT_LEAD_SCREENER_TAT`/`CRON_REJECT_LEAD_NEW_BUCKET_TAT`/
 * `CRON_REJECT_APPLICATION_CREDIT_TAT` is set to a real cron expression.
 */
@Injectable()
export class LeadRejectionService implements OnModuleInit {
  private readonly logger = new Logger(LeadRejectionService.name);

  static readonly RULES: RejectionRule[] = [
    {
      kind: 'assignment-tat',
      cronName: 'reject-lead-screener-tat',
      stageCodes: ['S2', 'S3'],
      assignedAtField: 'screenerAssignedAt',
      tatHours: 48,
      restrictToUserType: LeadUserType.NEW,
    },
    {
      kind: 'stale-bucket',
      cronName: 'reject-lead-new-bucket-tat',
      stageCodes: ['S1', 'S2', 'S3'],
      tatHours: 72,
    },
    {
      kind: 'assignment-tat',
      cronName: 'reject-application-credit-tat',
      stageCodes: ['S5', 'S6'],
      assignedAtField: 'creditAssignedAt',
      tatHours: 36,
      restrictToUserType: LeadUserType.NEW,
    },
  ];

  private static readonly CRON_EXPRESSION = 'disabled';
  private static readonly REJECTION_REASON_TEXT = 'TAT 90 HOURS COMPLETED';

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(RejectionReason)
    private readonly rejectionReasonRepository: Repository<RejectionReason>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
  ) {}

  onModuleInit(): void {
    for (const rule of LeadRejectionService.RULES) {
      this.jobRunner.schedule(
        rule.cronName,
        LeadRejectionService.CRON_EXPRESSION,
        async () => {
          await this.runRule(rule);
        },
      );
    }
  }

  async runRule(rule: RejectionRule): Promise<{ rejected: number }> {
    const stageStatuses = await this.masterStatusRepository.find({
      where: { stageCode: In(rule.stageCodes) },
    });
    if (stageStatuses.length === 0) {
      this.logger.warn(
        `${rule.cronName}: no master_statuses rows for stageCode(s) ${rule.stageCodes.join(',')}`,
      );
      return { rejected: 0 };
    }
    const rejectStatus = await this.masterStatusRepository.findOne({
      where: { name: 'REJECT' },
    });
    const rejectionReason = await this.rejectionReasonRepository.findOne({
      where: { reason: LeadRejectionService.REJECTION_REASON_TEXT },
    });
    if (!rejectStatus || !rejectionReason) {
      this.logger.error(
        `${rule.cronName}: missing required 'REJECT' master_statuses row or '${LeadRejectionService.REJECTION_REASON_TEXT}' rejection_reasons row`,
      );
      return { rejected: 0 };
    }

    const threshold = new Date(Date.now() - rule.tatHours * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      leadStatus: { id: In(stageStatuses.map((s) => s.id)) },
      isActive: true,
      isDeleted: false,
    };
    if (rule.kind === 'assignment-tat') {
      where[rule.assignedAtField] = LessThanOrEqual(threshold);
      if (rule.restrictToUserType) where.userType = rule.restrictToUserType;
    } else {
      where.createdAt = LessThanOrEqual(threshold);
    }

    const staleLeads = await this.leadRepository.find({ where });

    const now = new Date();
    for (const lead of staleLeads) {
      lead.leadStatus = rejectStatus;
      lead.rejectionReason = rejectionReason;
      lead.rejectedAt = now;
      lead.rejectedBy = null;
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: rejectStatus,
          remarks: `Auto Rejected - TAT ${rule.tatHours} HOURS COMPLETED`,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    if (staleLeads.length > 0) {
      this.logger.log(
        `${rule.cronName}: auto-rejected ${staleLeads.length} lead(s)`,
      );
    } else {
      this.logger.debug(`${rule.cronName}: no leads past the TAT threshold`);
    }
    return { rejected: staleLeads.length };
  }
}
