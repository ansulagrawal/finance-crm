import { ApiCallStatus, BankVerificationLog, Lead } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { BankVerificationService } from './bank-verification.service';

describe('BankVerificationService', () => {
  let service: BankVerificationService;
  let signzyPost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    signzyPost = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BankVerificationService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(BankVerificationLog),
          useValue: logRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(BankVerificationService);
  });

  it('posts the real Signzy penny-drop request shape', async () => {
    signzyPost.mockResolvedValue({
      data: {
        result: {
          active: 'yes',
          bankTransfer: { response: 'Transaction Successful' },
          nameMatch: 'true',
          nameMatchScore: '0.95',
        },
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      beneficiaryAccount: '123456789',
      beneficiaryName: 'Test Auditee',
      beneficiaryIfsc: 'ICIC0001234',
      beneficiaryMobile: '9999999999',
      beneficiaryEmail: 'auditee@example.com',
    });

    expect(signzyPost).toHaveBeenCalledWith(
      'v3/bankaccountverification/bankaccountverifications',
      {
        beneficiaryAccount: '123456789',
        beneficiaryName: 'Test Auditee',
        beneficiaryIFSC: 'ICIC0001234',
        nameFuzzy: 'true',
        beneficiaryMobile: '9999999999',
        email: 'auditee@example.com',
      },
    );
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
  });

  it('defaults optional mobile/email to empty strings when not supplied', async () => {
    signzyPost.mockResolvedValue({
      data: {
        result: {
          active: 'yes',
          bankTransfer: { response: 'Transaction Successful' },
        },
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    await service.verify({
      leadId: 42,
      beneficiaryAccount: '123456789',
      beneficiaryName: 'Test Auditee',
      beneficiaryIfsc: 'ICIC0001234',
    });

    const [, body] = signzyPost.mock.calls[0];
    expect(body.beneficiaryMobile).toBe('');
    expect(body.email).toBe('');
  });

  it('marks the log as API_ERROR when the account is inactive or the transfer failed', async () => {
    signzyPost.mockResolvedValue({
      data: {
        result: {
          active: 'no',
          bankTransfer: { response: 'Transaction Failed' },
        },
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      beneficiaryAccount: '123456789',
      beneficiaryName: 'Test Auditee',
      beneficiaryIfsc: 'ICIC0001234',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
  });

  it('marks the log as API_ERROR (via SignzyClientService) when the underlying call fails', async () => {
    signzyPost.mockResolvedValue({
      data: null,
      requestJson: '{}',
      responseJson: '',
      errorMessage: 'connect ECONNREFUSED',
    });

    const result = await service.verify({
      leadId: 42,
      beneficiaryAccount: '123456789',
      beneficiaryName: 'Test Auditee',
      beneficiaryIfsc: 'ICIC0001234',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.errors).toBe('connect ECONNREFUSED');
  });
});
