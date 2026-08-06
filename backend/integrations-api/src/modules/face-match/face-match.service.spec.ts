import { ApiCallStatus, FaceMatchLog, Lead } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { FaceMatchService } from './face-match.service';

describe('FaceMatchService', () => {
  let service: FaceMatchService;
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
        FaceMatchService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(FaceMatchLog), useValue: logRepository },
      ],
    }).compile();

    service = moduleRef.get(FaceMatchService);
  });

  it('posts the real Signzy v3/face/match request shape', async () => {
    signzyPost.mockResolvedValue({
      data: { result: { matchPercentage: 92.5 } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      firstImageUrl: 'https://example.com/selfie.jpg',
      secondImageUrl: 'https://example.com/aadhaar.jpg',
    });

    expect(signzyPost).toHaveBeenCalledWith('v3/face/match', {
      firstImage: 'https://example.com/selfie.jpg',
      secondImage: 'https://example.com/aadhaar.jpg',
    });
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.matchPercentage).toBe('92.5');
  });

  it('marks the log as API_ERROR and captures the message when matchPercentage is missing', async () => {
    signzyPost.mockResolvedValue({
      data: { result: { message: 'Face not detected' } },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.verify({
      leadId: 42,
      firstImageUrl: 'https://example.com/selfie.jpg',
      secondImageUrl: 'https://example.com/aadhaar.jpg',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.matchPercentage).toBeNull();
    expect(result.errors).toBe('Face not detected');
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
      firstImageUrl: 'https://example.com/selfie.jpg',
      secondImageUrl: 'https://example.com/aadhaar.jpg',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.errors).toBe('connect ECONNREFUSED');
  });
});
