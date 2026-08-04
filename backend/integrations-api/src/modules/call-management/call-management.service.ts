import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  CallManagementLog,
  Lead,
  LeadFollowup,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { RunoClientService } from '../runo/runo-client.service';

const RUNO_CALL_ALLOCATION_URL = 'https://api.runo.in/v1/crm/allocation';

/**
 * RUNO call-allocation — ports `runo_sanction_allocation_api`
 * (`payday_runo_call_api_helper.php`), confirmed live via
 * `TaskController.php`'s `CR1`+production-only dispatch. RUNO's
 * collection-allocation path (`COLLECTION_CALL`) has no live caller
 * anywhere in legacy and Smartping (`SMARTPING_CALL_CRM`) has no
 * `integration_config` case at all (always errors) — neither is ported,
 * see `docs/excluded.md`.
 */
@Injectable()
export class CallManagementService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CallManagementLog)
    private readonly logRepository: Repository<CallManagementLog>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
    private readonly runo: RunoClientService,
  ) {}

  async allocateSanctionCall(leadId: number): Promise<CallManagementLog> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const lead = (await this.leadRepository.findOne({
      where: { id: leadId } as never,
      relations: {
        state: true,
        city: true,
        screenerAssignedTo: true,
        leadStatus: true,
      },
    })) as Lead;

    const agentMobile = lead.screenerAssignedTo?.mobile ?? '';
    const assignedTo = agentMobile ? `+91${agentMobile}` : '';

    const body: Record<string, unknown> = {
      customer: {
        name: lead.firstName || 'NA',
        phoneNumber: `+91${lead.mobile}`,
        email: lead.email ?? '',
        company: {
          name: lead.pancard ?? 'XXXXX0123X',
          address: {
            street: '',
            city: lead.city?.name ?? '',
            state: lead.state?.name ?? '',
            country: 'India',
            pincode: lead.pincode ?? '999999',
          },
          kdm: {
            name: String(leadId),
            phoneNumber: lead.source ?? 'NA',
          },
        },
      },
      priority: 3,
      notes: 'Self Allocated',
      processName: 'Sanction Team',
      userFields: [
        { name: 'Lead_id', value: leadId },
        { name: 'User_id', value: lead.screenerAssignedTo?.id ?? null },
      ],
    };
    if (assignedTo) {
      body.assignedTo = assignedTo;
    }

    const url = assignedTo
      ? RUNO_CALL_ALLOCATION_URL
      : `${RUNO_CALL_ALLOCATION_URL}?isCommonPool=true`;
    const result = await this.runo.post(url, body);
    const data = result.data as { statusCode?: number } | null;
    const status =
      data?.statusCode === 0 ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR;

    if (status === ApiCallStatus.SUCCESS && lead.leadStatus) {
      const now = new Date();
      const followup = this.leadFollowupRepository.create({
        lead,
        user: lead.screenerAssignedTo,
        status: lead.leadStatus,
        remarks: 'RUNO call assigned',
        createdAt: now,
        updatedAt: now,
      });
      await this.leadFollowupRepository.save(followup);
    }

    const log = this.logRepository.create({
      // CallManagementLog (api_call_campaign_logs) is a campaign-level
      // batch log in legacy, not per-lead — no lead/user/mobile/provider
      // column exists to record those on, unlike the pre-rewrite entity.
      // The lead/agent this call was for is still tracked via the
      // LeadFollowup written above.
      campaignName: 'Sanction Team',
      methodId: 1,
      request: result.requestJson,
      response: result.responseJson,
      status,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
