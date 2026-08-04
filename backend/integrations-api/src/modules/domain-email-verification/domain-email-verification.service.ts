import { findOrFail } from '@finance-crm/common';
import {
  ApiCallStatus,
  DomainVerificationLog,
  EmailVerificationLog,
  EmailVerificationMethod,
  EmailVerificationProvider,
  EmailVerificationResult,
  Lead,
} from '@finance-crm/database';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { VerifyDomainDto } from './dto/verify-domain.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const DOMAIN_VERIFICATION_PROVIDER = 1;
const GET_DOMAIN_DETAILS_METHOD = 1;

/**
 * Signzy domain/email verification — ports `payday_domain_verification_api.php`
 * (`POST v3/domainVerificationLite`) and `payday_email_verification_api.php`
 * (`POST v3/email/verificationV2`).
 *
 * The legacy email-verification code builds its request body but never
 * actually assigns the email address into it (`$apiRequestJson` stays an
 * empty string before being sent) — this looks like a genuine bug in the
 * legacy source, not an intentional empty-body contract. This adapter sends
 * `{ email }` in the body, matching Signzy's documented contract for this
 * endpoint, rather than reproducing the apparent bug.
 */
@Injectable()
export class DomainEmailVerificationService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(DomainVerificationLog)
    private readonly domainLogRepository: Repository<DomainVerificationLog>,
    @InjectRepository(EmailVerificationLog)
    private readonly emailLogRepository: Repository<EmailVerificationLog>,
    private readonly signzy: SignzyClientService,
  ) {}

  async verifyDomain(dto: VerifyDomainDto): Promise<DomainVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const domain = dto.email.split('@')[1] ?? '';

    const result = await this.signzy.post('v3/domainVerificationLite', {
      domainName: domain,
    });
    const response = result.data as {
      result?: { domainName?: string; creationDate?: string };
    };

    const log = this.domainLogRepository.create({
      lead,
      provider: DOMAIN_VERIFICATION_PROVIDER,
      method: GET_DOMAIN_DETAILS_METHOD,
      email: dto.email,
      domain,
      registrationDate: response?.result?.creationDate ?? null,
      request: result.requestJson,
      response: result.responseJson,
      status: response?.result?.creationDate
        ? ApiCallStatus.SUCCESS
        : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.domainLogRepository.save(log);
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<EmailVerificationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');
    const method =
      dto.isPersonalEmail === false
        ? EmailVerificationMethod.OFFICE
        : EmailVerificationMethod.PERSONAL;

    const result = await this.signzy.post('v3/email/verificationV2', {
      email: dto.email,
    });
    const response = result.data as {
      result?: { validEmail?: string; subStatus?: string };
    };
    const isValid =
      response?.result?.validEmail === 'true' ||
      response?.result?.subStatus === 'role_based';

    const log = this.emailLogRepository.create({
      lead,
      provider: EmailVerificationProvider.SIGNZY,
      method,
      email: dto.email,
      request: result.requestJson,
      response: result.responseJson,
      validationResult: isValid
        ? EmailVerificationResult.VALID
        : EmailVerificationResult.INVALID,
      status: response?.result
        ? ApiCallStatus.SUCCESS
        : ApiCallStatus.API_ERROR,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.emailLogRepository.save(log);
  }
}
