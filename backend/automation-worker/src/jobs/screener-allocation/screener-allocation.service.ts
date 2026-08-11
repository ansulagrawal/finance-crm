import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Lead,
  DataSource as LeadDataSource,
  LeadFollowup,
  LeadUserType,
  MasterStatus,
  RoleType,
  UserRole,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { allocateRoundRobin } from '../shared/round-robin.util';
import {
  ALLOCATION_WORKING_HOURS,
  isWithinHhmmWindow,
} from '../shared/working-hours.util';

export interface ScreenerBandConfig {
  cronName: string;
  cronExpression: string;
  minSalary: number;
  maxSalary?: number;
  bucketSize: number;
  cronLimitPerUser: number;
}

/**
 * Ports `screenerLeadAllocationG50K()` / `screenerLeadAllocationB50K()` from
 * `CronSanctionController.php` — auto-assigns NEW leads still at the
 * "LEAD-NEW" stage (legacy `stage='S1'`) to active screener (`RoleType.code
 * = 'CR1'`) users, load-balanced round robin, banded by monthly salary.
 *
 * Schema gaps / deliberate deviations from legacy, documented here and in
 * TODO.md:
 * - Legacy split screener teams by `user_roles.user_allocation_type_id`
 *   (an "above 50k" vs "below 50k" specialist roster). This schema's
 *   `UserRole` has no such column, so both bands draw from the same pool of
 *   active CR1 users — the salary-band filter still applies to the leads,
 *   just not to which screeners are eligible.
 * - Legacy tracked each user's "today's allocation count" via a separate
 *   `user_lead_allocation_log` table (not in this schema). This port uses
 *   each user's current count of LEAD-INPROCESS leads as the load signal —
 *   a reasonable proxy for "current workload" but not an exact port of the
 *   daily counter.
 * - Legacy excluded `lead_data_source_id != 17` (data source "AffiliatesApp"
 *   / code AFFAPP, confirmed via `seed-data/data-sources.json`) — ported.
 * - Legacy's inner recheck matched `lead_status_id IN (1,41,42)` (all
 *   stage S1). Status id 42 has no row in `seed-data/master-statuses.json`
 *   (a seed-data gap) — this port matches on `MasterStatus.stageCode='S1'`
 *   instead, which naturally covers whichever S1 statuses exist and isn't
 *   affected by the missing id 42.
 * - Customer-facing "your case handler is X" email
 *   (`lead_allocation_email_notification`) and the CTO ops-summary email
 *   (`middlewareEmail`) have no matching `integrations-api` endpoint today
 *   (only OTP SMS / thank-you email / repayment-reminder WhatsApp exist) —
 *   logged via `Logger` instead of a fabricated vendor call. See TODO.md.
 *
 * **Disabled by default** — confirmed absent from the real production
 * crontab (see `docs/TODO.md`); `AllocateLeadsAndApplicationService`
 * covers this same Lead-New-to-screener purpose there instead. Built and
 * tested, off everywhere unless `CRON_SCREENER_LEAD_ALLOCATION_G50K`/
 * `..._B50K` is set to a real cron expression.
 */
@Injectable()
export class ScreenerAllocationService implements OnModuleInit {
  private readonly logger = new Logger(ScreenerAllocationService.name);

  static readonly BANDS: ScreenerBandConfig[] = [
    {
      cronName: 'screener-lead-allocation-g50k',
      cronExpression: 'disabled',
      minSalary: 50000,
      bucketSize: 100,
      cronLimitPerUser: 20,
    },
    {
      cronName: 'screener-lead-allocation-b50k',
      cronExpression: 'disabled',
      minSalary: 26000,
      maxSalary: 50000,
      bucketSize: 150,
      cronLimitPerUser: 20,
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
    @InjectRepository(LeadDataSource)
    private readonly dataSourceRepository: Repository<LeadDataSource>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
  ) {}

  onModuleInit(): void {
    for (const band of ScreenerAllocationService.BANDS) {
      this.jobRunner.schedule(band.cronName, band.cronExpression, async () => {
        await this.runBand(band);
      });
    }
  }

  async runBand(band: ScreenerBandConfig): Promise<{ assigned: number }> {
    if (
      !isWithinHhmmWindow(
        new Date(),
        ALLOCATION_WORKING_HOURS.start,
        ALLOCATION_WORKING_HOURS.end,
      )
    ) {
      this.logger.debug(`${band.cronName}: outside working hours, skipping`);
      return { assigned: 0 };
    }

    const leadNewStatuses = await this.masterStatusRepository.find({
      where: { stageCode: 'S1' },
    });
    if (leadNewStatuses.length === 0) {
      this.logger.warn(
        `${band.cronName}: no master_statuses row with stageCode='S1' found, nothing to allocate`,
      );
      return { assigned: 0 };
    }
    const leadInProcessStatus = await this.masterStatusRepository.findOne({
      where: { name: 'LEAD-INPROCESS' },
    });
    if (!leadInProcessStatus) {
      this.logger.error(
        `${band.cronName}: missing required master_statuses row 'LEAD-INPROCESS'`,
      );
      return { assigned: 0 };
    }

    const affiliatesDataSource = await this.dataSourceRepository.findOne({
      where: { code: 'AFFAPP' },
    });

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const leadWhere = {
      userType: LeadUserType.NEW,
      leadStatus: { id: In(leadNewStatuses.map((s) => s.id)) },
      screenerAssignedTo: IsNull(),
      createdAt: LessThanOrEqual(thirtyMinutesAgo),
      isActive: true,
      isDeleted: false,
      monthlySalaryAmount: MoreThanOrEqual(band.minSalary),
    };

    let leads = await this.leadRepository.find({
      where: leadWhere,
      relations: { dataSource: true },
      order: { createdAt: 'ASC' },
      take: band.bucketSize,
    });
    if (band.maxSalary) {
      leads = leads.filter(
        (lead) =>
          lead.monthlySalaryAmount !== null &&
          lead.monthlySalaryAmount < (band.maxSalary as number),
      );
    }
    if (affiliatesDataSource) {
      leads = leads.filter(
        (lead) => lead.dataSource?.id !== affiliatesDataSource.id,
      );
    }

    if (leads.length === 0) {
      this.logger.debug(`${band.cronName}: no eligible leads`);
      return { assigned: 0 };
    }

    const screenerRole = await this.roleTypeRepository.findOne({
      where: { code: 'CR1' },
    });
    if (!screenerRole) {
      this.logger.error(`${band.cronName}: missing role_types row code='CR1'`);
      return { assigned: 0 };
    }

    const screenerRoles = await this.userRoleRepository.find({
      where: { roleType: { id: screenerRole.id }, isActive: true },
      relations: { user: true },
    });
    const activeScreeners = screenerRoles
      .map((ur) => ur.user)
      .filter((user) => user.isActive);

    if (activeScreeners.length === 0) {
      this.logger.warn(`${band.cronName}: no active CR1 screener users`);
      return { assigned: 0 };
    }

    const candidates = await Promise.all(
      activeScreeners.map(async (user) => ({
        userId: user.id,
        currentLoad: await this.leadRepository.count({
          where: {
            screenerAssignedTo: { id: user.id },
            leadStatus: { id: leadInProcessStatus.id },
          },
        }),
      })),
    );

    const assignments = allocateRoundRobin(
      leads.map((lead) => lead.id),
      candidates,
      band.cronLimitPerUser,
      band.bucketSize,
    );

    const usersById = new Map(activeScreeners.map((u) => [u.id, u]));
    const now = new Date();
    let assigned = 0;
    for (const lead of leads) {
      const userId = assignments.get(lead.id);
      if (!userId) continue;
      const user = usersById.get(userId);
      if (!user) continue;

      lead.screenerAssignedTo = user;
      lead.screenerAssignedAt = now;
      lead.leadStatus = leadInProcessStatus;
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: leadInProcessStatus,
          remarks: `Lead Auto Allocated to ${user.name}`,
          createdAt: now,
          updatedAt: now,
        }),
      );
      assigned += 1;
    }

    this.logger.log(
      `${band.cronName}: assigned ${assigned}/${leads.length} eligible leads across ${activeScreeners.length} screeners`,
    );
    return { assigned };
  }
}
