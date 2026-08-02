import type { PaginatedResult } from '@finance-crm/common';
import { findOrFail } from '@finance-crm/common';
import {
  FieldVerificationVisit,
  Lead,
  LeadFollowup,
  User,
  UserRoleLocation,
  UserRoleLocationType,
} from '@finance-crm/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AllocateFieldVerificationDto } from './dto/allocate-field-verification.dto';
import { InitiateFieldVerificationDto } from './dto/initiate-field-verification.dto';
import { ListFieldVerificationQueueQueryDto } from './dto/list-field-verification-queue-query.dto';
import { SubmitFieldVerificationReportDto } from './dto/submit-field-verification-report.dto';
import { FieldVerificationTrack } from './field-verification.types';

const VISIT_RELATIONS = {
  lead: true,
  visitRequestedBy: true,
  residenceCpvAllocatedTo: true,
  officeCpvAllocatedTo: true,
} as const;

@Injectable()
export class FieldVerificationService {
  constructor(
    @InjectRepository(FieldVerificationVisit)
    private readonly visitRepository: Repository<FieldVerificationVisit>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(UserRoleLocation)
    private readonly userRoleLocationRepository: Repository<UserRoleLocation>,
  ) {}

  /** `tbl_verification` is one row per lead (both tracks side by side), not a list of visits. */
  async getForLead(leadId: number): Promise<FieldVerificationVisit | null> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    return this.visitRepository.findOne({
      where: { lead: { id: leadId } },
      relations: VISIT_RELATIONS,
    });
  }

  /**
   * Ports `TaskController::initiateFiCPV()`'s intent, adapted to the
   * single-row-per-lead shape: creates the lead's verification row on first
   * call (either track), records who first requested it, then flags
   * whichever track was requested as initiated. Unlike the legacy CO2
   * auto-routing this ported from, there's no column to persist a "routed to
   * this SCM" state on this entity — SCM/field-executive allocation happens
   * explicitly via `allocate()`, and the queue (`listQueue`) computes CO2
   * coverage on the fly instead of reading a stored assignment.
   */
  async initiate(
    leadId: number,
    dto: InitiateFieldVerificationDto,
    actingUserId: number,
  ): Promise<FieldVerificationVisit> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const requestedBy = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );

    let visit = await this.visitRepository.findOne({
      where: { lead: { id: leadId } },
      relations: VISIT_RELATIONS,
    });
    if (!visit) {
      visit = this.visitRepository.create({
        lead,
        visitRequestedBy: requestedBy,
        visitRequestedOn: new Date(),
        // NOT NULL with no default in legacy; every other field on this
        // entity is nullable.
        residenceRemarks: '',
      });
    }

    const now = new Date();
    if (dto.track === FieldVerificationTrack.RESIDENCE) {
      visit.residenceCpvInitiated = 'YES';
      visit.residenceInitiatedOn = now;
    } else {
      visit.officeCpvInitiated = 'YES';
      visit.officeInitiatedOn = now;
    }

    const saved = await this.visitRepository.save(visit);
    await this.writeFollowup(
      lead,
      requestedBy,
      `${dto.track} field verification initiated`,
    );
    return saved;
  }

  /**
   * Role-scoped queue: CO3 (Collection Head) sees everything; CO2 (State
   * Collection Manager) sees leads in states they cover (computed via
   * `UserRoleLocation`, since this entity has no stored "routed to me"
   * column); CFE1 (Collection Field Executive) sees visits allocated to them
   * on either track; any other permitted role (e.g. CO1) sees only what they
   * personally requested.
   */
  async listQueue(
    query: ListFieldVerificationQueueQueryDto,
    actingUserId: number,
    roles: string[],
  ): Promise<PaginatedResult<FieldVerificationVisit>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.visitRepository
      .createQueryBuilder('visit')
      .leftJoinAndSelect('visit.lead', 'lead')
      .leftJoinAndSelect('visit.visitRequestedBy', 'visitRequestedBy')
      .leftJoinAndSelect(
        'visit.residenceCpvAllocatedTo',
        'residenceCpvAllocatedTo',
      )
      .leftJoinAndSelect('visit.officeCpvAllocatedTo', 'officeCpvAllocatedTo');

    if (query.track === FieldVerificationTrack.RESIDENCE) {
      qb.andWhere('visit.residenceCpvInitiated = :yes', { yes: 'YES' });
    } else if (query.track === FieldVerificationTrack.OFFICE) {
      qb.andWhere('visit.officeCpvInitiated = :yes', { yes: 'YES' });
    }

    if (roles.includes('CO3')) {
      // unrestricted
    } else if (roles.includes('CO2')) {
      const stateIds = await this.coveredStateIds(actingUserId);
      if (stateIds.length === 0) {
        return { data: [], page, limit, total: 0 };
      }
      qb.leftJoin('lead.state', 'leadState').andWhere(
        'leadState.id IN (:...stateIds)',
        { stateIds },
      );
    } else if (roles.includes('CFE1')) {
      qb.andWhere(
        '(visit.residenceCpvAllocatedToId = :actingUserId OR visit.officeCpvAllocatedToId = :actingUserId)',
        { actingUserId },
      );
    } else {
      qb.andWhere('visit.visitRequestedById = :actingUserId', {
        actingUserId,
      });
    }

    const [data, total] = await qb
      .orderBy('visit.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, page, limit, total };
  }

  async allocate(
    leadId: number,
    dto: AllocateFieldVerificationDto,
    actingUserId: number,
  ): Promise<FieldVerificationVisit> {
    const visit = await this.getVisitOrFail(leadId);
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );
    const allocatedTo = await findOrFail(
      this.userRepository,
      dto.allocatedToUserId,
      'User',
    );

    const now = new Date();
    if (dto.track === FieldVerificationTrack.RESIDENCE) {
      visit.residenceCpvAllocatedTo = allocatedTo;
      visit.residenceCpvAllocatedOn = now;
    } else {
      visit.officeCpvAllocatedTo = allocatedTo;
      visit.officeCpvAllocatedOn = now;
    }

    const saved = await this.visitRepository.save(visit);
    await this.writeFollowup(
      visit.lead,
      actingUser,
      `${dto.track} field verification allocated to ${allocatedTo.name}`,
    );
    return saved;
  }

  async submitReport(
    leadId: number,
    dto: SubmitFieldVerificationReportDto,
    actingUserId: number,
  ): Promise<FieldVerificationVisit> {
    const visit = await this.getVisitOrFail(leadId);
    const actingUser = await findOrFail(
      this.userRepository,
      actingUserId,
      'User',
    );

    const now = new Date();
    const visitedOn = dto.visitedAt ? new Date(dto.visitedAt) : now;

    if (dto.track === FieldVerificationTrack.RESIDENCE) {
      visit.residenceMetWith = dto.metWith ?? visit.residenceMetWith;
      visit.residenceRelation = dto.relation ?? visit.residenceRelation;
      visit.residenceEmployerName =
        dto.employerName ?? visit.residenceEmployerName;
      visit.residenceLocality = dto.locality ?? visit.residenceLocality;
      visit.residenceGeoCoordinates =
        dto.geoCoordinates ?? visit.residenceGeoCoordinates;
      visit.residenceRemarks = dto.remarks ?? visit.residenceRemarks;
      visit.residenceDocumentVerified =
        dto.documentVerified ?? visit.residenceDocumentVerified;
      visit.residencePhotoFileKey =
        dto.photoFileKey ?? visit.residencePhotoFileKey;
      visit.residenceType = dto.residenceType ?? visit.residenceType;
      visit.residenceHouseType = dto.houseType ?? visit.residenceHouseType;
      visit.residenceEaseOfIdentification =
        dto.easeOfIdentification ?? visit.residenceEaseOfIdentification;
      visit.residenceResidingSince =
        dto.residingSince ?? visit.residenceResidingSince;
      visit.residenceTotalMembersInFamily =
        dto.totalMembersInFamily ?? visit.residenceTotalMembersInFamily;
      visit.residenceEarningMembersInFamily =
        dto.earningMembersInFamily ?? visit.residenceEarningMembersInFamily;
      visit.residenceLivingStandard =
        dto.livingStandard ?? visit.residenceLivingStandard;
      visit.residenceNeighbourCheck =
        dto.neighbourCheck ?? visit.residenceNeighbourCheck;
      visit.residenceVisitedOn = visitedOn;
      visit.residenceReceivedOn = now;
      visit.residenceReportStatus = dto.status;
    } else {
      visit.officeMetWith = dto.metWith ?? visit.officeMetWith;
      visit.officeRelation = dto.relation ?? visit.officeRelation;
      visit.officeEmployerName = dto.employerName ?? visit.officeEmployerName;
      visit.officeLocality = dto.locality ?? visit.officeLocality;
      visit.officeGeoCoordinates =
        dto.geoCoordinates ?? visit.officeGeoCoordinates;
      visit.officeRemarks = dto.remarks ?? visit.officeRemarks;
      visit.officeDocumentVerified =
        dto.documentVerified ?? visit.officeDocumentVerified;
      visit.officePhotoFileKey = dto.photoFileKey ?? visit.officePhotoFileKey;
      visit.officeEntryAllowed = dto.entryAllowed ?? visit.officeEntryAllowed;
      visit.officeCompanySignboardSighted =
        dto.companySignboardSighted ?? visit.officeCompanySignboardSighted;
      visit.officeNoOfStaffSighted =
        dto.noOfStaffSighted ?? visit.officeNoOfStaffSighted;
      visit.officeEmployeeStrength =
        dto.employeeStrength ?? visit.officeEmployeeStrength;
      visit.officeEmployedSince =
        dto.employedSince ?? visit.officeEmployedSince;
      visit.officeVisitedOn = visitedOn;
      visit.officeReceivedOn = now;
      visit.officeReportStatus = dto.status;
    }

    const saved = await this.visitRepository.save(visit);
    await this.writeFollowup(
      visit.lead,
      actingUser,
      `${dto.track} field verification report submitted: ${dto.status}`,
    );
    return saved;
  }

  private async coveredStateIds(actingUserId: number): Promise<number[]> {
    const locations = await this.userRoleLocationRepository.find({
      where: {
        locationType: UserRoleLocationType.STATE,
        userRole: { user: { id: actingUserId }, roleType: { code: 'CO2' } },
      },
      relations: { userRole: { user: true, roleType: true } },
    });
    return locations.map((location) => location.locationId);
  }

  private async getVisitOrFail(
    leadId: number,
  ): Promise<FieldVerificationVisit> {
    const visit = await this.visitRepository.findOne({
      where: { lead: { id: leadId } },
      relations: VISIT_RELATIONS,
    });
    if (!visit) {
      throw new NotFoundException(
        `No field verification has been initiated for lead ${leadId}`,
      );
    }
    return visit;
  }

  private async writeFollowup(
    lead: Lead,
    user: User,
    remarks: string,
  ): Promise<LeadFollowup> {
    const now = new Date();
    const followup = this.leadFollowupRepository.create({
      lead,
      user,
      status: null,
      remarks,
      createdAt: now,
      updatedAt: now,
    });
    return this.leadFollowupRepository.save(followup);
  }
}
