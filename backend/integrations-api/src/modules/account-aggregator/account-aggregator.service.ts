import { findOrFail } from '@finance-crm/common';
import {
  AccountAggregatorLog,
  AccountAggregatorMethod,
  AccountAggregatorProvider,
  ApiCallStatus,
  Lead,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import { RequestConsentDto } from './dto/request-consent.dto';
import { RequestFiDto } from './dto/request-fi.dto';

export interface AaTransaction {
  date: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  narration?: string;
  balance?: number;
}

export interface AaMonthlySummary {
  yearMonth: string;
  credits: number;
  debits: number;
  netChange: number;
  closingBalance: number | null;
  transactionCount: number;
}

interface LegacyFiObject {
  maskedAccNumber?: string;
  linkedAccRef?: string;
  Summary?: { currentBalance?: number; ifscCode?: string };
  Profile?: { Holders?: { Holder?: { name?: string } } };
  Transactions?: {
    startDate?: string;
    endDate?: string;
    Transaction?: Array<{
      transactionTimestamp?: string;
      amount?: string | number;
      type?: string;
      narration?: string;
      currentBalance?: string | number;
    }>;
  };
}

/**
 * Ports `AAController.php` — real source confirms two genuinely
 * different, both-live-in-production flows (see `AccountAggregatorLog`'s
 * doc comment for the full breakdown): `LEGACY` (5-step, Finvu-shaped
 * responses) and `NOVEL_PATTERN` (CartBI's single-consent-request +
 * async-webhook-callback flow, the webhook half handled by
 * `AccountAggregatorCallbackController`).
 *
 * Both flows hit the **same single vendor endpoint**
 * (`{ACCOUNT_AGGREGATOR_NP_URL}api/generateNetBankingRequest`) for every
 * step whose request isn't a bare docId —
 * `aa_api_curl_helper.php`'s `sendCurl_request()` hardcodes this URL for
 * every non-Signzy call regardless of the `$endUrl` argument passed in
 * (which looks like a REST path per step, e.g.
 * `accountAggregator/consent-request-plus`, but is never actually used
 * for routing — confirmed by reading the helper directly, not guessed).
 * The vendor differentiates by request-body shape, not URL. Only the
 * download-report call (`aaDownloadReport()`) uses a second endpoint,
 * `api/downloadFile`, with a plain-text body (the docId) instead of JSON.
 */
@Injectable()
export class AccountAggregatorService {
  private readonly logger = new Logger(AccountAggregatorService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(AccountAggregatorLog)
    private readonly logRepository: Repository<AccountAggregatorLog>,
  ) {}

  private requestUrl(): string {
    return `${this.configService.getOrThrow<string>('ACCOUNT_AGGREGATOR_NP_URL')}api/generateNetBankingRequest`;
  }

  private downloadUrl(): string {
    return `${this.configService.getOrThrow<string>('ACCOUNT_AGGREGATOR_NP_URL')}api/downloadFile`;
  }

  private authToken(): string {
    return this.configService.getOrThrow<string>('ACCOUNT_AGGREGATOR_NP_TOKEN');
  }

  /** Only downgrades a SUCCESS call to API_ERROR when the vendor response
   * is missing the field this step needs — a NETWORK_ERROR from
   * `callVendor` (the HTTP call itself failed) must never be overwritten,
   * or a real network failure gets silently reported as "the vendor
   * responded but with bad data". */
  private resolveStatus(
    status: ApiCallStatus,
    hasExpectedData: boolean,
  ): ApiCallStatus {
    if (status !== ApiCallStatus.SUCCESS) return status;
    return hasExpectedData ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR;
  }

  private async findLatestLog(
    leadId: number,
    method: AccountAggregatorMethod,
    provider: AccountAggregatorProvider,
  ): Promise<AccountAggregatorLog | null> {
    return this.logRepository.findOne({
      where: { lead: { id: leadId }, method, provider },
      order: { id: 'DESC' },
    });
  }

  private async callVendor<T>(body: Record<string, unknown>): Promise<{
    data: T | null;
    status: ApiCallStatus;
    message: string | null;
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(this.requestUrl(), body, {
          headers: {
            'Content-Type': 'application/json',
            'auth-token': this.authToken(),
          },
        }),
      );
      return {
        data: response.data,
        status: ApiCallStatus.SUCCESS,
        message: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Account Aggregator API error';
      this.logger.error(`Account Aggregator vendor call failed: ${message}`);
      return { data: null, status: ApiCallStatus.NETWORK_ERROR, message };
    }
  }

  // ---- LEGACY flow: consent → status → FI-request → FI-status → FI-fetch-data → analytics ----

  async requestConsent(dto: RequestConsentDto): Promise<AccountAggregatorLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const requestBody = {
      mobileNumber: dto.mobileNumber,
      consentDescription: 'CONSENT FOR BANK STATEMENT',
      consentArtifactName: 'BANK_STATEMENT_PERIODIC',
      redirectUrl: `${this.configService.getOrThrow<string>('LMS_URL')}/account-consent-thank-you?leadId=${dto.leadId}`,
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.LEGACY,
      method: AccountAggregatorMethod.CONSENT_REQUEST,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      result?: { url?: string; consentHandle?: string };
    }>(requestBody);

    log.respondedAt = new Date();
    log.status = this.resolveStatus(status, Boolean(data?.result?.url));
    log.statusMessage = data?.result?.url
      ? null
      : (message ?? 'no consent URL returned');
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;
    log.consentHandleId = data?.result?.consentHandle ?? null;

    return this.logRepository.save(log);
  }

  async getConsentStatus(leadId: number): Promise<AccountAggregatorLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const consentRequest = await this.findLatestLog(
      leadId,
      AccountAggregatorMethod.CONSENT_REQUEST,
      AccountAggregatorProvider.LEGACY,
    );
    if (!consentRequest?.consentHandleId) {
      throw new NotFoundException(
        `No consent request found for lead ${leadId} — call requestConsent first`,
      );
    }

    const requestBody = {
      mobileNumber: lead.mobile,
      consentHandleId: consentRequest.consentHandleId,
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.LEGACY,
      method: AccountAggregatorMethod.CONSENT_STATUS,
      consentHandleId: consentRequest.consentHandleId,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      result?: { consentStatus?: string; consentId?: string };
    }>(requestBody);

    log.respondedAt = new Date();
    log.status = this.resolveStatus(status, Boolean(data?.result?.consentId));
    log.statusMessage = data?.result?.consentStatus ?? message;
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;
    log.consentId = data?.result?.consentId ?? null;

    return this.logRepository.save(log);
  }

  async requestFi(
    leadId: number,
    dto: RequestFiDto,
  ): Promise<AccountAggregatorLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const consentStatus = await this.findLatestLog(
      leadId,
      AccountAggregatorMethod.CONSENT_STATUS,
      AccountAggregatorProvider.LEGACY,
    );
    if (!consentStatus?.consentId) {
      throw new NotFoundException(
        `No accepted consent found for lead ${leadId} — call getConsentStatus first`,
      );
    }

    const requestBody = {
      customerId: lead.mobile,
      consentHandleId: consentStatus.consentHandleId,
      consentId: consentStatus.consentId,
      dateTimeRangeFrom: toIstDateTimeRange(dto.fromDate, '00:00:59'),
      dateTimeRangeTo: toIstDateTimeRange(dto.toDate, '23:59:59'),
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.LEGACY,
      method: AccountAggregatorMethod.FI_REQUEST,
      consentHandleId: consentStatus.consentHandleId,
      consentId: consentStatus.consentId,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      result?: { sessionId?: string };
    }>(requestBody);

    log.respondedAt = new Date();
    log.status = this.resolveStatus(status, Boolean(data?.result?.sessionId));
    log.statusMessage = data?.result?.sessionId
      ? null
      : (message ?? 'no sessionId returned');
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;
    log.sessionId = data?.result?.sessionId ?? null;

    return this.logRepository.save(log);
  }

  async getFiStatus(leadId: number): Promise<AccountAggregatorLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const fiRequest = await this.findLatestLog(
      leadId,
      AccountAggregatorMethod.FI_REQUEST,
      AccountAggregatorProvider.LEGACY,
    );
    if (!fiRequest?.sessionId) {
      throw new NotFoundException(
        `No FI request found for lead ${leadId} — call requestFi first`,
      );
    }

    const requestBody = {
      customerId: lead.mobile,
      consentHandleId: fiRequest.consentHandleId,
      consentId: fiRequest.consentId,
      sessionId: fiRequest.sessionId,
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.LEGACY,
      method: AccountAggregatorMethod.FI_STATUS,
      consentHandleId: fiRequest.consentHandleId,
      consentId: fiRequest.consentId,
      sessionId: fiRequest.sessionId,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      result?: { fiRequestStatus?: string };
    }>(requestBody);

    log.respondedAt = new Date();
    log.status = this.resolveStatus(
      status,
      Boolean(data?.result?.fiRequestStatus),
    );
    log.statusMessage = data?.result?.fiRequestStatus ?? message;
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;

    return this.logRepository.save(log);
  }

  async fetchFiData(leadId: number): Promise<{
    transactions: AaTransaction[];
    monthlySummary: AaMonthlySummary[];
  }> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const fiRequest = await this.findLatestLog(
      leadId,
      AccountAggregatorMethod.FI_REQUEST,
      AccountAggregatorProvider.LEGACY,
    );
    if (!fiRequest?.sessionId) {
      throw new NotFoundException(
        `No FI request found for lead ${leadId} — call requestFi first`,
      );
    }

    const requestBody = {
      outputFormat: 'json',
      consentHandleId: fiRequest.consentHandleId,
      sessionId: fiRequest.sessionId,
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.LEGACY,
      method: AccountAggregatorMethod.FI_FETCH_DATA,
      consentHandleId: fiRequest.consentHandleId,
      consentId: fiRequest.consentId,
      sessionId: fiRequest.sessionId,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      result?: { body?: Array<{ fiObjects?: LegacyFiObject[] }> };
    }>(requestBody);

    const fiObject = data?.result?.body?.[0]?.fiObjects?.[0];

    log.respondedAt = new Date();
    log.status = this.resolveStatus(status, Boolean(fiObject));
    log.statusMessage = fiObject ? null : (message ?? 'no fiObjects returned');
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;
    await this.logRepository.save(log);

    const transactions = parseLegacyTransactions(fiObject);
    return { transactions, monthlySummary: summarizeByMonth(transactions) };
  }

  async getAnalyticsReport(leadId: number): Promise<AccountAggregatorLog> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');
    const fiFetchData = await this.findLatestLog(
      leadId,
      AccountAggregatorMethod.FI_FETCH_DATA,
      AccountAggregatorProvider.LEGACY,
    );
    if (!fiFetchData?.sessionId) {
      throw new NotFoundException(
        `No fetched FI data found for lead ${leadId} — call fetchFiData first`,
      );
    }

    const linkRefNo = extractLinkRefNo(fiFetchData.responsePayload);

    const requestBody = {
      consentHandleId: fiFetchData.consentHandleId,
      sessionId: fiFetchData.sessionId,
      linkRefNo,
      pdf: true,
      excel: true,
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.LEGACY,
      method: AccountAggregatorMethod.ANALYTICS_REPORT,
      consentHandleId: fiFetchData.consentHandleId,
      consentId: fiFetchData.consentId,
      sessionId: fiFetchData.sessionId,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      result?: { data?: unknown; pdf?: string; excel?: string };
    }>(requestBody);

    log.respondedAt = new Date();
    log.status = this.resolveStatus(status, Boolean(data?.result?.data));
    log.statusMessage = data?.result?.data
      ? null
      : (message ?? 'no report data returned');
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;

    return this.logRepository.save(log);
  }

  // ---- NOVEL_PATTERN flow: single consent request → async webhook callback → downloaded report ----

  async createConsentRequestNp(leadId: number): Promise<{
    log: AccountAggregatorLog;
    tempUrl: string | null;
  }> {
    const lead = await findOrFail(this.leadRepository, leadId, 'Lead');

    const requestBody = {
      fileNo: leadId,
      name: lead.firstName,
      defaultScreen: 'AA',
      accountType: 'SAVING',
      bank: '',
      contactNo: lead.mobile,
    };

    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.NOVEL_PATTERN,
      method: AccountAggregatorMethod.CONSENT_REQUEST,
      requestPayload: JSON.stringify(requestBody),
      requestedAt: new Date(),
    });

    const { data, status, message } = await this.callVendor<{
      requestId?: string;
      tempUrl?: string;
    }>(requestBody);

    log.respondedAt = new Date();
    log.status = this.resolveStatus(status, Boolean(data?.tempUrl));
    log.statusMessage = data?.tempUrl
      ? null
      : (message ?? 'no tempUrl returned');
    log.errorMessage = message ?? '';
    log.responsePayload = data ? JSON.stringify(data) : null;
    log.consentHandleId = data?.requestId ?? null;

    const saved = await this.logRepository.save(log);
    return { log: saved, tempUrl: data?.tempUrl ?? null };
  }

  /** Called by `AccountAggregatorCallbackController` once the webhook
   * callback reports `status: "Processed"`. Ports `aaDownloadReport()` —
   * plain-text POST body (the docId), not JSON. */
  async downloadNpReport(
    lead: Lead,
    docId: string,
    reportFileName: string | null,
  ): Promise<AccountAggregatorLog> {
    const log = this.logRepository.create({
      lead,
      provider: AccountAggregatorProvider.NOVEL_PATTERN,
      method: AccountAggregatorMethod.FI_FETCH_DATA,
      docId,
      reportFileName,
      requestPayload: docId,
      requestedAt: new Date(),
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(this.downloadUrl(), docId, {
          headers: {
            'Content-Type': 'text/plain',
            'auth-token': this.authToken(),
          },
        }),
      );
      log.respondedAt = new Date();
      log.status = ApiCallStatus.SUCCESS;
      log.errorMessage = '';
      log.responsePayload =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown Account Aggregator download error';
      this.logger.error(
        `Account Aggregator NP report download failed: ${message}`,
      );
      log.respondedAt = new Date();
      log.status = ApiCallStatus.NETWORK_ERROR;
      log.statusMessage = message;
      log.errorMessage = message;
    }

    return this.logRepository.save(log);
  }
}

/** Legacy's `$dateTimeRF->format('Y-m-d\TH:i:s.vO')` under
 * `date_default_timezone_set('Asia/Kolkata')` — always IST (+05:30), not
 * the server's local timezone, matching legacy's hardcoded behavior. */
function toIstDateTimeRange(dateStr: string, timeOfDay: string): string {
  return `${dateStr}T${timeOfDay}.000+05:30`;
}

function parseLegacyTransactions(
  fiObject: LegacyFiObject | undefined,
): AaTransaction[] {
  const rows = fiObject?.Transactions?.Transaction ?? [];
  return rows.map((t) => ({
    date: (t.transactionTimestamp ?? '').split('T')[0],
    amount: Number(t.amount ?? 0),
    type: (t.type ?? '').toLowerCase() === 'credit' ? 'CREDIT' : 'DEBIT',
    narration: t.narration,
    balance:
      t.currentBalance !== undefined ? Number(t.currentBalance) : undefined,
  }));
}

function extractLinkRefNo(responsePayload: string | null): string {
  if (!responsePayload) return '';
  try {
    const parsed = JSON.parse(responsePayload) as {
      result?: { body?: Array<{ fiObjects?: LegacyFiObject[] }> };
    };
    return parsed.result?.body?.[0]?.fiObjects?.[0]?.linkedAccRef ?? '';
  } catch {
    return '';
  }
}

/** Replaces legacy `createBankStatement_from_fiData`'s year/month
 * grouping (credits/debits/net-change/monthly balance) — returned as
 * plain JSON for the frontend to chart, instead of legacy's
 * server-rendered Tailwind/Chart.js HTML page. */
function summarizeByMonth(transactions: AaTransaction[]): AaMonthlySummary[] {
  const byMonth = new Map<string, AaMonthlySummary>();

  for (const txn of transactions) {
    const yearMonth = txn.date.slice(0, 7);
    let summary = byMonth.get(yearMonth);
    if (!summary) {
      summary = {
        yearMonth,
        credits: 0,
        debits: 0,
        netChange: 0,
        closingBalance: null,
        transactionCount: 0,
      };
      byMonth.set(yearMonth, summary);
    }

    if (txn.type === 'CREDIT') {
      summary.credits += txn.amount;
    } else {
      summary.debits += txn.amount;
    }
    summary.netChange = summary.credits - summary.debits;
    summary.transactionCount += 1;
    if (txn.balance !== undefined) {
      summary.closingBalance = txn.balance;
    }
  }

  return [...byMonth.values()].sort((a, b) =>
    a.yearMonth.localeCompare(b.yearMonth),
  );
}
