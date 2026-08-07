import { ApiCallStatus, Lead, VideoKycLog } from '@finance-crm/database';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { VideoKycService } from './video-kyc.service';

describe('VideoKycService', () => {
  let service: VideoKycService;
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
        VideoKycService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'LMS_URL') return 'https://lms.example';
              if (key === 'BRAND_NAME') return fallback ?? 'Finance CRM';
              return fallback;
            },
          },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(VideoKycLog), useValue: logRepository },
      ],
    }).compile();

    service = moduleRef.get(VideoKycService);
  });

  it('posts the real Signzy consenzAI/createUrl request shape with the scripted consent statement', async () => {
    signzyPost.mockResolvedValue({
      data: {
        requestId: 'req-1',
        customerUrl: 'https://signzy.example/vkyc',
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.createSession({
      leadId: 42,
      customerFullName: 'Test Auditee',
      loanAmount: 10000,
      repaymentDate: '2026-08-15',
      repaymentAmount: 10500,
    });

    expect(signzyPost).toHaveBeenCalledTimes(1);
    const [path, body] = signzyPost.mock.calls[0];
    expect(path).toBe('v3/consenzAI/createUrl');
    expect(body).toMatchObject({
      hideBottomLogo: 'true',
      callbackUrl: 'https://lms.example',
      redirectUrl: 'https://lms.example',
      accentColor: '#1F57E7',
      timer: 30,
      script:
        'I Test Auditee, hereby confirm that I am willingly availing a loan of Rs.10000.00 from Finance CRM. I understand and agree that the loan amount will be repayable on 2026-08-15, with a total repayment amount of Rs.10500.00 as per the agreed terms and conditions.',
    });
    expect(result.requestId).toBe('req-1');
    expect(result.returnUrl).toBe('https://signzy.example/vkyc');
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
  });

  it('falls back to consumerId/videoUrl fields when requestId/customerUrl are absent', async () => {
    signzyPost.mockResolvedValue({
      data: { consumerId: 'cons-1', videoUrl: 'https://signzy.example/vkyc2' },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.createSession({
      leadId: 42,
      customerFullName: 'Test Auditee',
      loanAmount: 10000,
      repaymentDate: '2026-08-15',
      repaymentAmount: 10500,
    });

    expect(result.requestId).toBe('cons-1');
    expect(result.returnUrl).toBe('https://signzy.example/vkyc2');
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
  });

  it('marks the log as API_ERROR when no session URL is returned', async () => {
    signzyPost.mockResolvedValue({
      data: {},
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.createSession({
      leadId: 42,
      customerFullName: 'Test Auditee',
      loanAmount: 10000,
      repaymentDate: '2026-08-15',
      repaymentAmount: 10500,
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.returnUrl).toBeNull();
  });
});
