import { findOrFail, readPemFromConfig } from '@finance-crm/common';
import {
  ApiCallStatus,
  Lead,
  Loan,
  UpiCollectionLog,
  UpiCollectionMethod,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import type { Repository } from 'typeorm';
import { CreateQrRequestDto } from './dto/create-qr-request.dto';
import { decryptFromIcici, encryptForIcici } from './icici-rsa.util';

/**
 * `Loan.status` is legacy's free-string lifecycle label (same value space
 * `disbursal.service.ts`'s `LOAN_STATUS` uses), not an enum — the
 * pre-rewrite entity assumed a simplified enum that doesn't exist in the
 * real schema.
 */
const LOAN_STATUS_DISBURSED = 'DISBURSED';

/** 1=>ICICI — legacy `au_provider` comment; only provider implemented so far. */
const UPI_PROVIDER_ICICI = 1;

/**
 * ICICI Bank EazyPay UPI QR/collect-pay API, ported from
 * `old-php-files/components/includes/integration/call_upi_api.php` +
 * `integration_config.php`'s `UPI_API` case
 * (`apibankingone.icici.bank.in/api/MerchantAPI/UPI/v0/QR3/{merchantId}`).
 * Both the request and the response body are RSA-PKCS1-encrypted (request
 * with ICICI's public key, response readable only with our private key) —
 * this is NOT a generic UPI gateway.
 */
@Injectable()
export class UpiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(UpiCollectionLog)
    private readonly upiCollectionLogRepository: Repository<UpiCollectionLog>,
  ) {}

  async createQrRequest(dto: CreateQrRequestDto): Promise<UpiCollectionLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const loan = await this.loanRepository.findOne({
      where: { lead: { id: dto.leadId } },
    });
    if (!loan || loan.status !== LOAN_STATUS_DISBURSED) {
      // Approximates legacy's `lead_status_id IN (14, 19)` (DISBURSED / PART-PAYMENT)
      // eligibility check — only a disbursed loan can request a collection QR.
      throw new BadRequestException(
        'Loan is not eligible for a collection request',
      );
    }

    const merchantId = this.configService.getOrThrow<string>(
      'ICICI_UPI_MERCHANT_ID',
    );
    const terminalId = this.configService.getOrThrow<string>(
      'ICICI_UPI_TERMINAL_ID',
    );
    const apiKey = this.configService.getOrThrow<string>('ICICI_UPI_API_KEY');
    const apiUrl = this.configService.getOrThrow<string>(
      'ICICI_UPI_QR_API_URL',
    );

    const transactionId = `${loan.loanNumber}-${lead.id}-${Date.now()}`;
    const requestParams = {
      amount: dto.amount,
      merchantId,
      terminalId,
      merchantTranId: transactionId,
      billNumber: `${lead.id}-${Date.now()}`,
    };

    const requestedAt = new Date();
    // `provider`/`status` are NOT NULL with no DB default (unlike the
    // pre-rewrite entity, which allowed both to be omitted/used a
    // differently-named `statusId` property).
    const log = this.upiCollectionLogRepository.create({
      lead,
      provider: UPI_PROVIDER_ICICI,
      method: UpiCollectionMethod.QRCODE_REQUEST,
      transactionId,
      request: JSON.stringify(requestParams),
      requestedAmount: String(dto.amount),
      requestedAt,
      status: ApiCallStatus.PENDING,
    });

    try {
      // Key material is read BY VALUE from config (Secrets Manager or .env),
      // never from a path on disk — see readPemFromConfig. Read inside the try
      // so a missing/malformed key is recorded as an API_ERROR log row, which
      // is how every vendor failure in this service is surfaced; it must not
      // become a thrown 500.
      const publicKeyPem = readPemFromConfig(
        this.configService,
        'ICICI_UPI_PUBLIC_KEY',
      );
      const encryptedRequest = encryptForIcici(
        JSON.stringify(requestParams),
        publicKeyPem,
      );

      const response = await firstValueFrom(
        this.httpService.post<string>(apiUrl, encryptedRequest, {
          headers: {
            accept: '*/*',
            'accept-encoding': '*',
            'accept-language': 'en-US,en;q=0.8,hi;q=0.6',
            'cache-control': 'no-cache',
            'content-type': 'text/plain',
            apikey: apiKey,
          },
        }),
      );

      const privateKeyPem = readPemFromConfig(
        this.configService,
        'ICICI_UPI_PRIVATE_KEY',
      );
      const decryptedResponse = decryptFromIcici(response.data, privateKeyPem);
      log.response = decryptedResponse;
      log.status = ApiCallStatus.SUCCESS;
    } catch (error) {
      log.status = ApiCallStatus.API_ERROR;
      log.errors = error instanceof Error ? error.message : 'Unknown error';
    }
    log.respondedAt = new Date();

    return this.upiCollectionLogRepository.save(log);
  }
}
