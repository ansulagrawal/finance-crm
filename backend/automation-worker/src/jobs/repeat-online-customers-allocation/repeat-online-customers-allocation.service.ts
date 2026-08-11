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
import { IsNull, Repository } from 'typeorm';
import { allocateRoundRobin } from '../shared/round-robin.util';
import { isWithinHhmmWindow } from '../shared/working-hours.util';

/** 07:00-23:30 — this job's own window, distinct from the 09:00-23:30 used
 * by every other allocation job in this codebase. */
const WORKING_HOURS = { start: 700, end: 2330 } as const;

/**
 * Ports `CronSanctionController::RepeatOnlineCustomersAllocation()`
 * (`CronJobs/CronSanctionController.php`) — confirmed live via the real
 * production crontab (every 2 minutes). Moves REPEAT-customer leads
 * flagged for direct disbursal (`Lead.leadDirectDisbursal`, legacy
 * `lead_direct_disbursal=1`) out of DISBURSAL-NEW (legacy
 * `lead_status_id=25`) into credit review.
 *
 * Roster: legacy's `get_online_users_repeat_list()` is gated on a
 * hardcoded `user_id IN (70,136,129)` plus active-CR2-role — per the same
 * "hardcoded roster → live role" precedent already applied to TAT-hold
 * redistribution and the credit-application-allocation bands, this job
 * draws from the full active-CR2 pool instead.
 *
 * If `screenerAssignedTo` is unset, also assigns as screener — same
 * pattern as `CreditApplicationAllocationService`.
 */
@Injectable()
export class RepeatOnlineCustomersAllocationService implements OnModuleInit {
  private readonly logger = new Logger(
    RepeatOnlineCustomersAllocationService.name,
  );

  static readonly CRON_NAME = 'repeat-online-customers-allocation';
  static readonly CRON_EXPRESSION = '*/2 * * * *';
  static readonly BUCKET_SIZE = 1000;
  static readonly CRON_LIMIT_PER_USER = 25;

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
      RepeatOnlineCustomersAllocationService.CRON_NAME,
      RepeatOnlineCustomersAllocationService.CRON_EXPRESSION,
      async () => {
        await this.run();
      },
    );
  }

  async run(): Promise<{ assigned: number }> {
    if (
      !isWithinHhmmWindow(new Date(), WORKING_HOURS.start, WORKING_HOURS.end)
    ) {
      this.logger.debug(
        `${RepeatOnlineCustomersAllocationService.CRON_NAME}: outside working hours, skipping`,
      );
      return { assigned: 0 };
    }

    const disbursalNewStatus = await this.masterStatusRepository.findOne({
      where: { name: 'DISBURSAL-NEW' },
    });
    const applicationInProcessStatus =
      await this.masterStatusRepository.findOne({
        where: { name: 'APPLICATION-INPROCESS' },
      });
    if (!disbursalNewStatus || !applicationInProcessStatus) {
      this.logger.error(
        `${RepeatOnlineCustomersAllocationService.CRON_NAME}: missing required 'DISBURSAL-NEW'/'APPLICATION-INPROCESS' master_statuses rows`,
      );
      return { assigned: 0 };
    }

    const leads = await this.leadRepository.find({
      where: {
        userType: LeadUserType.REPEAT,
        leadDirectDisbursal: true,
        leadStatus: { id: disbursalNewStatus.id },
        creditAssignedTo: IsNull(),
        isActive: true,
        isDeleted: false,
      },
      relations: { screenerAssignedTo: true },
      order: { createdAt: 'ASC' },
      take: RepeatOnlineCustomersAllocationService.BUCKET_SIZE,
    });
    if (leads.length === 0) {
      this.logger.debug(
        `${RepeatOnlineCustomersAllocationService.CRON_NAME}: no eligible direct-disbursal leads`,
      );
      return { assigned: 0 };
    }

    const creditRole = await this.roleTypeRepository.findOne({
      where: { code: 'CR2' },
    });
    if (!creditRole) {
      this.logger.error(
        `${RepeatOnlineCustomersAllocationService.CRON_NAME}: missing role_types row code='CR2'`,
      );
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
      this.logger.warn(
        `${RepeatOnlineCustomersAllocationService.CRON_NAME}: no active CR2 credit users`,
      );
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
      RepeatOnlineCustomersAllocationService.CRON_LIMIT_PER_USER,
      RepeatOnlineCustomersAllocationService.BUCKET_SIZE,
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
      `${RepeatOnlineCustomersAllocationService.CRON_NAME}: assigned ${assigned}/${leads.length} direct-disbursal application(s) across ${activeCreditUsers.length} credit users`,
    );
    return { assigned };
  }
}
