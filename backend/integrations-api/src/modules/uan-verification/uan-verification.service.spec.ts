import { ApiCallStatus, Lead, UanVerificationLog } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { UanVerificationService } from './uan-verification.service';

describe('UanVerificationService', () => {
  let service: UanVerificationService;
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
        UanVerificationService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(UanVerificationLog),
          useValue: logRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(UanVerificationService);
  });

  it('posts the real Signzy advance-employment-verification request shape', async () => {
    signzyPost.mockResolvedValue({
      data: {
        result: {
          uan: ['123456789012'],
          summary: { recentEmployerData: { establishmentName: 'Acme Corp' } },
        },
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      mobileNumber: '9999999999',
      panNumber: 'ABCDE1234F',
    });

    expect(signzyPost).toHaveBeenCalledWith(
      'v3/api/advance-employment-verification',
      {
        mobileNumber: '9999999999',
        panNumber: 'ABCDE1234F',
        uanNumber: '',
        dateOfBirth: '',
        employeeName: '',
        employerName: '',
        nameMatchMethod: '',
        ttl: 0,
        cutOffTime: '15',
        employmentLookupPeriod: '90',
      },
    );
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.uanFound).toBe(true);
    expect(result.uanNumbers).toBe('123456789012');
    expect(result.employerName).toBe('Acme Corp');
    expect(result.pancard).toBe('ABCDE1234F');
  });

  it('marks uanFound false and joins multiple UAN numbers with commas', async () => {
    signzyPost.mockResolvedValue({
      data: { result: { uan: ['111', '222'] } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      mobileNumber: '9999999999',
      panNumber: 'ABCDE1234F',
    });

    expect(result.uanNumbers).toBe('111,222');
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
  });

  it('marks the log as API_ERROR when Signzy returns no result object at all', async () => {
    signzyPost.mockResolvedValue({
      data: {},
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      mobileNumber: '9999999999',
      panNumber: 'ABCDE1234F',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.uanFound).toBe(false);
    expect(result.uanNumbers).toBeNull();
  });

  it('surfaces the SignzyClientService error message when the underlying call fails', async () => {
    signzyPost.mockResolvedValue({
      data: null,
      requestJson: '{}',
      responseJson: '',
      errorMessage: 'connect ECONNREFUSED',
    });

    const result = await service.verify({
      leadId: 42,
      mobileNumber: '9999999999',
      panNumber: 'ABCDE1234F',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.errors).toBe('connect ECONNREFUSED');
  });
});
