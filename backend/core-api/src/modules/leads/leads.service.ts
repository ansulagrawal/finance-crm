import type { PaginatedResult } from '@finance-crm/common';
import { findOrFail, IntegrationsApiClient } from '@finance-crm/common';
import {
  Branch,
  City,
  Company,
  DataSource,
  Lead,
  LeadCustomer,
  LeadCustomerReference,
  LeadEmployment,
  LeadFollowup,
  MaritalStatus,
  MasterStatus,
  Occupation,
  Product,
  Qualification,
  RejectionReason,
  Religion,
  State,
  User,
  UserRoleLocation,
  UserRoleLocationType,
} from '@finance-crm/database';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import { AssignLeadDto, LeadAssignmentStage } from './dto/assign-lead.dto';
import { ChangeLeadStatusDto } from './dto/change-lead-status.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreateLeadCustomerReferenceDto } from './dto/create-lead-customer-reference.dto';
import { CreateLeadFollowupDto } from './dto/create-lead-followup.dto';
import { ListLeadFollowupsQueryDto } from './dto/list-lead-followups-query.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { RejectLeadDto } from './dto/reject-lead.dto';
import { SelfAllocateLeadsDto } from './dto/self-allocate-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpsertLeadCustomerDto } from './dto/upsert-lead-customer.dto';
import { UpsertLeadEmploymentDto } from './dto/upsert-lead-employment.dto';

const LEAD_RELATIONS = {
  company: true,
  product: true,
  dataSource: true,
  state: true,
  city: true,
  branch: true,
  leadStatus: true,
  rejectionReason: true,
  screenerAssignedTo: true,
  creditAssignedTo: true,
  disbursalAssignedTo: true,
  rejectedBy: true,
} as const;

interface QueueRoleScope {
  /** `MasterStatus.stageCode` values this role's queue covers, ported
   * from legacy `TaskController.php`'s `index()` role blocks (lines
   * 39-408). */
  stageCodes: string[];
  /** When set, this role only sees leads assigned to them for these
   * stages; when omitted, the role sees every lead in these stages
   * regardless of assignee (matches CO1/CO3's legacy `where_in` with no
   * assignee filter). */
  assigneeRelation?:
    | 'screenerAssignedTo'
    | 'creditAssignedTo'
    | 'disbursalAssignedTo';
  /** When set, this role only sees leads whose `state` is one they cover
   * per `UserRoleLocation` (mirrors `FieldVerificationService`'s
   * `coveredStateIds` — same entity, same CO2 "State Collection Manager"
   * semantics, since this entity has no stored per-lead SCM assignment). */
  stateScoped?: boolean;
}

/** `AM`/`AH`'s audit-stage queue is already handled by `GET /audit/queue`
 * — not duplicated here. Non-stage pool routes are out of scope. */
const QUEUE_ROLE_SCOPES: Record<string, QueueRoleScope> = {
  CR1: {
    stageCodes: ['S2', 'S3', 'S9'],
    assigneeRelation: 'screenerAssignedTo',
  },
  CR2: {
    stageCodes: ['S4', 'S5', 'S6', 'S9', 'S10', 'S11', 'S12', 'S14', 'S21'],
    assigneeRelation: 'creditAssignedTo',
  },
  CO1: { stageCodes: ['S12', 'S13', 'S14', 'S16'] },
  CO2: { stageCodes: ['S12', 'S13', 'S14', 'S16'], stateScoped: true },
  CO3: { stageCodes: ['S12', 'S13', 'S14', 'S16'] },
  DS1: {
    stageCodes: ['S13', 'S20', 'S21', 'S22', 'S25'],
    assigneeRelation: 'disbursalAssignedTo',
  },
};

interface SelfAllocateRule {
  /** Beyond `CA`/`SA`, which always self-allocate any queue — matches
   * legacy's `$label == 'X' || $label == 'CA' || $label == 'SA'`. */
  authorizingRoles: string[];
  /** Set for the SCREENER target — legacy status ids 41/42/1 (LEAD-NEW
   * plus the two unseeded partial-lead ids) all share `stageCode='S1'`,
   * same substitution used elsewhere in this codebase. */
  sourceStageCode?: string;
  /** Set for CREDIT/DISBURSAL — a single named "New" status. */
  sourceStatusName?: string;
  targetStatusName: string;
}

const SELF_ALLOCATE_RULES: Record<LeadAssignmentStage, SelfAllocateRule> = {
  [LeadAssignmentStage.SCREENER]: {
    authorizingRoles: ['CR1'],
    sourceStageCode: 'S1',
    targetStatusName: 'LEAD-INPROCESS',
  },
  [LeadAssignmentStage.CREDIT]: {
    authorizingRoles: ['CR2'],
    sourceStatusName: 'APPLICATION-NEW',
    targetStatusName: 'APPLICATION-INPROCESS',
  },
  [LeadAssignmentStage.DISBURSAL]: {
    authorizingRoles: ['DS1', 'DS2'],
    sourceStatusName: 'DISBURSAL-NEW',
    targetStatusName: 'DISBURSAL-INPROCESS',
  },
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(LeadEmployment)
    private readonly leadEmploymentRepository: Repository<LeadEmployment>,
    @InjectRepository(LeadCustomerReference)
    private readonly leadCustomerReferenceRepository: Repository<LeadCustomerReference>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(DataSource)
    private readonly dataSourceRepository: Repository<DataSource>,
    @InjectRepository(State)
    private readonly stateRepository: Repository<State>,
    @InjectRepository(City)
    private readonly cityRepository: Repository<City>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(RejectionReason)
    private readonly rejectionReasonRepository: Repository<RejectionReason>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MaritalStatus)
    private readonly maritalStatusRepository: Repository<MaritalStatus>,
    @InjectRepository(Qualification)
    private readonly qualificationRepository: Repository<Qualification>,
    @InjectRepository(Religion)
    private readonly religionRepository: Repository<Religion>,
    @InjectRepository(Occupation)
    private readonly occupationRepository: Repository<Occupation>,
    @InjectRepository(UserRoleLocation)
    private readonly userRoleLocationRepository: Repository<UserRoleLocation>,
    private readonly integrationsApiClient: IntegrationsApiClient,
  ) {}

  /** Shared by `list()`/`listQueue()` — a plain object `where` combined
   * with an OR'd `search` and TypeORM's `relations` triggers a broken
   * pagination path (`getManyAndCount` builds a DISTINCT-id subquery whose
   * `skip`/`take` binding ends up `NaN`, throwing `Unknown column 'NaN'
   * in 'WHERE'` — reproduced live searching leads by mobile). A
   * `QueryBuilder` with explicit `leftJoinAndSelect`s sidesteps that path
   * entirely, same as `listQueue()` already did before this existed. */
  private baseLeadQueryBuilder() {
    return this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.company', 'company')
      .leftJoinAndSelect('lead.product', 'product')
      .leftJoinAndSelect('lead.dataSource', 'dataSource')
      .leftJoinAndSelect('lead.state', 'state')
      .leftJoinAndSelect('lead.city', 'city')
      .leftJoinAndSelect('lead.branch', 'branch')
      .leftJoinAndSelect('lead.leadStatus', 'leadStatus')
      .leftJoinAndSelect('lead.rejectionReason', 'rejectionReason')
      .leftJoinAndSelect('lead.screenerAssignedTo', 'screenerAssignedTo')
      .leftJoinAndSelect('lead.creditAssignedTo', 'creditAssignedTo')
      .leftJoinAndSelect('lead.disbursalAssignedTo', 'disbursalAssignedTo')
      .leftJoinAndSelect('lead.rejectedBy', 'rejectedBy');
  }

  /** The filters common to `list()` and `listQueue()`, applied on top of
   * whatever scope/base condition each already set on `qb`. Matches a
   * `search` term against `firstName`/`mobile`/`email` — not just
   * `firstName` — since the frontend's own placeholder text ("Search by
   * name, mobile, email…") on six different pages already promised all
   * three. `leadStatusId` is included here since both methods support it;
   * `stageCode` is `list()`-only (`listQueue()`'s role scope already
   * restricts by stage). */
  private applyLeadFilters(
    qb: ReturnType<LeadsService['baseLeadQueryBuilder']>,
    query: ListLeadsQueryDto,
  ): void {
    if (query.search) {
      qb.andWhere(
        new Brackets((searchQb) => {
          searchQb
            .where('lead.firstName LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('lead.mobile LIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('lead.email LIKE :search', {
              search: `%${query.search}%`,
            });
        }),
      );
    }
    if (query.companyId) {
      qb.andWhere('company.id = :companyId', { companyId: query.companyId });
    }
    if (query.productId) {
      qb.andWhere('product.id = :productId', { productId: query.productId });
    }
    if (query.leadStatusId) {
      qb.andWhere('leadStatus.id = :leadStatusId', {
        leadStatusId: query.leadStatusId,
      });
    }
    if (query.screenerAssignedToId) {
      qb.andWhere('screenerAssignedTo.id = :screenerAssignedToId', {
        screenerAssignedToId: query.screenerAssignedToId,
      });
    }
    if (query.creditAssignedToId) {
      qb.andWhere('creditAssignedTo.id = :creditAssignedToId', {
        creditAssignedToId: query.creditAssignedToId,
      });
    }
    if (query.disbursalAssignedToId) {
      qb.andWhere('disbursalAssignedTo.id = :disbursalAssignedToId', {
        disbursalAssignedToId: query.disbursalAssignedToId,
      });
    }
    if (query.isBlacklisted !== undefined) {
      qb.andWhere('lead.isBlacklisted = :isBlacklisted', {
        isBlacklisted: query.isBlacklisted,
      });
    }
    if (query.rejectionReasonId) {
      qb.andWhere('rejectionReason.id = :rejectionReasonId', {
        rejectionReasonId: query.rejectionReasonId,
      });
    }
  }

  async list(query: ListLeadsQueryDto): Promise<PaginatedResult<Lead>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.baseLeadQueryBuilder();
    this.applyLeadFilters(qb, query);
    // A specific leadStatusId already implies whichever stageCode it
    // belongs to, so it takes priority over the broader stageCode set
    // when both are given rather than the two silently clobbering each
    // other.
    if (!query.leadStatusId && query.stageCode?.length) {
      qb.andWhere('leadStatus.stageCode IN (:...stageCodes)', {
        stageCodes: query.stageCode,
      });
    }

    const [data, total] = await qb
      .orderBy('lead.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, page, limit, total };
  }

  /**
   * Ports `TaskController.php`'s `index()` role-based queue filtering —
   * each role sees only the lead stages relevant to their job, scoped to
   * "assigned to me" or "all leads in these stages" per
   * `QUEUE_ROLE_SCOPES`. A user can hold multiple roles; their queue is
   * the union (OR) of every matched role's scope. Falls back to the
   * unrestricted `list()` for roles with no defined queue (`SA`/`CA`/
   * anything else) — same as today's behavior, not a silent empty list.
   */
  async listQueue(
    query: ListLeadsQueryDto,
    actingUserId: number,
    roles: string[],
  ): Promise<PaginatedResult<Lead>> {
    const matchedScopes = roles
      .map((role) => QUEUE_ROLE_SCOPES[role])
      .filter((scope): scope is QueueRoleScope => Boolean(scope));

    if (matchedScopes.length === 0) {
      return this.list(query);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const coveredStateIds = matchedScopes.some((scope) => scope.stateScoped)
      ? await this.coveredStateIds(actingUserId, 'CO2')
      : [];
    const effectiveScopes = matchedScopes.filter(
      (scope) => !scope.stateScoped || coveredStateIds.length > 0,
    );
    if (effectiveScopes.length === 0) {
      return { data: [], page, limit, total: 0 };
    }

    const qb = this.baseLeadQueryBuilder();

    qb.andWhere(
      new Brackets((scopeQb) => {
        effectiveScopes.forEach((scope, index) => {
          const stageParam = `stageCodes${index}`;
          const params: Record<string, unknown> = {
            [stageParam]: scope.stageCodes,
          };
          let condition = `leadStatus.stageCode IN (:...${stageParam})`;
          if (scope.assigneeRelation) {
            condition += ` AND ${scope.assigneeRelation}.id = :actingUserId`;
            params.actingUserId = actingUserId;
          }
          if (scope.stateScoped) {
            const stateParam = `stateIds${index}`;
            condition += ` AND state.id IN (:...${stateParam})`;
            params[stateParam] = coveredStateIds;
          }
          if (index === 0) {
            scopeQb.where(condition, params);
          } else {
            scopeQb.orWhere(condition, params);
          }
        });
      }),
    );

    this.applyLeadFilters(qb, query);

    const [data, total] = await qb
      .orderBy('lead.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, page, limit, total };
  }

  /** Mirrors `FieldVerificationService`'s `coveredStateIds` — same
   * `UserRoleLocation` entity, same "no stored per-lead SCM assignment,
   * compute live" reasoning. */
  private async coveredStateIds(
    actingUserId: number,
    roleCode: string,
  ): Promise<number[]> {
    const locations = await this.userRoleLocationRepository.find({
      where: {
        locationType: UserRoleLocationType.STATE,
        userRole: { user: { id: actingUserId }, roleType: { code: roleCode } },
      },
      relations: { userRole: { user: true, roleType: true } },
    });
    return locations.map((location) => location.locationId);
  }

  async findById(id: number): Promise<Lead> {
    const lead = await this.leadRepository.findOne({
      where: { id },
      relations: LEAD_RELATIONS,
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }
    return lead;
  }

  async create(dto: CreateLeadDto): Promise<Lead> {
    const lead = this.leadRepository.create({
      firstName: dto.firstName,
      mobile: dto.mobile,
      email: dto.email ?? null,
      pancard: dto.pancard ?? null,
      loanAmount: dto.loanAmount ?? null,
      tenureDays: dto.tenureDays ?? null,
      purpose: dto.purpose ?? null,
      userType: dto.userType,
      pincode: dto.pincode ?? null,
      source: dto.source ?? null,
      utmSource: dto.utmSource ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmTerm: dto.utmTerm ?? null,
      // Legacy `leads.status`/`stage` are NOT NULL, so a lead must start in a
      // real lifecycle state; `Lead.syncLegacyStatusColumns` derives both from
      // this row. Legacy `company_id`/`product_id` are NOT NULL too.
      leadStatus: await this.findStatusByNameOrFail('LEAD-NEW'),
      company: await findOrFail(
        this.companyRepository,
        dto.companyId,
        'Company',
      ),
      product: await findOrFail(
        this.productRepository,
        dto.productId,
        'Product',
      ),
      dataSource: dto.dataSourceId
        ? await findOrFail(
            this.dataSourceRepository,
            dto.dataSourceId,
            'Data source',
          )
        : null,
      state: dto.stateId
        ? await findOrFail(this.stateRepository, dto.stateId, 'State')
        : null,
      city: dto.cityId
        ? await findOrFail(this.cityRepository, dto.cityId, 'City')
        : null,
      branch: dto.branchId
        ? await findOrFail(this.branchRepository, dto.branchId, 'Branch')
        : null,
      // Legacy sets this from `date("Y-m-d")` at insert time (e.g.
      // `TaskController.php:3394`) — reporting-api's MIS reports/exports and
      // automation-worker's not-contactable jobs all filter on it, so
      // leaving it null silently drops every new lead from those.
      leadEntryDate: new Date(),
    });
    return this.leadRepository.save(lead);
  }

  async update(id: number, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findById(id);

    if (dto.firstName !== undefined) lead.firstName = dto.firstName;
    if (dto.mobile !== undefined) lead.mobile = dto.mobile;
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.pancard !== undefined) lead.pancard = dto.pancard;
    if (dto.loanAmount !== undefined) lead.loanAmount = dto.loanAmount;
    if (dto.tenureDays !== undefined) lead.tenureDays = dto.tenureDays;
    if (dto.purpose !== undefined) lead.purpose = dto.purpose;
    if (dto.userType !== undefined) lead.userType = dto.userType;
    if (dto.pincode !== undefined) lead.pincode = dto.pincode;
    if (dto.source !== undefined) lead.source = dto.source;
    if (dto.utmSource !== undefined) lead.utmSource = dto.utmSource;
    if (dto.utmCampaign !== undefined) lead.utmCampaign = dto.utmCampaign;
    if (dto.utmMedium !== undefined) lead.utmMedium = dto.utmMedium;
    if (dto.utmTerm !== undefined) lead.utmTerm = dto.utmTerm;
    if (dto.companyId !== undefined)
      lead.company = await findOrFail(
        this.companyRepository,
        dto.companyId,
        'Company',
      );
    if (dto.productId !== undefined)
      lead.product = await findOrFail(
        this.productRepository,
        dto.productId,
        'Product',
      );
    if (dto.dataSourceId !== undefined)
      lead.dataSource = await findOrFail(
        this.dataSourceRepository,
        dto.dataSourceId,
        'Data source',
      );
    if (dto.stateId !== undefined)
      lead.state = await findOrFail(this.stateRepository, dto.stateId, 'State');
    if (dto.cityId !== undefined)
      lead.city = await findOrFail(this.cityRepository, dto.cityId, 'City');
    if (dto.branchId !== undefined)
      lead.branch = await findOrFail(
        this.branchRepository,
        dto.branchId,
        'Branch',
      );

    return this.leadRepository.save(lead);
  }

  async changeStatus(
    id: number,
    dto: ChangeLeadStatusDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await this.findById(id);
    const status = await findOrFail(
      this.masterStatusRepository,
      dto.leadStatusId,
      'Status',
    );
    lead.leadStatus = status;
    await this.leadRepository.save(lead);
    await this.writeFollowup(lead, actingUserId, status, dto.remarks);
    return this.findById(id);
  }

  async assign(
    id: number,
    dto: AssignLeadDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await this.findById(id);
    const assignee = await findOrFail(this.userRepository, dto.userId, 'User');
    const now = new Date();

    switch (dto.stage) {
      case LeadAssignmentStage.SCREENER:
        lead.screenerAssignedTo = assignee;
        lead.screenerAssignedAt = now;
        break;
      case LeadAssignmentStage.CREDIT:
        lead.creditAssignedTo = assignee;
        lead.creditAssignedAt = now;
        break;
      case LeadAssignmentStage.DISBURSAL:
        lead.disbursalAssignedTo = assignee;
        lead.disbursalAssignedAt = now;
        break;
    }

    await this.leadRepository.save(lead);
    const remarks =
      dto.remarks ??
      `Assigned to ${assignee.name} (${dto.stage.toLowerCase()})`;
    await this.writeFollowup(lead, actingUserId, null, remarks);
    return this.findById(id);
  }

  /**
   * Ports `TaskController::allocateLeads()` — a self-service "claim these
   * leads for myself" bulk action (distinct from `assign()`, where a
   * manager assigns *someone else*). Legacy branches on the acting
   * user's single session `label`; this schema's JWT carries an array of
   * role codes, so the caller specifies which queue they're claiming
   * from (`dto.assignTarget`) and the acting user must hold an
   * authorizing role for it (`CA`/`SA` admin override matches legacy's
   * `$label == 'X' || $label == 'CA' || $label == 'SA'` condition
   * structure exactly).
   *
   * A lead not currently in the right "New" status for the target queue
   * is silently skipped (returned in `skipped`), matching legacy's own
   * `continue` — not an error, since a bulk checkbox selection can
   * legitimately include leads another agent already claimed first.
   *
   * Legacy also backfills `lead_screener_assign_user_id` whenever it's
   * empty, regardless of which branch fired — ported as-is (matches the
   * same "assign screener if unset" convention already used by every
   * automation-worker allocation job).
   *
   * RUNO's sanction-call allocation (`payday_call_management_api_call`)
   * fires only for the `SCREENER` target when the acting user holds
   * `CR1` — legacy also gated this on `ENVIRONMENT == 'production'`, no
   * equivalent check exists in this codebase; `RunoClientService` itself
   * already refuses to function without a real `RUNO_API_KEY`
   * configured, which serves the same practical purpose. Wrapped in
   * try/catch so a RUNO outage never blocks the lead claim itself —
   * matches legacy's own fire-and-forget call (no error handling around
   * it either).
   *
   * **Known gap, not fabricated**: legacy also writes the claimed
   * status onto the `loan` table's own `loan_status_id` column for the
   * `DISBURSAL` branch. This schema's `LoanStatus` enum has no
   * "in process" value, and a `Loan` row may not even exist yet at the
   * `DISBURSAL-NEW` stage (created explicitly later via
   * `DisbursalService.createLoan()`) — not ported.
   */
  async selfAllocate(
    dto: SelfAllocateLeadsDto,
    actingUserId: number,
    actingUserRoles: string[],
  ): Promise<{ allocated: number; skipped: number[] }> {
    const rule = SELF_ALLOCATE_RULES[dto.assignTarget];
    const isAuthorized =
      actingUserRoles.includes('CA') ||
      actingUserRoles.includes('SA') ||
      rule.authorizingRoles.some((role) => actingUserRoles.includes(role));
    if (!isAuthorized) {
      throw new ForbiddenException(
        `Your role does not permit self-allocating ${dto.assignTarget} leads`,
      );
    }

    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const targetStatus = await this.masterStatusRepository.findOne({
      where: { name: rule.targetStatusName },
    });
    if (!targetStatus) {
      throw new NotFoundException(
        `Master status "${rule.targetStatusName}" is not seeded`,
      );
    }
    const sourceStatusIds = rule.sourceStageCode
      ? (
          await this.masterStatusRepository.find({
            where: { stageCode: rule.sourceStageCode },
          })
        ).map((s) => s.id)
      : await this.masterStatusRepository
          .findOne({ where: { name: rule.sourceStatusName } })
          .then((s) => (s ? [s.id] : []));

    const now = new Date();
    let allocated = 0;
    const skipped: number[] = [];

    for (const leadId of dto.leadIds) {
      const lead = await this.leadRepository.findOne({
        where: { id: leadId },
        relations: { leadStatus: true, screenerAssignedTo: true },
      });
      if (!lead?.leadStatus || !sourceStatusIds.includes(lead.leadStatus.id)) {
        skipped.push(leadId);
        continue;
      }

      lead.leadStatus = targetStatus;
      switch (dto.assignTarget) {
        case LeadAssignmentStage.SCREENER:
          lead.screenerAssignedTo = actingUser;
          lead.screenerAssignedAt = now;
          break;
        case LeadAssignmentStage.CREDIT:
          lead.creditAssignedTo = actingUser;
          lead.creditAssignedAt = now;
          break;
        case LeadAssignmentStage.DISBURSAL:
          lead.disbursalAssignedTo = actingUser;
          lead.disbursalAssignedAt = now;
          break;
      }
      if (!lead.screenerAssignedTo) {
        lead.screenerAssignedTo = actingUser;
        lead.screenerAssignedAt = now;
      }

      await this.leadRepository.save(lead);
      await this.writeFollowup(
        lead,
        actingUserId,
        targetStatus,
        `Lead allocate by self - ${actingUser.name}`,
      );
      allocated += 1;

      if (
        dto.assignTarget === LeadAssignmentStage.SCREENER &&
        actingUserRoles.includes('CR1')
      ) {
        try {
          await this.integrationsApiClient.post(
            `/call-management/runo/sanction-allocation?leadId=${leadId}`,
            {},
          );
        } catch (error) {
          this.logger.warn(
            `RUNO sanction-call allocation failed for lead ${leadId}: ${(error as Error).message}`,
          );
        }
      }
    }

    return { allocated, skipped };
  }

  async reject(
    id: number,
    dto: RejectLeadDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await this.findById(id);
    const rejectionReason = await findOrFail(
      this.rejectionReasonRepository,
      dto.rejectionReasonId,
      'Rejection reason',
    );
    const rejectedBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    // A manual reject from any role always lands on the same 'REJECT'
    // (stage S9) status — S8/SYSTEM-REJECT is reserved for automated
    // rejections (see REJECTED_STAGE_CODES in the frontend's
    // rejected-leads.tsx), never something a staff user triggers here.
    const rejectStatus = await this.findStatusByNameOrFail('REJECT');

    lead.leadStatus = rejectStatus;
    lead.rejectionReason = rejectionReason;
    lead.rejectedBy = rejectedBy;
    lead.rejectedAt = new Date();

    await this.leadRepository.save(lead);
    await this.writeFollowup(
      lead,
      actingUserId,
      rejectStatus,
      dto.remarks ?? rejectionReason.reason,
    );
    return this.findById(id);
  }

  async findCustomer(leadId: number): Promise<LeadCustomer> {
    await this.findById(leadId);
    const customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: leadId } },
      relations: {
        state: true,
        city: true,
        maritalStatus: true,
        qualification: true,
        religion: true,
        spouseOccupation: true,
      },
    });
    if (!customer) {
      throw new NotFoundException(
        `No customer record found for lead ${leadId}`,
      );
    }
    return customer;
  }

  async upsertCustomer(
    leadId: number,
    dto: UpsertLeadCustomerDto,
  ): Promise<LeadCustomer> {
    const lead = await this.findById(leadId);
    let customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!customer) {
      customer = this.leadCustomerRepository.create({
        lead,
        createdAt: new Date(),
      });
    }

    if (dto.firstName !== undefined) customer.firstName = dto.firstName;
    if (dto.middleName !== undefined) customer.middleName = dto.middleName;
    if (dto.surName !== undefined) customer.surName = dto.surName;
    if (dto.fatherName !== undefined) customer.fatherName = dto.fatherName;
    if (dto.gender !== undefined) customer.gender = dto.gender;
    // `LeadCustomer.dob` maps a `date` column as a plain ISO string, not a
    // `Date` — `dto.dob` (validated `@IsDateString()`) is already that shape.
    if (dto.dob !== undefined) customer.dob = dto.dob;
    if (dto.mobile !== undefined) customer.mobile = dto.mobile;
    if (dto.alternateMobile !== undefined)
      customer.alternateMobile = dto.alternateMobile;
    if (dto.email !== undefined) customer.email = dto.email;
    if (dto.alternateEmail !== undefined)
      customer.alternateEmail = dto.alternateEmail;
    if (dto.pancard !== undefined) customer.pancard = dto.pancard;
    if (dto.aadhaarNumber !== undefined)
      customer.aadhaarNumber = dto.aadhaarNumber;
    if (dto.isPancardVerified !== undefined)
      customer.isPancardVerified = dto.isPancardVerified;
    if (dto.isAadhaarVerified !== undefined)
      customer.isAadhaarVerified = dto.isAadhaarVerified;
    if (dto.currentAddressLine1 !== undefined)
      customer.currentAddressLine1 = dto.currentAddressLine1;
    if (dto.currentAddressLine2 !== undefined)
      customer.currentAddressLine2 = dto.currentAddressLine2;
    if (dto.currentLandmark !== undefined)
      customer.currentLandmark = dto.currentLandmark;
    if (dto.currentResidenceType !== undefined)
      customer.currentResidenceType = dto.currentResidenceType;
    if (dto.currentResidenceSince !== undefined)
      customer.currentResidenceSince = dto.currentResidenceSince;
    if (dto.pincode !== undefined) customer.pincode = dto.pincode;
    if (dto.spouseName !== undefined) customer.spouseName = dto.spouseName;
    if (dto.stateId !== undefined)
      customer.state = await findOrFail(
        this.stateRepository,
        dto.stateId,
        'State',
      );
    if (dto.cityId !== undefined)
      customer.city = await findOrFail(this.cityRepository, dto.cityId, 'City');
    if (dto.maritalStatusId !== undefined)
      customer.maritalStatus = await findOrFail(
        this.maritalStatusRepository,
        dto.maritalStatusId,
        'Marital status',
      );
    if (dto.qualificationId !== undefined)
      customer.qualification = await findOrFail(
        this.qualificationRepository,
        dto.qualificationId,
        'Qualification',
      );
    if (dto.religionId !== undefined)
      customer.religion = await findOrFail(
        this.religionRepository,
        dto.religionId,
        'Religion',
      );
    if (dto.spouseOccupationId !== undefined)
      customer.spouseOccupation = await findOrFail(
        this.occupationRepository,
        dto.spouseOccupationId,
        'Occupation',
      );

    return this.leadCustomerRepository.save(customer);
  }

  async findEmployment(leadId: number): Promise<LeadEmployment> {
    await this.findById(leadId);
    const employment = await this.leadEmploymentRepository.findOne({
      where: { lead: { id: leadId } },
      relations: { state: true, city: true },
    });
    if (!employment) {
      throw new NotFoundException(
        `No employment record found for lead ${leadId}`,
      );
    }
    return employment;
  }

  async upsertEmployment(
    leadId: number,
    dto: UpsertLeadEmploymentDto,
  ): Promise<LeadEmployment> {
    const lead = await this.findById(leadId);
    let employment = await this.leadEmploymentRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!employment) {
      employment = this.leadEmploymentRepository.create({
        lead,
        incomeType: dto.incomeType,
      });
    }

    employment.incomeType = dto.incomeType;
    if (dto.monthlyIncome !== undefined)
      employment.monthlyIncome = dto.monthlyIncome;
    if (dto.salaryMode !== undefined) employment.salaryMode = dto.salaryMode;
    if (dto.employerName !== undefined)
      employment.employerName = dto.employerName;
    if (dto.designation !== undefined) employment.designation = dto.designation;
    if (dto.department !== undefined) employment.department = dto.department;
    if (dto.employerType !== undefined)
      employment.employerType = dto.employerType;
    if (dto.addressLine1 !== undefined)
      employment.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 !== undefined)
      employment.addressLine2 = dto.addressLine2;
    if (dto.landmark !== undefined) employment.landmark = dto.landmark;
    if (dto.pincode !== undefined) employment.pincode = dto.pincode;
    if (dto.residenceSince !== undefined)
      employment.residenceSince = dto.residenceSince;
    if (dto.serviceTenure !== undefined)
      employment.serviceTenure = dto.serviceTenure;
    if (dto.stateId !== undefined)
      employment.state = await findOrFail(
        this.stateRepository,
        dto.stateId,
        'State',
      );
    if (dto.cityId !== undefined)
      employment.city = await findOrFail(
        this.cityRepository,
        dto.cityId,
        'City',
      );

    return this.leadEmploymentRepository.save(employment);
  }

  async listReferences(leadId: number): Promise<LeadCustomerReference[]> {
    await this.findById(leadId);
    return this.leadCustomerReferenceRepository.find({
      where: { lead: { id: leadId } },
      order: { id: 'ASC' },
    });
  }

  async addReference(
    leadId: number,
    dto: CreateLeadCustomerReferenceDto,
  ): Promise<LeadCustomerReference> {
    const lead = await this.findById(leadId);
    const reference = this.leadCustomerReferenceRepository.create({
      lead,
      name: dto.name,
      mobile: dto.mobile,
      relationType: dto.relationType ?? null,
      createdAt: new Date(),
    });
    return this.leadCustomerReferenceRepository.save(reference);
  }

  async removeReference(leadId: number, referenceId: number): Promise<void> {
    const reference = await this.leadCustomerReferenceRepository.findOne({
      where: { id: referenceId, lead: { id: leadId } },
    });
    if (!reference) {
      throw new NotFoundException(
        `Reference ${referenceId} not found for lead ${leadId}`,
      );
    }
    reference.isActive = false;
    reference.isDeleted = true;
    await this.leadCustomerReferenceRepository.save(reference);
  }

  async listFollowups(
    leadId: number,
    query: ListLeadFollowupsQueryDto,
  ): Promise<PaginatedResult<LeadFollowup>> {
    await this.findById(leadId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await this.leadFollowupRepository.findAndCount({
      where: { lead: { id: leadId } },
      relations: { user: true, status: true },
      order: { id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, page, limit, total };
  }

  async addFollowup(
    leadId: number,
    dto: CreateLeadFollowupDto,
    actingUserId: number,
  ): Promise<LeadFollowup> {
    const lead = await this.findById(leadId);
    return this.writeFollowup(lead, actingUserId, null, dto.remarks);
  }

  /**
   * Legacy `leads.status` and `stage` are NOT NULL, so every lead needs a real
   * `MasterStatus` row from the start. Looked up by name rather than by a
   * hardcoded id so the seeded/legacy ids stay the database's business.
   */
  private async findStatusByNameOrFail(name: string): Promise<MasterStatus> {
    const status = await this.masterStatusRepository.findOne({
      where: { name },
    });
    if (!status) {
      throw new NotFoundException(`Lead status "${name}" is not configured`);
    }
    return status;
  }

  private async writeFollowup(
    lead: Lead,
    actingUserId: number,
    status: MasterStatus | null,
    remarks: string | undefined,
  ): Promise<LeadFollowup> {
    const user = await this.userRepository.findOne({
      where: { id: actingUserId },
    });
    const now = new Date();
    const followup = this.leadFollowupRepository.create({
      lead,
      user,
      status,
      remarks: remarks ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return this.leadFollowupRepository.save(followup);
  }
}
