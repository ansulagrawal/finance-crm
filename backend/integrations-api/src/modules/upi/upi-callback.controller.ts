import { Public, readPemFromConfig } from '@finance-crm/common';
import {
  ApiCallStatus,
  UpiCallbackLog,
  UpiCallbackMethod,
  UpiCollectionLog,
  UpiCollectionMethod,
} from '@finance-crm/database';
import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { decryptFromIcici } from './icici-rsa.util';

interface IciciDepositCallbackPayload {
  merchantTranId?: string;
  PayerAmount?: number;
  BankRRN?: string;
}

/** `UpiCollectionLog.method` -> `UpiCallbackLog.method`, both share the QRCode/CollectPay split. */
function toCallbackMethod(
  collectionMethod: UpiCollectionMethod,
): UpiCallbackMethod {
  return collectionMethod === UpiCollectionMethod.COLLECT_PAY_REQUEST
    ? UpiCallbackMethod.COLLECT_PAY
    : UpiCallbackMethod.QRCODE;
}

/**
 * Ported from `old-php-files/application/controllers/IciciCallbackController.php`
 * (`deposit_callback()`). Legacy has NO signature header — the raw body is
 * RSA-encrypted and decrypting it with our private key IS the trust
 * boundary in this design (not upgraded to a different scheme here).
 */
@ApiTags('UPI')
@Controller('upi')
export class UpiCallbackController {
  private readonly logger = new Logger(UpiCallbackController.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(UpiCollectionLog)
    private readonly upiCollectionLogRepository: Repository<UpiCollectionLog>,
    @InjectRepository(UpiCallbackLog)
    private readonly upiCallbackLogRepository: Repository<UpiCallbackLog>,
  ) {}

  @Public()
  @Post('callback')
  @ApiOperation({
    summary:
      'ICICI EazyPay UPI deposit callback (third-party webhook). No signature header — the body is RSA-PKCS1-encrypted with our public key, and decrypting it with our private key IS the trust boundary; not cookie-authenticated.',
  })
  async handleDepositCallback(
    @Body() body: string,
  ): Promise<{ Status: number; Message: string }> {
    let status: ApiCallStatus = ApiCallStatus.PENDING;
    let errors = '';
    let payload: IciciDepositCallbackPayload = {};
    let originatingLog: UpiCollectionLog | null = null;

    try {
      // By value from config, not a path on disk — see readPemFromConfig.
      const privateKeyPem = readPemFromConfig(
        this.configService,
        'ICICI_UPI_PRIVATE_KEY',
      );
      const decrypted = decryptFromIcici(body, privateKeyPem);
      payload = JSON.parse(decrypted) as IciciDepositCallbackPayload;

      if (!payload.merchantTranId) {
        throw new BadRequestException('Empty response received');
      }

      originatingLog = await this.upiCollectionLogRepository.findOne({
        where: { transactionId: payload.merchantTranId },
        order: { id: 'DESC' },
        relations: { lead: true },
      });
      if (!originatingLog) {
        throw new BadRequestException('No matching UPI collection log found');
      }

      status = ApiCallStatus.SUCCESS;
    } catch (error) {
      status = ApiCallStatus.API_ERROR;
      errors = error instanceof Error ? error.message : 'Unknown error';
    }

    if (originatingLog) {
      // `lead`/`method` are NOT NULL with no DB default — the pre-rewrite
      // entity allowed a callback log with no associated lead at all;
      // derive both from the originating collection request instead of
      // skipping the write (which would violate the NOT NULL constraint).
      await this.upiCallbackLogRepository.save(
        this.upiCallbackLogRepository.create({
          lead: originatingLog.lead,
          method: toCallbackMethod(originatingLog.method),
          transactionId: payload.merchantTranId ?? null,
          decryptedResponse: JSON.stringify(payload),
          encryptedResponse: body,
          status,
          errors: errors || null,
          requestedAmount: payload.PayerAmount ?? null,
          respondedAt: new Date(),
        }),
      );
    }

    // The failure reason stays server-side. Echoing it back turned this
    // endpoint into a Bleichenbacher padding oracle: an unauthenticated
    // caller could submit chosen ciphertexts and read off, per attempt,
    // whether the RSA block unpadded cleanly, whether it parsed as JSON, and
    // whether it matched a known transaction — the exact per-attempt signal
    // that attack needs. One constant rejection message removes the signal;
    // `icici-rsa.util.ts` collapses its own distinct padding errors into one
    // for the same reason.
    if (status !== ApiCallStatus.SUCCESS) {
      this.logger.warn(`ICICI UPI deposit callback rejected: ${errors}`);
    }
    return {
      Status: status,
      Message:
        status === ApiCallStatus.SUCCESS
          ? 'Response saved successfully'
          : 'Callback could not be processed',
    };
  }
}
