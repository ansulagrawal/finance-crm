import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  Lead,
  LeadCustomer,
  PoiVerificationLog,
  PoiVerificationProvider,
  VendorApiCacheProvider,
  VendorApiCacheType,
} from '@finance-crm/database';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { VendorApiCacheService } from '../../common/vendor-api-cache.service';
import { DigitapClientService } from '../digitap/digitap-client.service';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { OcrDocumentDto } from './dto/ocr-document.dto';
import { VerifyDualPanDto } from './dto/verify-dual-pan.dto';
import { VerifyPanDto } from './dto/verify-pan.dto';

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

/** Ports `common_parse_name()` (`functions.inc.php`) exactly: first token is
 * the first name, last token is the surname (empty if there's only one
 * token), everything between is the middle name. */
function parsePanName(fullName: string): {
  firstName: string;
  middleName: string;
  lastName: string;
} {
  const tokens = fullName
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);
  if (tokens.length === 0) {
    return { firstName: '', middleName: '', lastName: '' };
  }
  return {
    firstName: tokens[0],
    middleName: tokens.slice(1, -1).join(' '),
    lastName: tokens.length > 1 ? tokens[tokens.length - 1] : '',
  };
}

const DIGITAP_PAN_OCR_URL = 'https://api.digitap.ai/ocr/v1/pan';
const DIGITAP_AADHAAR_OCR_URL = 'https://api.digitap.ai/ocr/v1/aadhaar';

/**
 * Proof-of-identity verification/OCR — ports `payday_poi_verification_api.php`
 * (PAN fetch, `POST v3/pan/fetchV2`, methodId 1) and `payday_poi_ocr_api.php`
 * (PAN OCR methodId 2, Aadhaar OCR methodId 3). Legacy logs all three into
 * the same `api_poi_verification_logs` table distinguished only by method
 * id — kept identical here.
 *
 * PAN fetch (methodId 1) is Signzy-only — legacy has no Digitap equivalent
 * for that specific endpoint. OCR (methodId 2/3) is pluggable via
 * `OCR_PROVIDER` (`signzy` default, `digitap` alternate) — legacy
 * dispatches to either by name (`payday_poi_ocr_api.php`'s
 * `GET_PAN_OCR_DIGITAP`/`GET_AADHAAR_OCR_DIGITAP` method ids), same
 * function, different provider. Digitap's Aadhaar OCR legacy flow merges a
 * second "back image" call to get father-name/address (only available on
 * the back of the card) — not replicated here since `OcrDocumentDto` only
 * carries one document URL, matching the existing Signzy-based method
 * signature; `fatherName` stays null on the Digitap Aadhaar path.
 */
@Injectable()
export class PoiVerificationService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(PoiVerificationLog)
    private readonly logRepository: Repository<PoiVerificationLog>,
    @InjectRepository(LeadCustomer)
    private readonly leadCustomerRepository: Repository<LeadCustomer>,
    private readonly signzy: SignzyClientService,
    private readonly digitap: DigitapClientService,
    private readonly configService: ConfigService,
    private readonly vendorApiCache: VendorApiCacheService,
  ) {}

  /**
   * PAN fetch is static per-person data — checks the cross-lead
   * `VendorApiCache` first (ports legacy `customer_api_data`'s intent of
   * avoiding a redundant billed vendor call when the same PAN was already
   * fetched for an earlier lead) before hitting Signzy.
   */
  async verifyPan(dto: VerifyPanDto): Promise<PoiVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const cached = await this.vendorApiCache.get(
      dto.pan,
      VendorApiCacheProvider.SIGNZY,
      VendorApiCacheType.PAN_FETCH,
    );
    if (cached) {
      const response = JSON.parse(cached.response ?? '{}') as {
        result?: { fatherName?: string };
      };
      return this.saveLog(
        lead,
        1,
        PoiVerificationProvider.SIGNZY,
        dto.pan,
        response?.result?.fatherName ?? null,
        {
          requestJson: cached.request ?? '',
          responseJson: cached.response ?? '',
          errorMessage: null,
        },
      );
    }

    const result = await this.signzy.post('v3/pan/fetchV2', {
      number: dto.pan,
    });
    const response = result.data as {
      result?: { number?: string; name?: string; fatherName?: string };
    };

    if (response?.result?.number) {
      await this.vendorApiCache.set(
        dto.pan,
        VendorApiCacheProvider.SIGNZY,
        VendorApiCacheType.PAN_FETCH,
        result.responseJson,
        lead,
        result.requestJson,
      );
    }

    return this.saveLog(
      lead,
      1,
      PoiVerificationProvider.SIGNZY,
      dto.pan,
      response?.result?.fatherName ?? null,
      result,
    );
  }

  /**
   * Dual/alternate-PAN fraud check — ports `pan_verifcaition_v3_api_call()`'s
   * `dual_pancard` branch (`payday_poi_verification_api.php`), used to check
   * whether an alternate PAN a staff member enters actually belongs to this
   * same lead (queries Signzy for the alternate PAN, compares the returned
   * name against `lead_customer`'s stored name — not against the alternate
   * PAN's own lead).
   *
   * Legacy's only real caller of this, `VerificationController::
   * getPanNoOnDeteail()`, has two independent bugs, neither reproduced here:
   * (1) it calls `CommonComponent::call_pan_verification_api($lead_id,
   * $request_array)`, but that method's real signature only takes
   * `$lead_id` — PHP silently drops the second argument, so
   * `$request_array['dual_pancard']` never actually reaches the verification
   * function; every "dual PAN" check in production has always silently
   * re-verified the lead's own existing PAN against itself, never the
   * alternate PAN the user typed in. (2) it then reads the (always-primary)
   * result's `pan_valid_status == 2` as *success* ("PAN Verified"), the
   * inverse of every other read of that field in the same file (`1` =
   * name matched, `2` = mismatch) — confirmed via `pan_verifcaition_v3_api_call()`
   * itself, which sets `pan_valid_status = 1` when the name matches. This
   * port fixes both: the alternate PAN is actually queried, and `1` means
   * matched.
   */
  async verifyDualPan(
    dto: VerifyDualPanDto,
  ): Promise<{ log: PoiVerificationLog; isNameMatch: boolean }> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const customer = await this.leadCustomerRepository.findOne({
      where: { lead: { id: dto.leadId } },
    });

    if (
      customer?.pancard &&
      normalizeName(customer.pancard) === normalizeName(dto.pan)
    ) {
      throw new BadRequestException(
        'PAN number already exists on this lead — use a different PAN number.',
      );
    }

    const result = await this.signzy.post('v3/pan/fetchV2', {
      number: dto.pan,
    });
    const response = result.data as {
      result?: { number?: string; name?: string; fatherName?: string };
    };

    const isVerified = Boolean(response?.result?.number);
    const nameParts = parsePanName(response?.result?.name ?? '');
    const isNameMatch =
      isVerified &&
      normalizeName(customer?.firstName) ===
        normalizeName(nameParts.firstName) &&
      normalizeName(customer?.middleName) ===
        normalizeName(nameParts.middleName) &&
      normalizeName(customer?.surName) === normalizeName(nameParts.lastName);

    const log = this.logRepository.create({
      lead,
      method: 1,
      provider: PoiVerificationProvider.SIGNZY,
      proofNo: response?.result?.number ?? dto.pan,
      fatherName: response?.result?.fatherName ?? null,
      isOtherPancard: true,
      request: result.requestJson,
      response: result.responseJson,
      status: isVerified ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    const saved = await this.logRepository.save(log);
    return { log: saved, isNameMatch };
  }

  async ocrPan(dto: OcrDocumentDto): Promise<PoiVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    if (this.ocrProvider() === 'digitap') {
      const result = await this.digitap.postMultipart(
        DIGITAP_PAN_OCR_URL,
        dto.documentUrl,
        {
          clientRefId: String(dto.leadId),
          isBlackWhiteCheck: 'yes',
          confidence: 'yes',
          fraudCheck: 'yes',
        },
      );
      const response = result.data as {
        statusCode?: string;
        result?: Array<{
          details?: {
            pan_no?: { value?: string };
            father?: { value?: string };
          };
        }>;
      };
      const details = response?.result?.[0]?.details;
      return this.saveLog(
        lead,
        2,
        PoiVerificationProvider.DIGITAP,
        details?.pan_no?.value ?? null,
        details?.father?.value ?? null,
        result,
      );
    }

    const result = await this.signzy.post('v3/pan/extractions', {
      documentUrl: dto.documentUrl,
    });
    const response = result.data as {
      result?: { number?: string; fatherName?: string };
    };

    return this.saveLog(
      lead,
      2,
      PoiVerificationProvider.SIGNZY,
      response?.result?.number ?? null,
      response?.result?.fatherName ?? null,
      result,
    );
  }

  async ocrAadhaar(dto: OcrDocumentDto): Promise<PoiVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    if (this.ocrProvider() === 'digitap') {
      const result = await this.digitap.postMultipart(
        DIGITAP_AADHAAR_OCR_URL,
        dto.documentUrl,
        {
          clientRefId: String(dto.leadId),
          isBlackWhiteCheck: 'yes',
          confidence: 'yes',
          fraudCheck: 'yes',
        },
      );
      const response = result.data as {
        result?: Array<{ details?: { aadhaar?: { value?: string } } }>;
      };
      const uid = response?.result?.[0]?.details?.aadhaar?.value ?? null;
      return this.saveLog(
        lead,
        3,
        PoiVerificationProvider.DIGITAP,
        uid,
        null,
        result,
      );
    }

    const result = await this.signzy.post('v3/aadhaar/extraction', {
      documentUrl: dto.documentUrl,
    });
    const response = result.data as { result?: { uid?: string } };

    return this.saveLog(
      lead,
      3,
      PoiVerificationProvider.SIGNZY,
      response?.result?.uid ?? null,
      null,
      result,
    );
  }

  private ocrProvider(): string {
    return this.configService.get<string>('OCR_PROVIDER', 'signzy');
  }

  private async saveLog(
    lead: Lead,
    method: number,
    provider: PoiVerificationProvider,
    proofNo: string | null,
    fatherName: string | null,
    result: {
      requestJson: string;
      responseJson: string;
      errorMessage: string | null;
    },
  ): Promise<PoiVerificationLog> {
    const log = this.logRepository.create({
      lead,
      method,
      provider,
      proofNo,
      fatherName,
      request: result.requestJson,
      response: result.responseJson,
      status: proofNo ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
