import { Public } from '@finance-crm/common';
import {
  LeadCustomer,
  LeadFollowup,
  VideoKycCallbackLog,
  VideoKycLog,
} from '@finance-crm/database';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { VendorCallbackTokenGuard } from '../../common/vendor-callback-token.guard';

const CALLBACK_METHOD = 1;

interface VideoKycCallbackPayload {
  requestId?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Ports `VideoKYCController::VideoKycCallBack_post()` — Signzy ConsenzAI's
 * async video-KYC verdict callback. Legacy also downloads/unzips/classifies
 * a bundle of session documents from a separate third-party endpoint
 * (`myconcall.com`, a hardcoded auth token in source) on the same request —
 * that document pipeline is a distinct, undocumented legacy feature (not
 * part of the Signzy integration this backend already ported session
 * creation for) and isn't ported here; only the verdict callback itself
 * (log the callback, flip `LeadCustomer` vkyc flags, write a followup)
 * matches this backend's documented gap.
 *
 * **Security**: this endpoint decides whether a lead's video-KYC counts as
 * completed, so it is authenticated two ways. `VendorCallbackTokenGuard`
 * proves the caller is Signzy (the payload carries no signature of its own),
 * and the lead is resolved by looking `requestId` up against the
 * `VideoKycLog` row written when *we* created the session — never from the
 * payload. Previously the payload's own `leadId` was trusted, so an
 * unauthenticated POST could set `vkycFlag`/`vkycCompletedOn` on any lead in
 * the system and write a matching "(Success)" followup: a forged regulatory
 * KYC check on a loan file. `requestId` is now the only lead selector, and
 * an unrecognised one resolves to no lead at all.
 */
@ApiTags('Video KYC')
@ApiSecurity('vendor-callback-token')
@Controller('video-kyc')
export class VideoKycCallbackController {
  constructor(
    @InjectRepository(VideoKycCallbackLog)
    private readonly callbackLogRepository: Repository<VideoKycCallbackLog>,
    @InjectRepository(VideoKycLog)
    private readonly videoKycLogRepository: Repository<VideoKycLog>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    @InjectRepository(LeadFollowup)
    private readonly leadFollowupRepository: Repository<LeadFollowup>,
  ) {}

  @Public()
  @UseGuards(VendorCallbackTokenGuard)
  @Post('callback')
  @ApiOperation({
    summary:
      'Signzy ConsenzAI video-KYC verdict callback (third-party webhook). Authenticated by the VENDOR_CALLBACK_TOKEN shared secret, not a cookie session.',
  })
  async handleCallback(
    @Body() payload: VideoKycCallbackPayload,
  ): Promise<{ status: string }> {
    if (!payload.requestId || !payload.status) {
      return { status: 'ignored — missing requestId or status' };
    }

    // The originating session request is the only trusted source for which
    // lead this verdict belongs to.
    const originatingLog = await this.videoKycLogRepository.findOne({
      where: { requestId: payload.requestId },
      order: { id: 'DESC' },
      relations: { lead: { leadStatus: true } },
    });
    const lead = originatingLog?.lead ?? null;

    await this.callbackLogRepository.save(
      this.callbackLogRepository.create({
        lead,
        method: CALLBACK_METHOD,
        requestId: payload.requestId,
        status: payload.status,
        response: JSON.stringify(payload),
        errors: null,
        respondedAt: new Date(),
      }),
    );

    if (!lead) {
      return { status: 'ok — logged without a matching lead' };
    }

    const customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: lead.id } },
    });
    if (customer) {
      customer.vkycFlag = true;
      customer.vkycCompletedOn = new Date();
      await this.leadCustomerRepository.save(customer);
    }

    if (lead.leadStatus) {
      const now = new Date();
      await this.leadFollowupRepository.save(
        this.leadFollowupRepository.create({
          lead,
          user: null,
          status: lead.leadStatus,
          remarks: `VIDEO KYC API CALLBACK(Success) — Request ID: ${payload.requestId}`,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    return { status: 'ok' };
  }
}
