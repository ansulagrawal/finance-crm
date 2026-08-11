import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Lead,
  LeadFollowup,
  LeadUserType,
  MasterStatus,
  RoleType,
  UserRole,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { allocateRoundRobin } from '../shared/round-robin.util';

/**
 * Ports `move_lead_hold_to_screener()` from `CronSanctionController.php` —
 * redistributes leads stuck in `LEAD-HOLD` (legacy `lead_status_id=3`,
 * `stage='S3'`) for 48+ hours since their last screener assignment back
 * into the active screener (`RoleType.code='CR1'`) pool, load-balanced
 * round robin, same as `ScreenerAllocationService`'s initial allocation.
 *
 * Legacy's roster was a hardcoded array of 6 named employee ids (with the
 * live DB-backed query it superseded left commented out above it) — per
 * explicit product decision, this port queries the live active-CR1 roster
 * instead, matching `ScreenerAllocationService`/`CreditApplicationAllocationService`.
 *
 * Legacy's `get_lead_hold()` filter `(monthly_salary_amount = 0 OR
 * monthly_salary_amount >= 50000)` is ported as-is even though it silently
 * excludes the 1-49999 salary band from ever being redistributed — that
 * looks like a bug, but nothing in the surrounding code suggests it was
 * unintentional, so it isn't "corrected" here without a business call.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`); `AllocateLeadsAndApplicationService`
 * covers this same Lead-Hold-to-screener purpose there instead. Built and
 * tested, off everywhere unless `CRON_LEAD_HOLD_REDISTRIBUTION` is set to
 * a real cron expression.
 */
@Injectable()
export class LeadHoldRedistributionService implements OnModuleInit {
  private readonly logger = new Logger(LeadHoldRedistributionService.name);

  static readonly CRON_NAME = 'lead-hold-redistribution';
  static readonly CRON_EXPRESSION = 'disabled';
  static readonly TAT_HOURS = 48;

  constructor(
    @Inject(JOB_RUNNER) private readonly jobRunner: JobRunner,
    @InjectRepository(Lead) private readonly leadRepository: Repository<Lead>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(RoleType)
    private readonly roleTypeRepository: Repository<RoleType>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
  ) {}

  onModuleInit(): void {
    this.jobRunner.schedule(
      LeadHoldRedistributionService.CRON_NAME,
      LeadHoldRedistributionService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ redistributed: number }> {
    const holdStatus = await this.masterStatusRepository.findOne({
      where: { name: 'LEAD-HOLD' },
    });
    const inProcessStatus = await this.masterStatusRepository.findOne({
      where: { name: 'LEAD-INPROCESS' },
    });
    if (!holdStatus || !inProcessStatus) {
      this.logger.error(
        `${LeadHoldRedistributionService.CRON_NAME}: missing required 'LEAD-HOLD'/'LEAD-INPROCESS' master_statuses rows`,
      );
      return { redistributed: 0 };
    }

    const threshold = new Date(
      Date.now() - LeadHoldRedistributionService.TAT_HOURS * 60 * 60 * 1000,
    );

    const leads = (
      await this.leadRepository.find({
        where: {
          leadStatus: { id: holdStatus.id },
          userType: LeadUserType.NEW,
          screenerAssignedAt: LessThanOrEqual(threshold),
          isActive: true,
          isDeleted: false,
        },
        order: { screenerAssignedAt: 'ASC' },
      })
    ).filter(
      (lead) =>
        lead.monthlySalaryAmount === 0 ||
        (lead.monthlySalaryAmount ?? 0) >= 50000,
    );

    if (leads.length === 0) {
      this.logger.debug(
        `${LeadHoldRedistributionService.CRON_NAME}: no leads past the TAT threshold`,
      );
      return { redistributed: 0 };
    }

    const screenerRole = await this.roleTypeRepository.findOne({
      where: { code: 'CR1' },
    });
    if (!screenerRole) {
      this.logger.error(
        `${LeadHoldRedistributionService.CRON_NAME}: missing role_types row code='CR1'`,
      );
      return { redistributed: 0 };
    }
    const screenerRoles = await this.userRoleRepository.find({
      where: { roleType: { id: screenerRole.id }, isActive: true },
      relations: { user: true },
    });
    const activeScreeners = screenerRoles
      .map((ur) => ur.user)
      .filter((user) => user.isActive);
    if (activeScreeners.length === 0) {
      this.logger.warn(
        `${LeadHoldRedistributionService.CRON_NAME}: no active CR1 screener users`,
      );
      return { redistributed: 0 };
    }

    const candidates = await Promise.all(
      activeScreeners.map(async (user) => ({
        userId: user.id,
        currentLoad: await this.leadRepository.count({
          where: {
            screenerAssignedTo: { id: user.id },
            leadStatus: { id: inProcessStatus.id },
          },
        }),
      })),
    );

    const assignments = allocateRoundRobin(
      leads.map((lead) => lead.id),
      candidates,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
    );

    const usersById = new Map(activeScreeners.map((u) => [u.id, u]));
    const now = new Date();
    let redistributed = 0;
    for (const lead of leads) {
      const userId = assignments.get(lead.id);
      if (!userId) continue;
      const user = usersById.get(userId);
      if (!user) continue;

      lead.screenerAssignedTo = user;
      lead.screenerAssignedAt = now;
      lead.leadStatus = inProcessStatus;
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: inProcessStatus,
          remarks: `Lead Auto Allocated to ${user.name}`,
          createdAt: now,
          updatedAt: now,
        }),
      );
      redistributed += 1;
    }

    this.logger.log(
      `${LeadHoldRedistributionService.CRON_NAME}: redistributed ${redistributed}/${leads.length} held lead(s) across ${activeScreeners.length} screeners`,
    );
    return { redistributed };
  }
}
