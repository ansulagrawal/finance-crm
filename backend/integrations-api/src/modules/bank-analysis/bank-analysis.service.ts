import { findOrFail, STORAGE_ADAPTER, type StorageAdapter } from '@finance-crm/common';
import {
  ApiCallStatus,
  BankAnalysisLog,
  BankAnalysisMethod,
  Document,
  Lead,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import { UploadBankAnalysisDto } from './dto/upload-bank-analysis.dto';

const ACCEPTED_UPLOAD_STATUSES = [
  'submitted',
  'processed',
  'in progress',
  'downloaded',
];
const ACCEPTED_DOWNLOAD_STATUSES = ['downloaded', 'processed', 'submitted'];

interface CartbiUploadResponse {
  status?: string;
  docId?: string;
}

interface CartbiDownloadResponse {
  status?: string;
  message?: string;
  data?: unknown;
}

/** Confirmed real CartBI ("Novel Pattern") download-response field
 * shape — verified against a real production report sample (the same
 * analysis engine backs both this bank-statement-upload flow and the
 * separate Account Aggregator "net banking request" flow; field names
 * match exactly, e.g. `AccountAggregatorLog`'s own doc comment). Only
 * `fraudScore`/`camAnalysisData`'s balance fields are read by BRE today
 * (`BreEvaluationService.parseBankAnalysisData`) — this interface covers
 * the additional fields `getResult()` surfaces for a staff-facing results
 * view. */
interface CartbiAccountData {
  bankName?: string;
  bankFullName?: string;
  accountNumber?: string;
  accountName?: string;
  ifscCode?: string;
  accountType?: string;
  periodStart?: string;
  periodEnd?: string;
  fraudScore?: number;
  camAnalysisData?: {
    totalNetCredits?: number;
    averageBalance?: number;
    averageBalanceLastThreeMonth?: number;
    averageBalanceLastSixMonth?: number;
    minBalanceLastThreeMonth?: number;
    minBalanceLastSixMonth?: number;
  };
}

export interface BankAnalysisResult {
  respondedAt: Date | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  accountName: string | null;
  accountType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  fraudScore: number | null;
  totalNetCredits: number | null;
  averageBalance: number | null;
  averageBalanceLastThreeMonth: number | null;
  averageBalanceLastSixMonth: number | null;
  minBalanceLastThreeMonth: number | null;
  minBalanceLastSixMonth: number | null;
}

/**
 * CartBI ("Novel Pattern" internally, per legacy `integration_config.php`)
 * — bank-statement upload + async fraud-score/average-balance analysis.
 * Ports `payday_bank_analysis_call_api_helper.php`'s
 * `bank_analysis_doc_upload_api()`/`bank_analysis_doc_download_api()`.
 * CartBI processes asynchronously and calls back
 * (`BankAnalysisCallbackController`) once analysis completes; the
 * download call is triggered either directly (if CartBI's upload
 * response itself already says "processed"/"downloaded") or from that
 * callback.
 */
@Injectable()
export class BankAnalysisService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(BankAnalysisLog)
    private readonly logRepository: Repository<BankAnalysisLog>,
    @Inject(STORAGE_ADAPTER)
    private readonly storageAdapter: StorageAdapter,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async upload(dto: UploadBankAnalysisDto): Promise<BankAnalysisLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const document = await this.documentRepository.findOne({
      where: { id: dto.documentId, lead: { id: dto.leadId } },
      relations: { documentType: true },
    });
    if (!document) {
      throw new NotFoundException(
        `Document ${dto.documentId} not found for lead ${dto.leadId}`,
      );
    }
    if (document.documentType?.name !== 'BANK STATEMENT') {
      throw new BadRequestException('Document sub type must be BANK STATEMENT');
    }
    if (!document.filePath) {
      throw new BadRequestException(
        `Document ${dto.documentId} has no stored file path`,
      );
    }

    const url = this.configService.getOrThrow<string>(
      'BANK_ANALYSIS_UPLOAD_URL',
    );
    const token = this.configService.getOrThrow<string>(
      'BANK_ANALYSIS_API_TOKEN',
    );

    const requestJson = JSON.stringify({ documentId: dto.documentId });
    let status = ApiCallStatus.API_ERROR;
    let responseJson = '';
    let novelReturnDocId: string | null = null;
    let errors: string | null = null;

    try {
      const buffer = await this.storageAdapter.download(document.filePath);
      const filename = document.filePath.split('/').pop() ?? 'statement.pdf';
      const formData = new FormData();
      formData.append('file', new Blob([new Uint8Array(buffer)]), filename);
      formData.append(
        'metadata',
        JSON.stringify({ password: '', bank: '', name: '' }),
      );

      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: { 'auth-token': token },
        }),
      );
      responseJson = JSON.stringify(response.data);
      const data = response.data as CartbiUploadResponse;
      const normalizedStatus = data.status?.toLowerCase();

      if (
        normalizedStatus &&
        ACCEPTED_UPLOAD_STATUSES.includes(normalizedStatus) &&
        data.docId
      ) {
        status = ApiCallStatus.SUCCESS;
        novelReturnDocId = data.docId;
      } else {
        errors = 'CartBI did not return a usable docId';
      }
    } catch (error) {
      status = ApiCallStatus.NETWORK_ERROR;
      errors = (error as Error).message;
    }

    const log = await this.logRepository.save(
      this.logRepository.create({
        lead,
        document,
        method: BankAnalysisMethod.UPLOAD,
        novelReturnDocId,
        request: requestJson,
        response: responseJson,
        status,
        errors,
        requestedAt: new Date(),
        respondedAt: new Date(),
      }),
    );

    if (novelReturnDocId) {
      document.novelReturnDocId = novelReturnDocId;
      await this.documentRepository.save(document);

      if (status === ApiCallStatus.SUCCESS) {
        try {
          await this.downloadResult(novelReturnDocId);
        } catch {
          // Download-on-upload is a convenience for the "already
          // processed" case; the async callback will retry it either way.
        }
      }
    }

    return log;
  }

  async downloadResult(novelReturnDocId: string): Promise<BankAnalysisLog> {
    const document = await this.documentRepository.findOne({
      where: { novelReturnDocId },
      relations: { lead: true },
    });
    if (!document) {
      throw new NotFoundException(
        `No document found for CartBI docId ${novelReturnDocId}`,
      );
    }

    const url = this.configService.getOrThrow<string>(
      'BANK_ANALYSIS_DOWNLOAD_URL',
    );
    const token = this.configService.getOrThrow<string>(
      'BANK_ANALYSIS_API_TOKEN',
    );

    let status = ApiCallStatus.API_ERROR;
    let responseJson = '';
    let errors: string | null = null;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, novelReturnDocId, {
          headers: {
            'Content-Type': 'text/plain',
            'auth-token': token,
          },
        }),
      );
      responseJson = JSON.stringify(response.data);
      const data = response.data as CartbiDownloadResponse;
      const normalizedStatus = data.status?.toLowerCase();

      if (
        normalizedStatus &&
        ACCEPTED_DOWNLOAD_STATUSES.includes(normalizedStatus) &&
        data.data
      ) {
        status = ApiCallStatus.SUCCESS;
      } else {
        errors = data.message ?? 'CartBI returned no usable data';
      }
    } catch (error) {
      status = ApiCallStatus.NETWORK_ERROR;
      errors = (error as Error).message;
    }

    return this.logRepository.save(
      this.logRepository.create({
        lead: document.lead,
        document,
        method: BankAnalysisMethod.DOWNLOAD,
        novelReturnDocId,
        request: novelReturnDocId,
        response: responseJson,
        status,
        errors,
        requestedAt: new Date(),
        respondedAt: new Date(),
      }),
    );
  }

  /** No equivalent legacy endpoint — CartBI's parsed result was only ever
   * read server-side (by `bre_rule_engine()`), never surfaced to staff.
   * Added so the frontend has a "view CartBI results" screen to call
   * after upload, using the same latest-successful-DOWNLOAD-log lookup
   * `BreEvaluationService.parseBankAnalysisData` already relies on. */
  async getResult(leadId: number): Promise<BankAnalysisResult> {
    const log = await this.logRepository.findOne({
      where: {
        lead: { id: leadId },
        method: BankAnalysisMethod.DOWNLOAD,
        status: ApiCallStatus.SUCCESS,
      },
      order: { id: 'DESC' },
    });
    if (!log?.response) {
      throw new NotFoundException(
        `No completed bank analysis found for lead ${leadId} yet — upload a bank statement and wait for CartBI's callback`,
      );
    }

    const parsed = JSON.parse(log.response) as {
      data?: CartbiAccountData[];
    };
    const first = parsed.data?.[0];
    if (!first) {
      throw new NotFoundException(
        `Bank analysis for lead ${leadId} returned no account data`,
      );
    }

    return {
      respondedAt: log.respondedAt,
      accountNumber: first.accountNumber?.trim() ?? null,
      ifscCode: first.ifscCode?.trim().toUpperCase() ?? null,
      bankName: first.bankFullName?.trim() ?? first.bankName?.trim() ?? null,
      accountName: first.accountName?.trim() ?? null,
      accountType: first.accountType?.trim() ?? null,
      periodStart: first.periodStart ?? null,
      periodEnd: first.periodEnd ?? null,
      fraudScore: first.fraudScore ?? null,
      totalNetCredits: first.camAnalysisData?.totalNetCredits ?? null,
      averageBalance: first.camAnalysisData?.averageBalance ?? null,
      averageBalanceLastThreeMonth:
        first.camAnalysisData?.averageBalanceLastThreeMonth ?? null,
      averageBalanceLastSixMonth:
        first.camAnalysisData?.averageBalanceLastSixMonth ?? null,
      minBalanceLastThreeMonth:
        first.camAnalysisData?.minBalanceLastThreeMonth ?? null,
      minBalanceLastSixMonth:
        first.camAnalysisData?.minBalanceLastSixMonth ?? null,
    };
  }
}
