import { ApiCallStatus, EmailValidationLog, Lead } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailValidationService } from './email-validation.service';
import { EMAIL_VALIDATOR } from './email-validation.tokens';

describe('EmailValidationService', () => {
  let service: EmailValidationService;
  let validate: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    validate = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailValidationService,
        { provide: EMAIL_VALIDATOR, useValue: { validate } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(EmailValidationLog),
          useValue: logRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(EmailValidationService);
  });

  it('validates via the injected validator and logs a SUCCESS result', async () => {
    validate.mockResolvedValue({
      isValid: true,
      verdict: 'Valid',
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.validate({
      leadId: 42,
      email: 'customer@example.com',
      emailType: 1,
    });

    expect(validate).toHaveBeenCalledWith('customer@example.com');
    expect(result.isValid).toBe(true);
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
  });

  it('marks the log as API_ERROR when the validator returns an error', async () => {
    validate.mockResolvedValue({
      isValid: false,
      verdict: null,
      requestJson: '{}',
      responseJson: '',
      errorMessage: 'SendGrid email validation failed',
    });

    const result = await service.validate({
      leadId: 42,
      email: 'customer@example.com',
      emailType: 2,
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
  });
});
