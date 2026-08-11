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
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { allocateRoundRobin } from '../shared/round-robin.util';
import {
  ALLOCATION_WORKING_HOURS,
  isWithinHhmmWindow,
} from '../shared/working-hours.util';

export interface CreditBandConfig {
  cronName: string;
  cronExpression: string;
  userType: LeadUserType;
  minSalary: number;
  maxSalary?: number;
  bucketSize: number;
  cronLimitPerUser: number;
}

/**
 * Ports `creditApllicationAllocationG50K()` / `creditApllicationAllocationB50K()`
 * / `creditApllicationAllocationREPEATNEWLOGICS()` from
 * `CronJobs/CronSanctionController.php` — moves screened applications
 * ("APPLICATION-NEW", legacy `stage='S4'`, or for the REPEAT band also
 * `stage='S1'`, matching legacy's `lead_status_id IN(4,41,42,1)`) to active
 * credit (`RoleType.code='CR2'`) users, banded by monthly salary / user type.
 *
 * Same schema-gap caveats as `ScreenerAllocationService`: no
 * `user_allocation_type_id`-style team split on `UserRole` (all bands draw
 * from the same active-CR2 pool), workload signal is "current
 * APPLICATION-INPROCESS count" rather than a daily allocation-log counter,
 * and the customer/CTO notification emails have no matching
 * `integrations-api` endpoint (logged, not sent — see TODO.md).
 *
 * **G50K/B50K/REPEAT disabled by default** — confirmed absent from the
 * real production crontab (see `docs/TODO.md`);
 * `AllocateLeadsAndApplicationService` covers this same
 * Application-New-to-credit purpose there instead. Built and tested, off
 * everywhere unless `CRON_CREDIT_APPLICATION_ALLOCATION_G50K`/`..._B50K`/
 * `..._REPEAT` is set to a real cron expression.
 *
 * The former `credeauAllocation()` band (`credeau-application-allocation`,
 * confirmed live in the same crontab every 30 minutes) was removed
 * client-confirmed unused (see `docs/EXCLUDED.md`) — it targeted
 * straight-through (`lead_creation_mode=1`) NEW leads with no salary
 * threshold and stage codes S1/S4.
 */
@Injectable()
export class CreditApplicationAllocationService implements OnModuleInit {
  private readonly logger = new Logger(CreditApplicationAllocationService.name);

  static readonly BANDS: CreditBandConfig[] = [
    {
      cronName: 'credit-application-allocation-g50k',
      cronExpression: 'disabled',
      userType: LeadUserType.NEW,
      minSalary: 50000,
      bucketSize: 100,
      cronLimitPerUser: 10,
    },
    {
      cronName: 'credit-application-allocation-b50k',
      cronExpression: 'disabled',
      userType: LeadUserType.NEW,
      minSalary: 30000,
      maxSalary: 50000,
      bucketSize: 100,
      cronLimitPerUser: 20,
    },
    {
      cronName: 'credit-application-allocation-repeat',
      cronExpression: 'disabled',
      userType: LeadUserType.REPEAT,
      minSalary: 26000,
      bucketSize: 1000,
      cronLimitPerUser: 50,
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
    for (const band of CreditApplicationAllocationService.BANDS) {
      this.jobRunner.schedule(band.cronName, band.cronExpression, async () => {
        await this.runBand(band);
      });
    }
  }

  async runBand(band: CreditBandConfig): Promise<{ assigned: number }> {
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

    const eligibleStageCodes =
      band.userType === LeadUserType.REPEAT ? ['S1', 'S4'] : ['S4'];
    const sourceStatuses = await this.masterStatusRepository.find({
      where: { stageCode: In(eligibleStageCodes) },
    });
    if (sourceStatuses.length === 0) {
      this.logger.warn(
        `${band.cronName}: no master_statuses rows for stageCode(s) ${eligibleStageCodes.join(',')}`,
      );
      return { assigned: 0 };
    }
    const applicationInProcessStatus =
      await this.masterStatusRepository.findOne({
        where: { name: 'APPLICATION-INPROCESS' },
      });
    if (!applicationInProcessStatus) {
      this.logger.error(
        `${band.cronName}: missing required master_statuses row 'APPLICATION-INPROCESS'`,
      );
      return { assigned: 0 };
    }

    const leadWhere: Record<string, unknown> = {
      userType: band.userType,
      leadStatus: { id: In(sourceStatuses.map((s) => s.id)) },
      creditAssignedTo: IsNull(),
      isActive: true,
      isDeleted: false,
    };
    leadWhere.monthlySalaryAmount = MoreThanOrEqual(band.minSalary);

    let leads = await this.leadRepository.find({
      where: leadWhere,
      relations: { screenerAssignedTo: true },
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

    if (leads.length === 0) {
      this.logger.debug(`${band.cronName}: no eligible applications`);
      return { assigned: 0 };
    }

    const creditRole = await this.roleTypeRepository.findOne({
      where: { code: 'CR2' },
    });
    if (!creditRole) {
      this.logger.error(`${band.cronName}: missing role_types row code='CR2'`);
      return { assigned: 0 };
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
      return { assigned: 0 };
    }

    const candidates = await Promise.all(
      activeCreditUsers.map(async (user) => ({
        userId: user.id,
        currentLoad: await this.leadRepository.count({
          where: {
            creditAssignedTo: { id: user.id },
            leadStatus: { id: applicationInProcessStatus.id },
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

    const usersById = new Map(activeCreditUsers.map((u) => [u.id, u]));
    const now = new Date();
    let assigned = 0;
    for (const lead of leads) {
      const userId = assignments.get(lead.id);
      if (!userId) continue;
      const user = usersById.get(userId);
      if (!user) continue;

      lead.creditAssignedTo = user;
      lead.creditAssignedAt = now;
      lead.leadStatus = applicationInProcessStatus;
      if (!lead.screenerAssignedTo) {
        lead.screenerAssignedTo = user;
        lead.screenerAssignedAt = now;
      }
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: applicationInProcessStatus,
          remarks: `Application Auto Allocated to ${user.name}`,
          createdAt: now,
          updatedAt: now,
        }),
      );
      assigned += 1;
    }

    this.logger.log(
      `${band.cronName}: assigned ${assigned}/${leads.length} eligible applications across ${activeCreditUsers.length} credit users`,
    );
    return { assigned };
  }
}
