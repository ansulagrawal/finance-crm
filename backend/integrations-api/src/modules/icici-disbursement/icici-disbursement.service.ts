import { findOrFail, readPemFromConfig } from '@finance-crm/common';
import {
  ApiCallStatus,
  DisbursementApiLog,
  DisbursementApiMethod,
  Lead,
  LoanPaymentType,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import type { DisburseViaIciciDto } from './dto/disburse-via-icici.dto';
import type { IciciDisbursementStatusDto } from './dto/icici-disbursement-status.dto';
import { decryptResponse, encryptRequest } from './icici-envelope.util';

/**
 * ICICI API-Banking composite-payment — the real bank transfer that moves loan
 * money to a customer. Ports `icici_disburse_loan_amount_api()` and
 * `icici_disburse_loan_status_api()` from
 * `helpers/integration/payday_disbursement_icici_helper.php`.
 *
 * **Scope split**: this owns only the vendor call — build the payload, encrypt,
 * POST, decrypt, classify, log. Every business precondition (loan status, ₹
 * limits, banking details on file, and critically the
 * already-disbursed/in-flight guard) belongs to `core-api`'s
 * `DisbursalService`, which owns the loan lifecycle and the
 * `lead_disbursement_trans_log` this must never bypass.
 *
 * **NEFT is not implemented, matching legacy.** Legacy only routes
 * `payment_type_id == 1` (IMPS) to the API, and its NEFT response branch is
 * commented out — so no NEFT request payload was ever built there. A NEFT
 * request here is rejected rather than guessed at.
 *
 * **Unverified against the real API.** No sandbox or credentials were
 * available; this is written from the legacy source. See `docs/TODO.md`.
 */

/** Legacy's own `x-priority` header value. */
const X_PRIORITY = '0100';

/** Legacy `$sender_mobile` — a fixed corporate number, not the customer's. */
const SENDER_MOBILE = '9999999780';

/** Legacy `$retailerCode = "rcode"` verbatim. */
const RETAILER_CODE = 'rcode';

/** Beneficiary name is truncated to 15 chars for the IMPS payment reference,
 * matching legacy's `trim(substr($beneName, 0, 15))`. */
const IMPS_BENE_NAME_MAX = 15;

export type IciciDisbursementOutcome =
  /** ICICI confirmed the transfer. `bankReferenceNo` is set. */
  | { result: 'SUCCESS'; bankReferenceNo: string; raw: string }
  /** ICICI explicitly rejected it. The money did NOT move. */
  | { result: 'REJECTED'; error: string; raw: string | null }
  /**
   * We do not know whether the money moved — network failure, timeout,
   * undecryptable response, or a success-shaped response missing its
   * `BankRRN`. The caller MUST treat this as in-flight and must not retry;
   * resolve with the status API instead.
   */
  | { result: 'UNKNOWN'; error: string; raw: string | null };

@Injectable()
export class IciciDisbursementService {
  private readonly logger = new Logger(IciciDisbursementService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(DisbursementApiLog)
    private readonly logRepository: Repository<DisbursementApiLog>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async disburse(dto: DisburseViaIciciDto): Promise<DisbursementApiLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    if (dto.paymentType !== LoanPaymentType.IMPS) {
      // Not a guess-and-hope: legacy never built a NEFT payload, so there is
      // no known-correct request shape to send.
      return this.persist(dto, lead, {
        result: 'REJECTED',
        error:
          'Only IMPS is supported for online disbursal. NEFT was never implemented against this API.',
        raw: null,
      });
    }

    const beneNameForRef = dto.beneficiaryName
      .slice(0, IMPS_BENE_NAME_MAX)
      .trim();
    const payload: Record<string, string> = {
      localTxnDtTime: formatLocalTxnDateTime(new Date()),
      beneAccNo: dto.beneficiaryAccountNumber,
      beneIFSC: dto.beneficiaryIfscCode,
      amount: String(dto.amount),
      // Same value as the envelope's requestId — this is what makes a repeat
      // call idempotent on ICICI's side instead of a second payment.
      tranRefNo: dto.transactionReferenceNo,
      paymentRef: `IMPS/ICICI/${dto.loanNumber}/${beneNameForRef}/${dto.amount}`,
      senderName: this.configService.get<string>('COMPANY_NAME', ''),
      mobile: SENDER_MOBILE,
      retailerCode: RETAILER_CODE,
      passCode: this.configService.getOrThrow<string>(
        'ICICI_DISBURSAL_PASSCODE',
      ),
      bcID: this.configService.getOrThrow<string>('ICICI_DISBURSAL_BC_ID'),
    };

    const outcome = await this.call(
      this.configService.get<string>(
        'ICICI_DISBURSAL_PAYMENT_URL',
        'https://apibankingone.icici.bank.in/api/v1/composite-payment',
      ),
      payload,
      dto.transactionReferenceNo,
      (data) => {
        // Legacy's exact success test: ActCode 0 AND success true AND a BankRRN.
        const ok =
          String(data.ActCode) === '0' &&
          (data.success === true || String(data.success) === 'true');
        if (!ok) {
          return {
            result: 'REJECTED' as const,
            error: extractError(data),
          };
        }
        if (!data.BankRRN) {
          // Success-shaped but no bank reference: legacy threw here too. The
          // transfer may well have happened, so this is UNKNOWN, not REJECTED.
          return {
            result: 'UNKNOWN' as const,
            error: 'BankRRN is not available in IMPS response',
          };
        }
        return {
          result: 'SUCCESS' as const,
          bankReferenceNo: String(data.BankRRN),
        };
      },
    );

    return this.persist(dto, lead, outcome, payload);
  }

  /**
   * Ports `icici_disburse_loan_status_api()`. This is how an `UNKNOWN` outcome
   * gets resolved — never by re-sending the payment.
   */
  async checkStatus(
    dto: IciciDisbursementStatusDto,
  ): Promise<DisbursementApiLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const payload: Record<string, string> = {
      tranRefNo: dto.transactionReferenceNo,
      passCode: this.configService.getOrThrow<string>(
        'ICICI_DISBURSAL_PASSCODE',
      ),
      bcID: this.configService.getOrThrow<string>('ICICI_DISBURSAL_BC_ID'),
    };

    const outcome = await this.call(
      this.configService.get<string>(
        'ICICI_DISBURSAL_STATUS_URL',
        'https://apibankingone.icici.bank.in/api/v1/composite-status',
      ),
      payload,
      dto.transactionReferenceNo,
      (data) => {
        const ok =
          String(data.ActCode) === '0' &&
          (data.success === true || String(data.success) === 'true');
        if (ok && data.BankRRN) {
          return {
            result: 'SUCCESS' as const,
            bankReferenceNo: String(data.BankRRN),
          };
        }
        // A status query that does not confirm success is not proof of
        // failure — the transaction may still be settling.
        return { result: 'UNKNOWN' as const, error: extractError(data) };
      },
    );

    return this.persist(
      {
        leadId: dto.leadId,
        transactionReferenceNo: dto.transactionReferenceNo,
        paymentType: LoanPaymentType.IMPS,
      },
      lead,
      outcome,
      payload,
      DisbursementApiMethod.STATUS_CHECK,
    );
  }

  private async call(
    url: string,
    payload: Record<string, string>,
    requestId: string,
    classify: (
      data: Record<string, unknown>,
    ) =>
      | { result: 'SUCCESS'; bankReferenceNo: string }
      | { result: 'REJECTED'; error: string }
      | { result: 'UNKNOWN'; error: string },
  ): Promise<IciciDisbursementOutcome & { encryptedRequest?: string }> {
    let envelopeBody: string;
    try {
      // By value from config (Secrets Manager or .env), never a path on disk —
      // see readPemFromConfig. A missing or malformed certificate throws here,
      // which the catch below classifies REJECTED: nothing left this process,
      // so we know for certain no money moved.
      const certificate = readPemFromConfig(
        this.configService,
        'ICICI_DISBURSAL_PUBLIC_CERT',
      );
      envelopeBody = encryptRequest(payload, certificate, requestId).body;
    } catch (error) {
      // Failed before anything left this process, so the money definitely did
      // not move — the one case that is safely REJECTED rather than UNKNOWN.
      return {
        result: 'REJECTED',
        error: `Could not build the ICICI request: ${messageOf(error)}`,
        raw: null,
      };
    }

    let encryptedResponse: string;
    try {
      const response = await firstValueFrom(
        this.httpService.post<unknown>(url, envelopeBody, {
          headers: {
            'cache-control': 'no-cache',
            accept: 'application/json',
            'content-type': 'application/json',
            apikey: this.configService.getOrThrow<string>(
              'ICICI_DISBURSAL_API_KEY',
            ),
            'x-priority': X_PRIORITY,
          },
          // Legacy used a 300s cURL timeout. Keep it: cutting a payment call
          // short converts a probably-successful transfer into an UNKNOWN.
          timeout: Number(
            this.configService.get('ICICI_DISBURSAL_TIMEOUT_MS', 300_000),
          ),
        }),
      );
      encryptedResponse =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data);
    } catch (error) {
      this.logger.error(
        `ICICI disbursal call failed for ${requestId}: ${messageOf(error)}`,
      );
      return {
        result: 'UNKNOWN',
        error: `Transport failure, outcome unknown: ${messageOf(error)}`,
        raw: null,
      };
    }

    let plaintext: string;
    try {
      plaintext = decryptResponse(
        encryptedResponse,
        readPemFromConfig(this.configService, 'ICICI_DISBURSAL_PRIVATE_KEY'),
      );
    } catch (error) {
      return {
        result: 'UNKNOWN',
        error: `Could not decrypt the ICICI response: ${messageOf(error)}`,
        raw: encryptedResponse,
      };
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(plaintext) as Record<string, unknown>;
    } catch {
      return {
        result: 'UNKNOWN',
        error: 'ICICI response was not valid JSON after decryption',
        raw: plaintext,
      };
    }

    const classified = classify(data);
    return classified.result === 'SUCCESS'
      ? { ...classified, raw: plaintext }
      : { ...classified, raw: plaintext };
  }

  private async persist(
    dto: {
      leadId: number;
      transactionReferenceNo: string;
      paymentType: LoanPaymentType;
      disbursementBankId?: number;
      requestedByUserId?: number;
      loanNumber?: string;
      beneficiaryAccountNumber?: string;
      beneficiaryIfscCode?: string;
      beneficiaryName?: string;
    },
    lead: Lead,
    outcome: IciciDisbursementOutcome,
    requestPayload?: Record<string, string>,
    method: DisbursementApiMethod = DisbursementApiMethod.DISBURSE,
  ): Promise<DisbursementApiLog> {
    const log = this.logRepository.create({
      lead,
      disbursementBankId: dto.disbursementBankId ?? null,
      userId: dto.requestedByUserId ?? null,
      method,
      transactionType: dto.paymentType,
      referenceNo: dto.transactionReferenceNo,
      bankReferenceNo:
        outcome.result === 'SUCCESS' ? outcome.bankReferenceNo : null,
      paymentReferenceNo: requestPayload?.paymentRef ?? null,
      loanNumber: dto.loanNumber ?? null,
      beneficiaryAccountNumber: dto.beneficiaryAccountNumber ?? null,
      beneficiaryIfscCode: dto.beneficiaryIfscCode ?? null,
      beneficiaryName: dto.beneficiaryName ?? null,
      // Never log the plaintext request: it carries `passCode`/`bcID`, which
      // are standing credentials, not per-transaction values.
      request: requestPayload
        ? JSON.stringify(redactSecrets(requestPayload))
        : null,
      response: outcome.raw,
      encryptedRequest: null,
      encryptedResponse: null,
      status:
        outcome.result === 'SUCCESS'
          ? ApiCallStatus.SUCCESS
          : ApiCallStatus.API_ERROR,
      errors: outcome.result === 'SUCCESS' ? null : outcome.error,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    const saved = await this.logRepository.save(log);
    // Surfaced on the log row so `core-api` can branch without re-parsing.
    (saved as DisbursementApiLog & { outcome?: string }).outcome =
      outcome.result;
    return saved;
  }
}

/** Legacy's `date("YmdHis")`. */
function formatLocalTxnDateTime(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

/** Legacy's error-message precedence. */
function extractError(data: Record<string, unknown>): string {
  for (const key of ['ActCodeDesc', 'MESSAGE', 'Response', 'description']) {
    const value = data[key];
    if (value) {
      return String(value);
    }
  }
  return 'ICICI rejected the disbursal without a stated reason';
}

function redactSecrets(
  payload: Record<string, string>,
): Record<string, string> {
  const { passCode, bcID, ...rest } = payload;
  return { ...rest, passCode: '[redacted]', bcID: '[redacted]' };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
