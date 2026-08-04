import {
  ApiCallStatus,
  DomainVerificationLog,
  EmailVerificationLog,
  EmailVerificationMethod,
  EmailVerificationResult,
  Lead,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { DomainEmailVerificationService } from './domain-email-verification.service';

describe('DomainEmailVerificationService', () => {
  let service: DomainEmailVerificationService;
  let signzyPost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let domainLogRepository: { create: jest.Mock; save: jest.Mock };
  let emailLogRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    signzyPost = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    domainLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    emailLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DomainEmailVerificationService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(DomainVerificationLog),
          useValue: domainLogRepository,
        },
        {
          provide: getRepositoryToken(EmailVerificationLog),
          useValue: emailLogRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(DomainEmailVerificationService);
  });

  describe('verifyDomain', () => {
    it('extracts the domain from the email and posts the real Signzy request shape', async () => {
      signzyPost.mockResolvedValue({
        data: {
          result: { domainName: 'example.com', creationDate: '2010-01-01' },
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyDomain({
        leadId: 42,
        email: 'auditee@example.com',
      });

      expect(signzyPost).toHaveBeenCalledWith('v3/domainVerificationLite', {
        domainName: 'example.com',
      });
      expect(result.domain).toBe('example.com');
      expect(result.registrationDate).toBe('2010-01-01');
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('marks the log as API_ERROR when no creationDate is returned', async () => {
      signzyPost.mockResolvedValue({
        data: { result: {} },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyDomain({
        leadId: 42,
        email: 'auditee@example.com',
      });

      expect(result.status).toBe(ApiCallStatus.API_ERROR);
      expect(result.registrationDate).toBeNull();
    });
  });

  describe('verifyEmail', () => {
    it('sends the real { email } body (not the legacy empty-body bug) and marks SUCCESS on validEmail=true', async () => {
      signzyPost.mockResolvedValue({
        data: { result: { validEmail: 'true', subStatus: 'valid' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyEmail({
        leadId: 42,
        email: 'auditee@example.com',
      });

      expect(signzyPost).toHaveBeenCalledWith('v3/email/verificationV2', {
        email: 'auditee@example.com',
      });
      expect(result.method).toBe(EmailVerificationMethod.PERSONAL);
      expect(result.validationResult).toBe(EmailVerificationResult.VALID);
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('uses method OFFICE when isPersonalEmail is explicitly false', async () => {
      signzyPost.mockResolvedValue({
        data: { result: { validEmail: 'false', subStatus: 'role_based' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyEmail({
        leadId: 42,
        email: 'office@example.com',
        isPersonalEmail: false,
      });

      expect(result.method).toBe(EmailVerificationMethod.OFFICE);
      // role_based sub-status is treated as valid, matching the real service logic
      expect(result.validationResult).toBe(EmailVerificationResult.VALID);
    });

    it('marks the log as API_ERROR when Signzy returns no result object at all', async () => {
      signzyPost.mockResolvedValue({
        data: {},
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyEmail({
        leadId: 42,
        email: 'auditee@example.com',
      });

      expect(result.status).toBe(ApiCallStatus.API_ERROR);
      expect(result.validationResult).toBe(EmailVerificationResult.INVALID);
    });
  });
});
