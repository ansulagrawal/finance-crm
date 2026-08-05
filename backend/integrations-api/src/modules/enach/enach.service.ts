import {
  ApiCallStatus,
  EnachLog,
  EnachProvider,
  EnachRequestType,
  Loan,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import { InitiateEnachTransactionDto } from './dto/initiate-enach-transaction.dto';

/**
 * ICICI eNACH mandate transaction scheduling — ports `payday_enach_api.php`
 * (`initiate_transation_api_call`). **Legacy currently ships this hardcoded**
 * (`$hardcoded = true` in the source — it returns a canned response and
 * never actually calls the live ICICI endpoint), unlike every other
 * integration in this codebase. Per the "real adapters, not mocks"
 * architecture decision, this port makes the actual HTTP call rather than
 * reproducing that stub — gated behind `ENACH_ICICI_SCHEDULING_URL`/
 * `ENACH_ICICI_MERCHANTID`, which won't function until real ICICI eNACH
 * credentials are supplied (expected, same as every other adapter here).
 *
 * `EnachLog.provider`: confirmed against `payday_enach_api.php`/
 * `ICICIeNachController.php` — both always write `enach_provider => 1`,
 * which per the column's own DB comment (`1=>Worldline 2=>DigiTap`) is
 * `WORLDLINE`, not a DigiTap-branded client — ICICI's eNACH is routed
 * through Worldline as the underlying gateway. `requestType` stays
 * `REGISTER`: legacy's `TRANSACTION_INITIATE` operation (scheduling a
 * transaction against an already-registered mandate, i.e. what this method
 * does) actually logs to a *different* table in the PHP source,
 * `api_enach_transaction_schedule_logs` — confirmed via a real UAT and prod
 * schema export that this table doesn't exist in either database, so that
 * `insertTable()` call is dead/broken in the legacy app itself. The 4
 * fields it tried to log (`aetl_requested_amount`/`aetl_deduct_request_
 * date`/`aetl_request_id`/`aetl_status_id`) match by type/shape 4 columns
 * that exist directly on `loan` in prod only (`loan_enach_schedule_
 * amount`/`_date`/`_identifier`/`_status`) — this method writes the
 * schedule there instead, since that's where prod's schema actually put
 * it. `REGISTER` is kept on the `EnachLog` row only because `EnachLog` is
 * the call-log entity this method already writes to; it is not a claim
 * this call is a mandate registration.
 */
@Injectable()
export class EnachService {
  constructor(
    @InjectRepository(EnachLog)
    private readonly logRepository: Repository<EnachLog>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async initiateTransaction(
    dto: InitiateEnachTransactionDto,
  ): Promise<EnachLog> {
    const merchantId = this.configService.getOrThrow<string>(
      'ENACH_ICICI_MERCHANTID',
    );
    const url = this.configService.getOrThrow<string>(
      'ENACH_ICICI_SCHEDULING_URL',
    );
    const transactionId = String(Math.floor(Math.random() * 999_000) + 999);

    const body = {
      merchant: { identifier: merchantId },
      payment: {
        instrument: { identifier: 'eNach' },
        instruction: {
          amount: dto.requestedAmount,
          endDateTime: this.formatDdMmYyyy(dto.requestedEndDate),
          identifier: dto.mandateRegistrationNo,
        },
      },
      transaction: {
        deviceIdentifier: 'S',
        type: '002',
        currency: 'INR',
        identifier: transactionId,
        subType: '003',
        requestType: 'TSI',
      },
    };
    const requestJson = JSON.stringify(body);

    let responseJson = '';
    let statusCode: string | null = null;
    let errorMessage: string | null = null;
    let status = ApiCallStatus.API_ERROR;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, body, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      responseJson = JSON.stringify(response.data);
      const data = response.data as {
        paymentMethod?: {
          paymentTransaction?: { statusCode?: string; errorMessage?: string };
        };
      };
      statusCode = data?.paymentMethod?.paymentTransaction?.statusCode ?? null;
      status = statusCode ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR;
      errorMessage =
        data?.paymentMethod?.paymentTransaction?.errorMessage ?? null;
    } catch (error) {
      const axiosError = error as {
        response?: { data: unknown };
        message?: string;
      };
      responseJson = axiosError.response
        ? JSON.stringify(axiosError.response.data)
        : '';
      errorMessage = axiosError.message ?? 'ICICI eNACH API call failed';
      status = ApiCallStatus.NETWORK_ERROR;
    }

    const log = this.logRepository.create({
      provider: EnachProvider.WORLDLINE,
      requestType: EnachRequestType.REGISTER,
      loanNumber: dto.loanNumber,
      transactionId,
      mandateId: dto.mandateRegistrationNo,
      request: requestJson,
      response: responseJson,
      statusCode,
      status,
      errors: errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    const savedLog = await this.logRepository.save(log);

    const loan = await this.loanRepository.findOne({
      where: { loanNumber: dto.loanNumber },
    });
    if (loan) {
      loan.enachScheduleAmount = dto.requestedAmount;
      loan.enachScheduleDate = new Date(dto.requestedEndDate);
      loan.enachScheduleIdentifier = transactionId;
      // Legacy's $apiStatusId: 1=success, 2/3/4=distinct failure causes
      // (ErrorException/RuntimeException/generic Exception) not otherwise
      // reproduced here — collapsed to 1=success, 2=failure.
      loan.enachScheduleStatus = status === ApiCallStatus.SUCCESS ? 1 : 2;
      await this.loanRepository.save(loan);
    }

    return savedLog;
  }

  private formatDdMmYyyy(iso: string): string {
    const date = new Date(iso);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}${date.getFullYear()}`;
  }
}
