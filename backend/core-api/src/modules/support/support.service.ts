import { findOrFail } from '@finance-crm/common';
import {
  AccountAggregatorLog,
  EkycLog,
  EsignLog,
  Lead,
  LeadFollowup,
  User,
} from '@finance-crm/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { assertLeadEditableBySupport } from '../../common/lead-editable.util';
import { CamService } from '../cam/cam.service';
import { UpsertCamDto } from '../cam/dto/upsert-cam.dto';
import { LeadAssignmentStage } from '../leads/dto/assign-lead.dto';
import { UpsertLeadCustomerDto } from '../leads/dto/upsert-lead-customer.dto';
import { UpsertLeadEmploymentDto } from '../leads/dto/upsert-lead-employment.dto';
import { LeadsService } from '../leads/leads.service';
import { CreateCustomerBankingDto } from '../verification/dto/create-customer-banking.dto';
import { VerificationService } from '../verification/verification.service';
import { AllocationOverrideDto } from './dto/allocation-override.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    @InjectRepository(EkycLog)
    private readonly ekycLogRepository: Repository<EkycLog>,
    @InjectRepository(EsignLog)
    private readonly esignLogRepository: Repository<EsignLog>,
    @InjectRepository(AccountAggregatorLog)
    private readonly accountAggregatorLogRepository: Repository<AccountAggregatorLog>,
    private readonly leadsService: LeadsService,
    private readonly verificationService: VerificationService,
    private readonly camService: CamService,
  ) {}

  private async findLeadWithStatus(leadId: number): Promise<Lead> {
    const lead = await this.leadRepository.findOne({
      where: { id: leadId },
      relations: { leadStatus: true, rejectionReason: true },
    });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }
    return lead;
  }

  private async writeFollowup(
    lead: Lead,
    actingUserId: number,
    remarks: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: actingUserId },
    });
    const now = new Date();
    const followup = this.leadFollowupRepository.create({
      lead,
      user,
      status: null,
      remarks,
      createdAt: now,
      updatedAt: now,
    });
    await this.leadFollowupRepository.save(followup);
  }

  async resetEkyc(leadId: number, actingUserId: number): Promise<void> {
    const lead = await this.findLeadWithStatus(leadId);
    const log = await this.ekycLogRepository.findOne({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
    if (log) {
      log.isActive = false;
      log.isDeleted = true;
      await this.ekycLogRepository.save(log);
    }
    await this.writeFollowup(lead, actingUserId, 'Support: eKYC link reset');
  }

  async resetEsign(leadId: number, actingUserId: number): Promise<void> {
    const lead = await this.findLeadWithStatus(leadId);
    const log = await this.esignLogRepository.findOne({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
    if (log) {
      log.isActive = false;
      log.isDeleted = true;
      await this.esignLogRepository.save(log);
    }
    await this.writeFollowup(lead, actingUserId, 'Support: eSign link reset');
  }

  async resetAccountAggregator(
    leadId: number,
    actingUserId: number,
  ): Promise<void> {
    const lead = await this.findLeadWithStatus(leadId);
    assertLeadEditableBySupport(lead);
    const log = await this.accountAggregatorLogRepository.findOne({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
    if (log) {
      log.isActive = false;
      log.isDeleted = true;
      await this.accountAggregatorLogRepository.save(log);
    }
    await this.writeFollowup(
      lead,
      actingUserId,
      'Support: Account Aggregator consent reset',
    );
  }

  async overrideAllocation(
    leadId: number,
    dto: AllocationOverrideDto,
    actingUserId: number,
  ): Promise<Lead> {
    const lead = await this.findLeadWithStatus(leadId);
    assertLeadEditableBySupport(lead);
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

    // Legacy clears rejection metadata when an ops override reassigns a
    // lead that was previously rejected — the reassignment implies it's
    // being worked again, not staying in a rejected state.
    if (lead.rejectionReason) {
      lead.rejectionReason = null;
      lead.rejectedBy = null;
      lead.rejectedAt = null;
    }

    await this.leadRepository.save(lead);
    const remarks =
      dto.remarks ??
      `Support override: reassigned to ${assignee.name} (${dto.stage.toLowerCase()})`;
    await this.writeFollowup(lead, actingUserId, remarks);
    return this.findLeadWithStatus(leadId);
  }

  async overridePersonalDetail(
    leadId: number,
    dto: UpsertLeadCustomerDto,
    actingUserId: number,
  ) {
    const lead = await this.findLeadWithStatus(leadId);
    assertLeadEditableBySupport(lead);
    const result = await this.leadsService.upsertCustomer(leadId, dto);
    await this.writeFollowup(
      lead,
      actingUserId,
      'Support: personal detail override',
    );
    return result;
  }

  async overrideEmploymentDetail(
    leadId: number,
    dto: UpsertLeadEmploymentDto,
    actingUserId: number,
  ) {
    const lead = await this.findLeadWithStatus(leadId);
    assertLeadEditableBySupport(lead);
    const result = await this.leadsService.upsertEmployment(leadId, dto);
    await this.writeFollowup(
      lead,
      actingUserId,
      'Support: employment detail override',
    );
    return result;
  }

  async overrideBankDetail(
    leadId: number,
    dto: CreateCustomerBankingDto,
    actingUserId: number,
  ) {
    const lead = await this.findLeadWithStatus(leadId);
    assertLeadEditableBySupport(lead);
    const result = await this.verificationService.createBanking(leadId, dto);
    await this.writeFollowup(
      lead,
      actingUserId,
      'Support: bank detail override',
    );
    return result;
  }

  async overrideCamDetail(
    leadId: number,
    dto: UpsertCamDto,
    actingUserId: number,
  ) {
    const lead = await this.findLeadWithStatus(leadId);
    assertLeadEditableBySupport(lead);
    // Skip CamService's normal-flow 3-status gate — support's own, wider
    // status allow-list (just enforced above) is legacy's real gate for
    // this action, not `savePaydayCAMDetails()`'s.
    const result = await this.camService.upsert(leadId, dto, false);
    await this.writeFollowup(
      lead,
      actingUserId,
      'Support: CAM detail override',
    );
    return result;
  }
}
