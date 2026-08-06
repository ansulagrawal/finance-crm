import { findOrFail } from '@finance-crm/common';
import { BureauType, CrifBureauLog, Lead } from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { FetchCrifReportDto } from './dto/fetch-crif-report.dto';
import { InitiateCrifSignzyDto } from './dto/initiate-crif-signzy.dto';

/**
 * Surepass CRIF bureau report — ports `payday_surepass_crif_api.php`
 * (`crif_bureau_report_json_and_pdf_api_call`), `POST
 * https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf`,
 * Bearer-token auth. This is the currently-live bureau vendor in the legacy
 * app. A separate Signzy CRIF passthrough (`fetchReportViaSignzy()` below)
 * also exists in legacy but is commented out of the live code path
 * (`CibilController::index()`) — Surepass is the default; Signzy stays
 * available but dormant.
 *
 * Legacy retries this call once per known mobile number for the PAN until
 * one returns `status_code === 200`; this adapter takes a single mobile
 * number per call and leaves that retry-across-numbers behavior to the
 * caller (core-api, which owns the lead's mobile-number history).
 *
 * `CrifBureauLog` (`tbl_cibil_log`) is shaped around 3 real legacy API steps
 * (`api1`/`api2`/`api3` request+response) — only `bureauStatus` (a short,
 * legacy-encoded flag whose value convention isn't confirmed anywhere in
 * this codebase — it's exclusive to the Surepass flow, never set by Signzy)
 * and `applicationId` (Signzy's own `requestId`, used purely as the
 * cross-row correlation key for steps 2/3) are left unset by this method.
 * `fetchReport()` (Surepass) only implements step 1, stored as
 * `api1Request`/`api1Response`; success/failure for `getReportBytes` is
 * inferred from whether `cibilScore` got populated, not a status column.
 * `cibil_file` (`reportFile`) is a `longtext` column holding the actual PDF
 * bytes (base64), not a storage-adapter key — legacy stores the file
 * inline, so this port downloads Surepass's `credit_report_link` and
 * stores it the same way instead of going through `StorageAdapter`.
 */
@Injectable()
export class CrifBureauService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(CrifBureauLog)
    private readonly logRepository: Repository<CrifBureauLog>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly signzyClient: SignzyClientService,
  ) {}

  async fetchReport(dto: FetchCrifReportDto): Promise<CrifBureauLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const body = {
      first_name: dto.firstName,
      last_name: dto.lastName,
      mobile: dto.mobile,
      pan: dto.pan,
      consent: 'Y',
      raw: true,
    };
    const requestJson = JSON.stringify(body);
    const url = this.configService.get<string>(
      'SUREPASS_CRIF_URL',
      'https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf',
    );

    let responseJson = '';
    let cibilScore: string | null = null;
    let reportFile: string | null = null;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.configService.getOrThrow<string>('SUREPASS_API_TOKEN')}`,
          },
        }),
      );
      responseJson = JSON.stringify(response.data);
      const data = response.data as {
        status_code?: number;
        success?: boolean;
        data?: {
          credit_report?: {
            SCORES?: { SCORE?: { 'SCORE-VALUE'?: string } };
          };
          credit_report_link?: string;
        };
      };
      if (data?.status_code === 200 && data?.success === true) {
        cibilScore =
          data.data?.credit_report?.SCORES?.SCORE?.['SCORE-VALUE'] ?? null;

        const reportLink = data.data?.credit_report_link;
        if (reportLink) {
          const reportResponse = await firstValueFrom(
            this.httpService.get(reportLink, { responseType: 'arraybuffer' }),
          );
          reportFile = Buffer.from(reportResponse.data as ArrayBuffer).toString(
            'base64',
          );
        }
      }
    } catch {
      // Network/API failure — cibilScore/reportFile stay null, which is the
      // only stored success signal this entity has (see class doc comment).
    }

    const log = this.logRepository.create({
      lead,
      mobile: dto.mobile,
      api1Request: requestJson,
      api1Response: responseJson,
      cibilScore,
      reportFile,
      bureauType: BureauType.CRIF,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return this.logRepository.save(log);
  }

  /**
   * Ports `payday_signzy_crif_api.php`'s 3-step Signzy CRIF passthrough
   * (`crif_bureau_report_json_and_pdf_api_call` -> `createCrifConsent` ->
   * `decryptCrifResponse`), chained synchronously exactly like legacy: step
   * 1 (`POST v3/test-encrypt-data`) creates the log row and, on success,
   * immediately triggers step 2 (`POST .../create-bureau-consent`), which
   * immediately triggers step 3 (`POST .../test-decrypt-data`) — the same
   * `runCurl()` helper legacy reuses for all 3 calls, branching on response
   * shape (`decryptedData.requestId` -> insert, `responseData` -> step 2
   * update, anything else -> step 3 final update) rather than an explicit
   * step number. `otpBypass: true` is always set (matching legacy), so this
   * flow is designed to complete entirely within this one call — legacy's
   * `callbackUrl`/`redirectUrl` request fields are for the OTP-required path
   * this bypasses, and legacy never implemented a handler for that callback
   * either (no controller/route for `/api/callback/signzy-crif` exists
   * anywhere in the PHP source) — there is no real payload shape to port,
   * so this adapter doesn't fabricate a callback endpoint for it.
   *
   * Legacy's final step also writes `cibil_url` (the consent/redirect URL)
   * into `tbl_cibil_log` — that column does not exist on the real table
   * (confirmed against `legacy-schema.sql`; writing it would throw a MySQL
   * "unknown column" error, consistent with this flow being commented out
   * and apparently never run successfully in production). This port doesn't
   * invent the column — the URL is returned directly instead, the same
   * `{log, ...extra}` shape already used for `AdjustDeviceLog`'s uncaptured
   * fields.
   */
  async fetchReportViaSignzy(
    dto: InitiateCrifSignzyDto,
  ): Promise<{ log: CrifBureauLog; consentUrl: string | null }> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const gender =
      dto.gender.charAt(0).toUpperCase() + dto.gender.slice(1).toLowerCase();
    const requestBody = {
      phoneNumber: dto.mobile,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dob,
      panNumber: dto.pan,
      gender,
      address: `${dto.addressLine1}, ${dto.addressLine2}, ${dto.landmark}, ${dto.city}, ${dto.state}`,
      pincode: dto.pincode,
      callbackUrl: 'https://financecrm.com/api/callback/signzy-crif',
      productName: ['crif'],
      otpBypass: true,
      redirectUrl: 'https://financecrm.com',
    };

    const step1 = await this.signzyClient.post(
      'v3/test-encrypt-data',
      requestBody,
    );
    const step1Data = step1.data as {
      decryptedData?: { requestId?: string };
      encryptedData?: unknown;
    } | null;
    const applicationId = step1Data?.decryptedData?.requestId ?? null;

    const log = this.logRepository.create({
      lead,
      mobile: dto.mobile,
      applicationId,
      api1Request: step1.requestJson,
      api1Response: step1.responseJson,
      bureauType: BureauType.CRIF,
      isActive: false,
      isDeleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const saved = await this.logRepository.save(log);

    if (!applicationId || !step1Data?.encryptedData) {
      return { log: saved, consentUrl: null };
    }

    const step2 = await this.signzyClient.post(
      'https://api.signzy.app/api/v3/create-bureau-consent',
      { requestData: step1Data.encryptedData },
    );
    saved.api2Request = step2.requestJson;
    saved.api2Response = step2.responseJson;
    await this.logRepository.save(saved);

    const step2Data = step2.data as { responseData?: unknown } | null;
    if (!step2Data?.responseData) {
      return { log: saved, consentUrl: null };
    }

    const step3 = await this.signzyClient.post(
      'https://api.signzy.app/api/v3/test-decrypt-data',
      { requestData: step2Data.responseData },
    );
    const step3Data = step3.data as { result?: { url?: string } } | null;
    // api3Request/api3Response are varchar(100) in the real legacy schema
    // (unlike api1/api2's text/longtext) — a genuine legacy limitation, not
    // something this port introduces. Truncated to fit rather than left to
    // fail the save.
    saved.api3Request = step3.requestJson.slice(0, 100);
    saved.api3Response = step3.responseJson.slice(0, 100);
    saved.isActive = true;
    saved.isDeleted = false;
    const final = await this.logRepository.save(saved);

    return { log: final, consentUrl: step3Data?.result?.url ?? null };
  }

  /** Downloads the stored report PDF bytes for the lead's most recent
   * successful bureau pull — matches every other document endpoint in
   * this codebase (stream bytes back, not a signed URL). */
  async getReportBytes(leadId: number): Promise<Buffer> {
    await findOrFail(this.leadRepository, leadId, 'Lead');
    const log = await this.logRepository.findOne({
      where: { lead: { id: leadId } },
      order: { id: 'DESC' },
    });
    if (!log?.reportFile) {
      throw new NotFoundException(
        `No stored CRIF report PDF found for lead ${leadId}`,
      );
    }
    return Buffer.from(log.reportFile, 'base64');
  }
}
