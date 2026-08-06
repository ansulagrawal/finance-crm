import { Public } from '@finance-crm/common';
import {
  AccountAggregatorLog,
  AccountAggregatorMethod,
  AccountAggregatorProvider,
  ApiCallStatus,
} from '@finance-crm/database';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { VendorCallbackTokenGuard } from '../../common/vendor-callback-token.guard';
import { AccountAggregatorService } from './account-aggregator.service';

interface AaNpCallbackPayload {
  docId?: string;
  requestId?: string;
  status?: string;
  reportFileName?: string;
  endTime?: string;
  message?: string;
  fileNo?: string;
}

/**
 * Ports `AAController::getConsentResponseCallback()` — the `NOVEL_PATTERN`
 * flow's inbound webhook, confirmed real via production
 * `api_account_aggregator_logs` sample rows and legacy's own field access
 * (`$data['docId']`/`$data['requestId']`/`$data['status']`/
 * `$data['reportFileName']`/`$data['endTime']`/`$data['message']`/
 * `$data['fileNo']`). Legacy parses this from a raw request body via
 * `parse_str()` (i.e. `application/x-www-form-urlencoded`), falling back
 * to `$_POST` — Nest's default body parser already handles both
 * form-urlencoded and JSON bodies into `@Body()`, no extra config needed.
 *
 * Matches the request to the original `CreateConsentRequest` log by
 * `consentHandleId = requestId`. When `status` is "Processed"
 * (case-insensitive), triggers the download-report call
 * (`AccountAggregatorService.downloadNpReport`) — mirrors legacy's own
 * `if (strtolower($status) == 'processed') { $this->aaDownloadReport(...) }`.
 */
@ApiTags('Account Aggregator')
@ApiSecurity('vendor-callback-token')
@Controller('account-aggregator')
export class AccountAggregatorCallbackController {
  constructor(
    @InjectRepository(AccountAggregatorLog)
    private readonly logRepository: Repository<AccountAggregatorLog>,
    private readonly accountAggregatorService: AccountAggregatorService,
  ) {}

  @Public()
  @UseGuards(VendorCallbackTokenGuard)
  @Post('np-callback')
  @ApiOperation({
    summary:
      'Account Aggregator Novel Pattern (CartBI) webhook callback. Authenticated by the VENDOR_CALLBACK_TOKEN shared secret, not a cookie session.',
  })
  async handleNpCallback(
    @Body() payload: AaNpCallbackPayload,
  ): Promise<{ status: string }> {
    if (!payload.requestId) {
      return { status: 'ignored — no requestId in payload' };
    }

    const consentRequestLog = await this.logRepository.findOne({
      where: {
        consentHandleId: payload.requestId,
        method: AccountAggregatorMethod.CONSENT_REQUEST,
        provider: AccountAggregatorProvider.NOVEL_PATTERN,
      },
      order: { id: 'DESC' },
      relations: { lead: true },
    });
    if (!consentRequestLog) {
      return { status: 'ignored — no matching consent request found' };
    }

    const log = this.logRepository.create({
      lead: consentRequestLog.lead,
      provider: AccountAggregatorProvider.NOVEL_PATTERN,
      method: AccountAggregatorMethod.CONSENT_STATUS,
      consentHandleId: payload.requestId,
      docId: payload.docId ?? null,
      reportFileName: payload.reportFileName ?? null,
      responsePayload: JSON.stringify(payload),
      status: payload.docId ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      statusMessage: payload.status ?? payload.message ?? null,
      errorMessage: payload.docId ? '' : (payload.message ?? ''),
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    await this.logRepository.save(log);

    if (payload.status?.toLowerCase() === 'processed' && payload.docId) {
      await this.accountAggregatorService.downloadNpReport(
        consentRequestLog.lead,
        payload.docId,
        payload.reportFileName ?? null,
      );
    }

    return { status: 'ok' };
  }
}
