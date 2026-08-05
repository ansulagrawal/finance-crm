import { Public } from '@finance-crm/common';
import { ApiCallStatus, EsignLog } from '@finance-crm/database';
import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { VendorCallbackTokenGuard } from '../../common/vendor-callback-token.guard';

interface EsignCallbackPayload {
  leadId?: number;
  customerId?: string;
  status?: string;
  finalSignedContract?: string;
}

/**
 * `finalSignedContract` is a URL supplied by the caller and stored as the
 * canonical location of a signed loan agreement, so it is not taken on
 * trust. Anything that isn't an `https:` URL is dropped rather than
 * persisted — an `http:` link would let the signed contract be swapped in
 * transit, and a `javascript:`/`data:` value would be a stored payload
 * waiting for whatever renders `returnUrl` later.
 */
function acceptableContractUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Ports `ApiCallBackController::eSignSanctionLetterResponse()`/
 * `completeESign()` — Signzy's eSign completion callback. Legacy renders a
 * server-side "thank you" HTML page from this endpoint; this port returns
 * plain JSON and updates the matching `EsignLog` row instead, since
 * server-rendered views aren't part of this stack (per CLAUDE.md).
 *
 * **Security**: this endpoint decides whether a loan agreement counts as
 * signed, so it is authenticated by `VendorCallbackTokenGuard` (the payload
 * carries no signature of its own). Previously it was completely
 * unauthenticated, which meant anyone could mark any lead's eSign as
 * successfully completed and point `returnUrl` — the stored location of the
 * signed contract — at content of their choosing. The URL is now validated
 * as `https:` before being persisted, and a callback is only accepted while
 * the matching log is still awaiting a verdict, so a completed eSign can't
 * be retroactively rewritten.
 */
@ApiTags('eSign')
@ApiSecurity('vendor-callback-token')
@Controller('esign')
export class EsignCallbackController {
  private readonly logger = new Logger(EsignCallbackController.name);

  constructor(
    @InjectRepository(EsignLog)
    private readonly esignLogRepository: Repository<EsignLog>,
  ) {}

  @Public()
  @UseGuards(VendorCallbackTokenGuard)
  @Post('callback')
  @ApiOperation({
    summary:
      'Signzy eSign completion callback (third-party webhook). Authenticated by the VENDOR_CALLBACK_TOKEN shared secret, not a cookie session.',
  })
  async handleCallback(
    @Body() payload: EsignCallbackPayload,
  ): Promise<{ status: string }> {
    if (!payload.leadId) {
      return { status: 'ignored — no leadId in payload' };
    }

    const log = await this.esignLogRepository.findOne({
      where: { lead: { id: payload.leadId } },
      order: { id: 'DESC' },
    });
    if (!log) {
      return { status: 'ignored — no matching eSign log for this lead' };
    }
    if (log.respondedAt) {
      // Already resolved. Replaying a callback against a settled log is how
      // a signed contract's stored URL would get swapped after the fact.
      return { status: 'ignored — eSign log already has a verdict' };
    }

    const contractUrl = acceptableContractUrl(payload.finalSignedContract);
    if (payload.finalSignedContract && !contractUrl) {
      this.logger.warn(
        `Rejected non-https finalSignedContract URL on eSign callback for lead ${payload.leadId}`,
      );
    }

    log.respondedAt = new Date();
    log.response = JSON.stringify(payload);
    log.status = contractUrl ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR;
    if (contractUrl) {
      log.returnUrl = contractUrl;
    }
    await this.esignLogRepository.save(log);

    return { status: 'ok' };
  }
}
