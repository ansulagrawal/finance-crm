import { findOrFail } from '@finance-crm/common';
import { ApiCallStatus, EmailValidationLog, Lead } from '@finance-crm/database';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { ValidateEmailDto } from './dto/validate-email.dto';
import { EMAIL_VALIDATOR } from './email-validation.tokens';
import type { EmailValidator } from './validators/email-validator.interface';

/**
 * Pluggable email-validation API — ports `sendgrid_email_validation_api`
 * (`payday_email_verification_api_helper.php`), distinct from the existing
 * Signzy-based `domain-email-verification` module. Only SendGrid is
 * implemented for now (`EMAIL_VALIDATOR` token), matching legacy's own
 * dispatch (`EMAIL_VALIDATION` always resolves to `SENDGRID_EMAIL_VALIDATE`
 * — sibling functions for other vendors exist in legacy but are never
 * dispatched to). This entry point was never actually invoked by any live
 * legacy controller (dead but requested as new forward-looking scope, not
 * a port of live behavior) — built as a general-purpose endpoint taking
 * the email directly rather than resolving it from `LeadCustomer`, to
 * avoid registering that entity's full unrelated relation graph
 * (state/city/maritalStatus/etc.) for one field.
 */
@Injectable()
export class EmailValidationService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(EmailValidationLog)
    private readonly logRepository: Repository<EmailValidationLog>,
    @Inject(EMAIL_VALIDATOR)
    private readonly validator: EmailValidator,
  ) {}

  async validate(dto: ValidateEmailDto): Promise<EmailValidationLog> {
    const lead = await findOrFail(this.leadRepository, dto.leadId, 'Lead');

    const result = await this.validator.validate(dto.email);

    const log = this.logRepository.create({
      lead,
      emailType: dto.emailType,
      email: dto.email,
      provider: 'sendgrid',
      isValid: result.isValid,
      verdict: result.verdict,
      request: result.requestJson,
      response: result.responseJson,
      status: result.errorMessage
        ? ApiCallStatus.API_ERROR
        : ApiCallStatus.SUCCESS,
      errors: result.errorMessage,
      requestedAt: new Date(),
      respondedAt: new Date(),
    });
    return this.logRepository.save(log);
  }
}
