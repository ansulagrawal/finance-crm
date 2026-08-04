import {
  ApiCallStatus,
  CallManagementLog,
  Lead,
  LeadFollowup,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RunoClientService } from '../runo/runo-client.service';
import { CallManagementService } from './call-management.service';

describe('CallManagementService', () => {
  let service: CallManagementService;
  let runoPost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock; findOne: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };
  let leadFollowupRepository: { create: jest.Mock; save: jest.Mock };

  const lead = {
    id: 42,
    firstName: 'Jane',
    mobile: '9998887777',
    email: 'jane@example.com',
    pancard: 'ABCDE1234F',
    pincode: '400001',
    source: 'WEBSITE',
    state: { name: 'Maharashtra' },
    city: { name: 'Mumbai' },
    screenerAssignedTo: { id: 7, mobile: '9000000000' },
    leadStatus: { id: 3 },
  } as unknown as Lead;

  beforeEach(async () => {
    runoPost = jest.fn();
    leadRepository = {
      findOneBy: jest.fn().mockResolvedValue(lead),
      findOne: jest.fn().mockResolvedValue(lead),
    };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    leadFollowupRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CallManagementService,
        { provide: RunoClientService, useValue: { post: runoPost } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(CallManagementLog),
          useValue: logRepository,
        },
        {
          provide: getRepositoryToken(LeadFollowup),
          useValue: leadFollowupRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(CallManagementService);
  });

  it('posts the real RUNO sanction-allocation request shape and assigns to the agent', async () => {
    runoPost.mockResolvedValue({
      data: { statusCode: 0 },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.allocateSanctionCall(42);

    expect(runoPost).toHaveBeenCalledWith(
      'https://api.runo.in/v1/crm/allocation',
      expect.objectContaining({
        priority: 3,
        notes: 'Self Allocated',
        processName: 'Sanction Team',
        assignedTo: '+919000000000',
        customer: expect.objectContaining({
          name: 'Jane',
          phoneNumber: '+919998887777',
        }),
      }),
    );
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(leadFollowupRepository.save).toHaveBeenCalled();
  });

  it('appends isCommonPool=true when no agent is assigned', async () => {
    leadRepository.findOne.mockResolvedValue({
      ...lead,
      screenerAssignedTo: null,
    });
    runoPost.mockResolvedValue({
      data: { statusCode: 0 },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    await service.allocateSanctionCall(42);

    const [url, body] = runoPost.mock.calls[0];
    expect(url).toBe('https://api.runo.in/v1/crm/allocation?isCommonPool=true');
    expect(body.assignedTo).toBeUndefined();
  });

  it('marks the log as API_ERROR when statusCode is not 0', async () => {
    runoPost.mockResolvedValue({
      data: { statusCode: 1, message: 'Invalid request' },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.allocateSanctionCall(42);

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(leadFollowupRepository.save).not.toHaveBeenCalled();
  });
});
