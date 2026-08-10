import { JOB_RUNNER, type JobRunner } from '@finance-crm/common';
import {
  Lead,
  LeadFollowup,
  LeadUserType,
  MasterStatus,
  RoleType,
  User,
  UserActivityLog,
  UserActivityType,
  UserRole,
} from '@finance-crm/database';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { allocateRoundRobin } from '../shared/round-robin.util';

type Threshold =
  | { kind: 'none' }
  | { kind: 'stale-since-assigned'; hours: number }
  | { kind: 'created-within-minutes'; minutes: number };

export interface AllocateLeadsAndApplicationBandConfig {
  cronName: string;
  cronExpression: string;
  /** Legacy `leadType` — kept only for the doc trail back to
   * `Automate::allocateLeadsAndApplication($leadType, $userType)`. */
  leadType: number;
  /** Exactly one of `sourceStatusName`/`sourceStageCode` is set.
   * `sourceStageCode` is for the `42+*` bands: legacy `lead_status_id=42`
   * has no row in `seed-data/master-statuses.json` (same gap already
   * documented for `ScreenerAllocationService`'s REPEAT band) — matched
   * via `MasterStatus.stageCode='S1'` instead, which may return more than
   * one row. */
  sourceStatusName?: string;
  sourceStageCode?: string;
  targetStatusName: string;
  assignTarget: 'screener' | 'credit';
  roleCode: 'CR1' | 'CR2';
  /** `42+NEW`/`42+REPEAT` further filter by `Lead.userType`; the other
   * bands don't. */
  userTypeFilter?: LeadUserType;
  threshold: Threshold;
  /** `'dynamic'` = legacy's `floor(leadsCount/usersCount) or 1` fallback
   * (leadType 3/6); a number = a fixed per-run cap (leadType 4/42+*). */
  capPerRun: number | 'dynamic';
}

/**
 * Ports `Automate::allocateLeadsAndApplication($leadType, $userType)`
 * (`CronJobs/Automate.php` + `CronJobs/CronLead_Model.php`) — confirmed
 * live via the real production crontab for 5 `(leadType, userType)`
 * combinations, each its own band below. One legacy function, parameterized
 * the same way here.
 *
 * Real behavioral differences from the `CronSanctionController`-based
 * allocation/hold-redistribution jobs elsewhere in this codebase (built
 * from a different legacy file not confirmed present in this crontab —
 * see `docs/TODO.md`'s open client question): no salary banding at all, a
 * uniform 72h threshold for the two hold-redistribution bands (not 48h/
 * 36h), and a genuinely different eligibility gate (below). **Both sets
 * of jobs are scheduled by default** until that question is answered —
 * use `CRON_<NAME>=disabled` (see `ConfigurableJobRunner`) to turn off
 * whichever turns out to be wrong without a redeploy.
 *
 * No working-hours gate — legacy's `allocateLeadsAndApplication()` doesn't
 * have the `intval(date('H')) < 9 ...` check every `CronSanctionController`
 * allocation method has.
 *
 * Roster eligibility, ported for real (schema support already exists):
 * active users with the matching role, **and** a `UserActivityLog` row
 * with `activityType=LOGIN` dated today (`UserActivityLog` is already
 * genuinely written on every login in `core-api`'s `AuthService` — not a
 * gap). Legacy's further `user_roles.lead_allocation_type`/per-role
 * `user_type` sub-splits have no schema equivalent — same simplification
 * already applied to every other allocation job in this codebase (draw
 * from the full eligible pool, no further split).
 *
 * No total per-run cap exists in legacy for this function (unlike the
 * `CronSanctionController` jobs' `bucketSize`) — only a per-user cap,
 * ported via `Number.MAX_SAFE_INTEGER` as `allocateRoundRobin`'s total-run
 * limit, same pattern already used by the hold-redistribution jobs.
 */
@Injectable()
export class AllocateLeadsAndApplicationService implements OnModuleInit {
  private readonly logger = new Logger(AllocateLeadsAndApplicationService.name);

  static readonly BANDS: AllocateLeadsAndApplicationBandConfig[] = [
    {
      cronName: 'allocate-lead-hold-to-screener',
      cronExpression: '0 2 * * *',
      leadType: 3,
      sourceStatusName: 'LEAD-HOLD',
      targetStatusName: 'LEAD-INPROCESS',
      assignTarget: 'screener',
      roleCode: 'CR1',
      threshold: { kind: 'stale-since-assigned', hours: 72 },
      capPerRun: 'dynamic',
    },
    {
      cronName: 'allocate-application-new-to-credit',
      cronExpression: '*/30 * * * *',
      leadType: 4,
      sourceStatusName: 'APPLICATION-NEW',
      targetStatusName: 'APPLICATION-INPROCESS',
      assignTarget: 'credit',
      roleCode: 'CR2',
      userTypeFilter: LeadUserType.NEW,
      threshold: { kind: 'none' },
      capPerRun: 10,
    },
    {
      cronName: 'allocate-application-hold-to-credit',
      cronExpression: '0 2 * * *',
      leadType: 6,
      sourceStatusName: 'APPLICATION-HOLD',
      targetStatusName: 'APPLICATION-INPROCESS',
      assignTarget: 'credit',
      roleCode: 'CR2',
      threshold: { kind: 'stale-since-assigned', hours: 72 },
      capPerRun: 'dynamic',
    },
    {
      cronName: 'allocate-partial-lead-new-to-screener',
      cronExpression: '*/15 * * * *',
      leadType: 42,
      sourceStageCode: 'S1',
      targetStatusName: 'LEAD-INPROCESS',
      assignTarget: 'screener',
      roleCode: 'CR1',
      userTypeFilter: LeadUserType.NEW,
      threshold: { kind: 'created-within-minutes', minutes: 15 },
      capPerRun: 20,
    },
    {
      cronName: 'allocate-partial-lead-repeat-to-credit',
      cronExpression: '*/10 * * * *',
      leadType: 42,
      sourceStageCode: 'S1',
      targetStatusName: 'APPLICATION-INPROCESS',
      assignTarget: 'credit',
      roleCode: 'CR2',
      userTypeFilter: LeadUserType.REPEAT,
      threshold: { kind: 'created-within-minutes', minutes: 15 },
      capPerRun: 10,
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
    @InjectRepository(UserActivityLog)
    private readonly userActivityLogRepository: Repository<UserActivityLog>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
  ) {}

  onModuleInit(): void {
    for (const band of AllocateLeadsAndApplicationService.BANDS) {
      this.jobRunner.schedule(band.cronName, band.cronExpression, async () => {
        await this.runBand(band);
      });
    }
  }

  async runBand(
    band: AllocateLeadsAndApplicationBandConfig,
  ): Promise<{ assigned: number }> {
    const sourceStatusIds = band.sourceStageCode
      ? (
          await this.masterStatusRepository.find({
            where: { stageCode: band.sourceStageCode },
          })
        ).map((s) => s.id)
      : await this.masterStatusRepository
          .findOne({ where: { name: band.sourceStatusName } })
          .then((s) => (s ? [s.id] : []));
    const targetStatus = await this.masterStatusRepository.findOne({
      where: { name: band.targetStatusName },
    });
    if (sourceStatusIds.length === 0 || !targetStatus) {
      this.logger.error(
        `${band.cronName}: missing required '${band.sourceStageCode ?? band.sourceStatusName}'/'${band.targetStatusName}' master_statuses rows`,
      );
      return { assigned: 0 };
    }

    const leadWhere: Record<string, unknown> = {
      leadStatus: { id: In(sourceStatusIds) },
      isActive: true,
      isDeleted: false,
    };
    if (band.userTypeFilter) {
      leadWhere.userType = band.userTypeFilter;
    }
    const assignedAtField =
      band.assignTarget === 'screener'
        ? 'screenerAssignedAt'
        : 'creditAssignedAt';
    if (band.threshold.kind === 'stale-since-assigned') {
      const threshold = new Date(
        Date.now() - band.threshold.hours * 60 * 60 * 1000,
      );
      leadWhere[assignedAtField] = LessThanOrEqual(threshold);
    } else if (band.threshold.kind === 'created-within-minutes') {
      const threshold = new Date(
        Date.now() - band.threshold.minutes * 60 * 1000,
      );
      leadWhere.createdAt = MoreThanOrEqual(threshold);
    }

    const leads = await this.leadRepository.find({
      where: leadWhere,
      relations: { screenerAssignedTo: true },
      order: { createdAt: 'ASC' },
    });
    if (leads.length === 0) {
      this.logger.debug(`${band.cronName}: no eligible leads`);
      return { assigned: 0 };
    }

    const eligibleUsers = await this.getEligibleActiveUsersLoggedInToday(
      band.roleCode,
    );
    if (eligibleUsers.length === 0) {
      this.logger.warn(
        `${band.cronName}: no active ${band.roleCode} users logged in today`,
      );
      return { assigned: 0 };
    }

    const currentLoadField =
      band.assignTarget === 'screener'
        ? 'screenerAssignedTo'
        : 'creditAssignedTo';
    const candidates = await Promise.all(
      eligibleUsers.map(async (user) => ({
        userId: user.id,
        currentLoad: await this.leadRepository.count({
          where: {
            [currentLoadField]: { id: user.id },
            leadStatus: { id: targetStatus.id },
          } as Record<string, unknown>,
        }),
      })),
    );

    const capPerRun =
      band.capPerRun === 'dynamic'
        ? leads.length > eligibleUsers.length
          ? Math.floor(leads.length / eligibleUsers.length)
          : 1
        : band.capPerRun;

    const assignments = allocateRoundRobin(
      leads.map((lead) => lead.id),
      candidates,
      capPerRun,
      Number.MAX_SAFE_INTEGER,
    );

    const usersById = new Map(eligibleUsers.map((u) => [u.id, u]));
    const now = new Date();
    let assigned = 0;
    for (const lead of leads) {
      const userId = assignments.get(lead.id);
      if (!userId) continue;
      const user = usersById.get(userId);
      if (!user) continue;

      lead.leadStatus = targetStatus;
      if (band.assignTarget === 'screener') {
        lead.screenerAssignedTo = user;
        lead.screenerAssignedAt = now;
      } else {
        lead.creditAssignedTo = user;
        lead.creditAssignedAt = now;
        if (!lead.screenerAssignedTo) {
          lead.screenerAssignedTo = user;
          lead.screenerAssignedAt = now;
        }
      }
      await this.leadRepository.save(lead);

      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: targetStatus,
          remarks: `Auto Allocated to ${user.name}`,
          createdAt: now,
          updatedAt: now,
        }),
      );
      assigned += 1;
    }

    this.logger.log(
      `${band.cronName}: assigned ${assigned}/${leads.length} eligible lead(s) across ${eligibleUsers.length} ${band.roleCode} users`,
    );
    return { assigned };
  }

  private async getEligibleActiveUsersLoggedInToday(
    roleCode: 'CR1' | 'CR2',
  ): Promise<User[]> {
    const role = await this.roleTypeRepository.findOne({
      where: { code: roleCode },
    });
    if (!role) {
      this.logger.error(`missing role_types row code='${roleCode}'`);
      return [];
    }

    const roles = await this.userRoleRepository.find({
      where: { roleType: { id: role.id }, isActive: true },
      relations: { user: true },
    });
    const activeUsers = roles.map((ur) => ur.user).filter((u) => u.isActive);
    if (activeUsers.length === 0) return [];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const loginLogs = await this.userActivityLogRepository.find({
      where: {
        user: { id: In(activeUsers.map((u) => u.id)) },
        activityType: UserActivityType.LOGIN,
        occurredAt: MoreThanOrEqual(startOfToday),
      },
      relations: { user: true },
    });
    const loggedInTodayUserIds = new Set(loginLogs.map((log) => log.user.id));

    return activeUsers.filter((u) => loggedInTodayUserIds.has(u.id));
  }
}
