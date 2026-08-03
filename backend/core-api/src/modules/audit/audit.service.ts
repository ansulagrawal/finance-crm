import type { PaginatedResult } from '@finance-crm/common';
import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  FaceMatchLog,
  Lead,
  LeadAudit,
  LeadAuditCaseType,
  LeadCustomer,
  LeadFollowup,
  Loan,
  MasterStatus,
  ReverseGeocodeLog,
  User,
} from '@finance-crm/database';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AllocateAuditDto } from './dto/allocate-audit.dto';
import { ApprovalReasonAuditDto } from './dto/approval-reason-audit.dto';
import { HoldAuditDto } from './dto/hold-audit.dto';
import {
  AuditQueueStage,
  ListAuditQueueQueryDto,
} from './dto/list-audit-queue-query.dto';
import { RecommendAuditDto } from './dto/recommend-audit.dto';
import { SendBackAuditDto } from './dto/send-back-audit.dto';
import { SendToPostAuditDto } from './dto/send-to-post-audit.dto';
import { SendToPreAuditDto } from './dto/send-to-pre-audit.dto';

/**
 * `master_statuses` names this module transitions leads through. The legacy
 * app additionally referenced a `PRE-AUDIT-NEW` / `lead_status_id 43`, but a
 * real export of the production `master_status` table has no such row (only
 * AUDIT-NEW/INPROCESS/HOLD/RECOMMENDED exist) — legacy's `leads` table never
 * enforced a real FK on status, so code could reference an id with no
 * matching lookup row. This schema does enforce that FK, so `sendToPreAudit`
 * lands directly on AUDIT-NEW instead of a fabricated intermediate status.
 */
const AUDIT_NEW = 'AUDIT-NEW';
const AUDIT_INPROCESS = 'AUDIT-INPROCESS';
const AUDIT_HOLD = 'AUDIT-HOLD';
const AUDIT_RECOMMENDED = 'AUDIT-RECOMMENDED';
const APPLICATION_SEND_BACK = 'APPLICATION-SEND-BACK';

/** Ports the `> 25` threshold in legacy's `auditNew()`. */
const RESIDENCE_DISTANCE_KM_LIMIT = 25;

const LEAD_AUDIT_RELATIONS = {
  lead: true,
  assignedTo: true,
  leadStatus: true,
} as const;

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(LeadAudit)
    private readonly leadAuditRepository: Repository<LeadAudit>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(MasterStatus)
    private readonly masterStatusRepository: Repository<MasterStatus>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(FaceMatchLog)
    private readonly faceMatchLogRepository: Repository<FaceMatchLog>,
    @InjectRepository(ReverseGeocodeLog)
    private readonly reverseGeocodeLogRepository: Repository<ReverseGeocodeLog>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
  ) {}

  async sendToPreAudit(
    leadId: number,
    dto: SendToPreAuditDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );

    if (lead.isStraightThroughProcessing) {
      try {
        await this.checkStraightThroughEligibility(lead);
      } catch (error) {
        const message =
          error instanceof BadRequestException
            ? error.message
            : 'Straight-through eligibility check failed';
        await this.recordApprovalReason(
          leadId,
          { remarks: message },
          actingUserId,
        );
        throw error;
      }
    }

    const targetStatusName =
      lead.isAuditSendBack && lead.auditAssignedTo
        ? AUDIT_INPROCESS
        : AUDIT_NEW;
    const status = await this.getStatusByName(targetStatusName);

    lead.leadStatus = status;
    if (targetStatusName === AUDIT_NEW) {
      lead.auditAssignedTo = null;
    }
    lead.auditAssignedAt = new Date();
    await this.leadRepository.save(lead);

    await this.writeFollowup(lead, actingUser, status, dto.remarks);
    await this.leadAuditRepository.save(
      this.leadAuditRepository.create({
        lead,
        assignedTo: lead.auditAssignedTo,
        leadStatus: status,
        caseType: LeadAuditCaseType.PRE_AUDIT,
        status: status.stageCode,
        remarks: dto.remarks ?? null,
      }),
    );

    return findOrFail(this.leadRepository, leadId, 'Lead');
  }

  async sendToPostAudit(
    leadId: number,
    dto: SendToPostAuditDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );

    const loan = await this.loanRepository.findOne({
      where: { lead: { id: leadId } },
    });
    if (!loan) {
      throw new BadRequestException(
        'Lead has no loan yet — cannot send to post-audit',
      );
    }
    // No legacy `loan_post_audit_flag` column exists (see `Loan`'s own doc
    // comment) — `Lead.auditAssignedTo`/`auditAssignedAt`/`isAuditSendBack`
    // already cover post-disbursal audit tracking, so there is nothing to
    // set on `loan` here.

    lead.auditAssignedAt = new Date();
    await this.leadRepository.save(lead);

    await this.writeFollowup(lead, actingUser, lead.leadStatus, dto.remarks);
    await this.leadAuditRepository.save(
      this.leadAuditRepository.create({
        lead,
        assignedTo: lead.auditAssignedTo,
        leadStatus: lead.leadStatus,
        caseType: LeadAuditCaseType.POST_AUDIT,
        status: lead.leadStatus?.stageCode ?? null,
        remarks: dto.remarks ?? null,
      }),
    );

    return findOrFail(this.leadRepository, leadId, 'Lead');
  }

  async allocate(dto: AllocateAuditDto, actingUserId: number): Promise<Lead[]> {
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const auditNewStatus = await this.getStatusByName(AUDIT_NEW);
    const inProcessStatus = await this.getStatusByName(AUDIT_INPROCESS);

    const results: Lead[] = [];
    for (const leadId of dto.leadIds) {
      const lead = await this.leadRepository.findOne({
        where: { id: leadId },
        relations: { leadStatus: true },
      });
      if (!lead || lead.leadStatus?.id !== auditNewStatus.id) {
        continue;
      }
      lead.leadStatus = inProcessStatus;
      lead.auditAssignedTo = actingUser;
      lead.auditAssignedAt = new Date();
      await this.leadRepository.save(lead);
      await this.writeFollowup(
        lead,
        actingUser,
        inProcessStatus,
        'Allocated for audit review',
      );
      results.push(lead);
    }
    return results;
  }

  async hold(
    leadId: number,
    dto: HoldAuditDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const status = await this.getStatusByName(AUDIT_HOLD);

    lead.leadStatus = status;
    lead.scheduledAt = new Date(dto.scheduledAt);
    await this.leadRepository.save(lead);

    await this.writeFollowup(
      lead,
      actingUser,
      status,
      `${dto.remarks} (scheduled: ${dto.scheduledAt})`,
    );
    return findOrFail(this.leadRepository, leadId, 'Lead');
  }

  async recommend(
    leadId: number,
    dto: RecommendAuditDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const status = await this.getStatusByName(AUDIT_RECOMMENDED);

    lead.leadStatus = status;
    await this.leadRepository.save(lead);

    await this.writeFollowup(lead, actingUser, status, dto.remarks);
    return findOrFail(this.leadRepository, leadId, 'Lead');
  }

  async sendBack(
    leadId: number,
    dto: SendBackAuditDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const status = await this.getStatusByName(APPLICATION_SEND_BACK);

    lead.leadStatus = status;
    lead.isAuditSendBack = true;
    await this.leadRepository.save(lead);

    await this.writeFollowup(lead, actingUser, status, dto.remarks);
    return findOrFail(this.leadRepository, leadId, 'Lead');
  }

  /**
   * Records a freeform audit remark against a lead's current audit stage.
   * Called automatically by `sendToPreAudit` when the straight-through
   * eligibility gate rejects a lead — that's the concrete "rejection-flow
   * trigger" this previously lacked (see `docs/TODO.md`'s history). Also
   * callable directly for any other manual audit remark.
   */
  async recordApprovalReason(
    leadId: number,
    dto: ApprovalReasonAuditDto,
    actingUserId: number,
  ): Promise<LeadAudit> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    await findOrFail(this.userRepository, actingUserId, 'User');

    const previous = await this.leadAuditRepository.findOne({
      where: { lead: { id: leadId } },
      relations: LEAD_AUDIT_RELATIONS,
      order: { id: 'DESC' },
    });

    const entry = this.leadAuditRepository.create({
      lead,
      assignedTo: previous?.assignedTo ?? lead.auditAssignedTo,
      leadStatus: previous?.leadStatus ?? lead.leadStatus,
      caseType: previous?.caseType ?? LeadAuditCaseType.PRE_AUDIT,
      status: previous?.status ?? lead.leadStatus?.stageCode ?? null,
      remarks: dto.remarks,
    });
    return this.leadAuditRepository.save(entry);
  }

  /**
   * Role-based queue visibility (the legacy app gated this inconsistently —
   * see TODO.md Task #42 for what was found — this is a deliberate,
   * consistent replacement, not a port of the legacy rule):
   * - AH (Audit Head): sees every lead across all 4 audit stages, unrestricted.
   * - AU/AM: see the shared unassigned AUDIT-NEW pool, plus only their own
   *   assigned leads in AUDIT-INPROCESS/AUDIT-HOLD/AUDIT-RECOMMENDED.
   */
  async list(
    query: ListAuditQueueQueryDto,
    actingUserId: number,
    roles: string[],
  ): Promise<PaginatedResult<Lead>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const stageNames = query.stage
      ? [query.stage]
      : [
          AuditQueueStage.AUDIT_NEW,
          AuditQueueStage.AUDIT_INPROCESS,
          AuditQueueStage.AUDIT_HOLD,
          AuditQueueStage.AUDIT_RECOMMENDED,
        ];

    const qb = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.leadStatus', 'leadStatus')
      .leftJoinAndSelect('lead.auditAssignedTo', 'auditAssignedTo')
      .where('leadStatus.name IN (:...stageNames)', { stageNames });

    const isAuditHead = roles.includes('AH');
    if (!isAuditHead) {
      qb.andWhere(
        '(leadStatus.name = :auditNew OR auditAssignedTo.id = :actingUserId)',
        { auditNew: AUDIT_NEW, actingUserId },
      );
    }

    const [data, total] = await qb
      .orderBy('lead.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, page, limit, total };
  }

  async history(leadId: number): Promise<LeadAudit[]> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.leadAuditRepository.find({
      where: { lead: { id: leadId } },
      relations: LEAD_AUDIT_RELATIONS,
      order: { id: 'ASC' },
    });
  }

  /**
   * Ports the `lead_creation_mode == 1` gate in legacy's
   * `TaskController::auditNew()` — only applies to straight-through leads.
   * The Credeau approved-amount cap that used to run here first was removed
   * (see `docs/EXCLUDED.md`); the FOIR cap in `CamService.assertWithinLoanLimits()`
   * is now the only loan-amount ceiling for these leads too.
   *
   * The aadhaar-residence-distance check (>25km requires a residence-proof
   * document) is now wired — `integrations-api`'s `AddressDistanceService`
   * (Google Distance Matrix) populates `LeadCustomer.residenceDistanceKm`.
   * The >25km document-fallback is *not* ported the way legacy did it:
   * legacy's `docs_type LIKE '%PRESENT_ADDRESS_PROOF%'` check is a
   * free-text tag column on the legacy `docs` table (`docs_type`),
   * completely distinct from `docs_master_id`/`DocumentType` — seeding
   * `document_types` (Task #21) does not cover this at all, correcting the
   * earlier TODO.md framing that conflated the two. This schema's
   * `Document` entity only has a `documentType` FK, no free-text category
   * column, so there is no way to identify a "present address proof"
   * upload without fabricating a mapping. This gate therefore fails
   * closed: >25km always requires manual audit, with no document-upload
   * bypass, until a real `docs_type`-equivalent column is added.
   */
  private async checkStraightThroughEligibility(lead: Lead): Promise<void> {
    const faceMatch = await this.faceMatchLogRepository.findOne({
      where: { lead: { id: lead.id }, status: ApiCallStatus.SUCCESS },
    });
    if (!faceMatch) {
      throw new BadRequestException('Face match not verified.');
    }

    const liveLocation = await this.reverseGeocodeLogRepository.findOne({
      where: { lead: { id: lead.id }, status: ApiCallStatus.SUCCESS },
    });
    if (!liveLocation) {
      throw new BadRequestException('Current Location is not available.');
    }

    const customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: lead.id } },
    });
    if (customer?.residenceDistanceKm == null) {
      throw new BadRequestException(
        'Current-Aadhaar Residence Distance is not available.',
      );
    }
    if (Number(customer.residenceDistanceKm) > RESIDENCE_DISTANCE_KM_LIMIT) {
      throw new BadRequestException(
        `Current-Aadhaar Residence Distance is more than ${RESIDENCE_DISTANCE_KM_LIMIT}km.`,
      );
    }
  }

  private async getStatusByName(name: string): Promise<MasterStatus> {
    const status = await this.masterStatusRepository.findOne({
      where: { name },
    });
    if (!status) {
      throw new BadRequestException(`Master status "${name}" is not seeded`);
    }
    return status;
  }

  private async writeFollowup(
    lead: Lead,
    user: User,
    status: MasterStatus | null,
    remarks: string | undefined,
  ): Promise<LeadFollowup> {
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
