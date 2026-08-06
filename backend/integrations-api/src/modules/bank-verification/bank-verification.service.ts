import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  BankVerificationLog,
  BankVerificationMethod,
  BankVerificationProvider,
  Lead,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { VerifyBankAccountDto } from './dto/verify-bank-account.dto';

/** Signzy penny-drop bank account verification — ports
 * `payday_bank_verification_api_helper.php`, `POST
 * v3/bankaccountverification/bankaccountverifications`. */
@Injectable()
export class BankVerificationService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(BankVerificationLog)
    private readonly logRepository: Repository<BankVerificationLog>,
    private readonly signzy: SignzyClientService,
  ) {}

  async verify(dto: VerifyBankAccountDto): Promise<BankVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const body = {
      beneficiaryAccount: dto.beneficiaryAccount,
      beneficiaryName: dto.beneficiaryName,
      beneficiaryIFSC: dto.beneficiaryIfsc,
      nameFuzzy: 'true',
      beneficiaryMobile: dto.beneficiaryMobile ?? '',
      email: dto.beneficiaryEmail ?? '',
    };

    const result = await this.signzy.post(
      'v3/bankaccountverification/bankaccountverifications',
      body,
    );
    const response = result.data as {
      result?: {
        active?: string;
        bankTransfer?: { response?: string };
        nameMatch?: string;
        nameMatchScore?: string;
      };
    };
    const isSuccess =
      response?.result?.active === 'yes' &&
      response?.result?.bankTransfer?.response === 'Transaction Successful';

    const log = this.logRepository.create({
      lead,
      provider: BankVerificationProvider.SIGNZY,
      method: BankVerificationMethod.PENNY_DROP,
      request: result.requestJson,
      response: result.responseJson,
      status: isSuccess ? ApiCallStatus.SUCCESS : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
