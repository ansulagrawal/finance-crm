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

export interface ApplicationHoldBandConfig {
  cronName: string;
  minSalary: number;
  maxSalary?: number;
}

/**
 * Ports `move_application_hold_to_credit_G50K()` /
 * `move_application_hold_to_credit_B50K()` from
 * `CronSanctionController.php` — redistributes applications stuck in
 * `APPLICATION-HOLD` (legacy `lead_status_id=6`, `stage='S6'`) back into
 * the active credit (`RoleType.code='CR2'`) pool, banded by monthly
 * salary, load-balanced round robin — same pattern as
 * `CreditApplicationAllocationService`'s initial allocation.
 *
 * Legacy roster was two hardcoded named-employee arrays (one per band,
 * with an even older commented-out roster above each) — per explicit
 * product decision, this port queries the live active-CR2 roster instead
 * for both bands (this schema has no `user_allocation_type_id`-style team
 * split, same documented gap as `CreditApplicationAllocationService`).
 *
 * TAT threshold bug ported faithfully: both legacy callers invoke
 * `get_application_hold(48)`, but that model method's signature is
 * `get_application_hold($type = 0, $set_hours = 0)` — so `48` binds to
 * `$type` (which only has special-cased behaviour for `1`/`2`, so `48`
 * changes nothing) and `$set_hours` falls through to its `0` default,
 * which the method's own `empty($set_hours)` check treats as "use 36".
 * The real enforced threshold is therefore **36 hours**, not 48 (the
 * `lead_followup` remark text even says "TAT 48 HOURS COMPLETED", which is
 * simply wrong). This port uses the real 36-hour threshold and states it
 * correctly in the remark, matching the same
 * documented-not-silently-fixed convention used in `LeadRejectionService`.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`); `AllocateLeadsAndApplicationService`
 * covers this same Application-Hold-to-credit purpose there instead. Built
 * and tested, off everywhere unless
 * `CRON_APPLICATION_HOLD_REDISTRIBUTION_G50K`/`..._B50K` is set to a real
 * cron expression.
 */
@Injectable()
export class ApplicationHoldRedistributionService implements OnModuleInit {
  private readonly logger = new Logger(
    ApplicationHoldRedistributionService.name,
  );

  static readonly TAT_HOURS = 36;
  static readonly CRON_EXPRESSION = 'disabled';
  static readonly BANDS: ApplicationHoldBandConfig[] = [
    { cronName: 'application-hold-redistribution-g50k', minSalary: 50000 },
    {
      cronName: 'application-hold-redistribution-b50k',
      minSalary: 0,
      maxSalary: 50000,
    },
  ];

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
    for (const band of ApplicationHoldRedistributionService.BANDS) {
      this.jobRunner.schedule(
        band.cronName,
        ApplicationHoldRedistributionService.CRON_EXPRESSION,
        async () => {
          await this.runBand(band);
        },
      );
    }
  }

  async runBand(
    band: ApplicationHoldBandConfig,
  ): Promise<{ redistributed: number }> {
    const holdStatus = await this.masterStatusRepository.findOne({
      where: { name: 'APPLICATION-HOLD' },
    });
    const inProcessStatus = await this.masterStatusRepository.findOne({
      where: { name: 'APPLICATION-INPROCESS' },
    });
    if (!holdStatus || !inProcessStatus) {
      this.logger.error(
        `${band.cronName}: missing required 'APPLICATION-HOLD'/'APPLICATION-INPROCESS' master_statuses rows`,
      );
      return { redistributed: 0 };
    }

    const threshold = new Date(
      Date.now() -
        ApplicationHoldRedistributionService.TAT_HOURS * 60 * 60 * 1000,
    );

    let leads = await this.leadRepository.find({
      where: {
        leadStatus: { id: holdStatus.id },
        userType: LeadUserType.NEW,
        creditAssignedAt: LessThanOrEqual(threshold),
        isActive: true,
        isDeleted: false,
      },
      order: { creditAssignedAt: 'ASC' },
    });
    leads = leads.filter(
      (lead) => (lead.monthlySalaryAmount ?? 0) >= band.minSalary,
    );
    if (band.maxSalary) {
      leads = leads.filter(
        (lead) => (lead.monthlySalaryAmount ?? 0) < (band.maxSalary as number),
      );
    }

    if (leads.length === 0) {
      this.logger.debug(
        `${band.cronName}: no applications past the TAT threshold`,
      );
      return { redistributed: 0 };
    }

    const creditRole = await this.roleTypeRepository.findOne({
      where: { code: 'CR2' },
    });
    if (!creditRole) {
      this.logger.error(`${band.cronName}: missing role_types row code='CR2'`);
      return { redistributed: 0 };
    }
    const creditRoles = await this.userRoleRepository.find({
      where: { roleType: { id: creditRole.id }, isActive: true },
      relations: { user: true },
    });
    const activeCreditUsers = creditRoles
      .map((ur) => ur.user)
      .filter((user) => user.isActive);
    if (activeCreditUsers.length === 0) {
      this.logger.warn(`${band.cronName}: no active CR2 credit users`);
      return { redistributed: 0 };
    }

    const candidates = await Promise.all(
      activeCreditUsers.map(async (user) => ({
        userId: user.id,
        currentLoad: await this.leadRepository.count({
          where: {
            creditAssignedTo: { id: user.id },
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

    const usersById = new Map(activeCreditUsers.map((u) => [u.id, u]));
    const now = new Date();
    let redistributed = 0;
    for (const lead of leads) {
      const userId = assignments.get(lead.id);
      if (!userId) continue;
      const user = usersById.get(userId);
      if (!user) continue;

      lead.creditAssignedTo = user;
      lead.creditAssignedAt = now;
      lead.leadStatus = inProcessStatus;
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: inProcessStatus,
          remarks: `Application Auto Moved to ${user.name} - REASON: TAT ${ApplicationHoldRedistributionService.TAT_HOURS} HOURS COMPLETED`,
          createdAt: now,
          updatedAt: now,
        }),
      );
      redistributed += 1;
    }

    this.logger.log(
      `${band.cronName}: redistributed ${redistributed}/${leads.length} held application(s) across ${activeCreditUsers.length} credit users`,
    );
    return { redistributed };
  }
}
