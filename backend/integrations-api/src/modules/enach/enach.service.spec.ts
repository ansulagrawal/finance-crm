import {
  ApiCallStatus,
  EnachLog,
  EnachProvider,
  EnachRequestType,
  Loan,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { EnachService } from './enach.service';

describe('EnachService', () => {
  let service: EnachService;
  let httpServicePost: jest.Mock;
  let logRepository: { create: jest.Mock; save: jest.Mock };
  let loanRepository: { findOne: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    httpServicePost = jest.fn();
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    loanRepository = {
      findOne: jest.fn(() => Promise.resolve(null)),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EnachService,
        { provide: HttpService, useValue: { post: httpServicePost } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'ENACH_ICICI_MERCHANTID') return 'test-merchant';
              if (key === 'ENACH_ICICI_SCHEDULING_URL')
                return 'https://icici.example/enach/schedule';
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        { provide: getRepositoryToken(EnachLog), useValue: logRepository },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
      ],
    }).compile();

    service = moduleRef.get(EnachService);
  });

  it('calls the real ICICI scheduling endpoint with the real request shape', async () => {
    httpServicePost.mockReturnValue(
      of({
        data: {
          paymentMethod: {
            paymentTransaction: { statusCode: '00', errorMessage: null },
          },
        },
      }),
    );

    const result = await service.initiateTransaction({
      loanNumber: 'LN-001',
      mandateRegistrationNo: 'MANDATE-1',
      requestedAmount: 5000,
      requestedEndDate: '2026-08-15',
    });

    expect(httpServicePost).toHaveBeenCalledWith(
      'https://icici.example/enach/schedule',
      expect.objectContaining({
        merchant: { identifier: 'test-merchant' },
        payment: expect.objectContaining({
          instruction: expect.objectContaining({
            amount: 5000,
            endDateTime: '15082026',
            identifier: 'MANDATE-1',
          }),
        }),
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.statusCode).toBe('00');
    // Legacy always writes provider=1 (WORLDLINE, per the column's own DB
    // comment), and requestType stays REGISTER since this is the only
    // table this operation has to log to today.
    expect(result.provider).toBe(EnachProvider.WORLDLINE);
    expect(result.requestType).toBe(EnachRequestType.REGISTER);
    expect(result.loanNumber).toBe('LN-001');
    expect(result.mandateId).toBe('MANDATE-1');
  });

  it('writes the schedule onto the matching loan record when one exists', async () => {
    httpServicePost.mockReturnValue(
      of({
        data: {
          paymentMethod: {
            paymentTransaction: { statusCode: '00', errorMessage: null },
          },
        },
      }),
    );
    const loan = { loanNumber: 'LN-001' };
    loanRepository.findOne.mockResolvedValue(loan);

    await service.initiateTransaction({
      loanNumber: 'LN-001',
      mandateRegistrationNo: 'MANDATE-1',
      requestedAmount: 5000,
      requestedEndDate: '2026-08-15',
    });

    expect(loanRepository.findOne).toHaveBeenCalledWith({
      where: { loanNumber: 'LN-001' },
    });
    expect(loanRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        enachScheduleAmount: 5000,
        enachScheduleDate: new Date('2026-08-15'),
        enachScheduleStatus: 1,
      }),
    );
  });

  it('does not fail when no matching loan exists yet', async () => {
    httpServicePost.mockReturnValue(
      of({
        data: {
          paymentMethod: {
            paymentTransaction: { statusCode: '00', errorMessage: null },
          },
        },
      }),
    );

    await expect(
      service.initiateTransaction({
        loanNumber: 'LN-404',
        mandateRegistrationNo: 'MANDATE-1',
        requestedAmount: 5000,
        requestedEndDate: '2026-08-15',
      }),
    ).resolves.toBeDefined();
    expect(loanRepository.save).not.toHaveBeenCalled();
  });

  it('marks the log as API_ERROR when ICICI returns no statusCode', async () => {
    httpServicePost.mockReturnValue(
      of({ data: { paymentMethod: { paymentTransaction: {} } } }),
    );

    const result = await service.initiateTransaction({
      loanNumber: 'LN-002',
      mandateRegistrationNo: 'MANDATE-2',
      requestedAmount: 1000,
      requestedEndDate: '2026-08-15',
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
  });

  it('marks the log as NETWORK_ERROR when the HTTP call itself fails', async () => {
    httpServicePost.mockReturnValue(
      throwError(() => new Error('connect ETIMEDOUT')),
    );

    const result = await service.initiateTransaction({
      loanNumber: 'LN-003',
      mandateRegistrationNo: 'MANDATE-3',
      requestedAmount: 1000,
      requestedEndDate: '2026-08-15',
    });

    expect(result.status).toBe(ApiCallStatus.NETWORK_ERROR);
    expect(result.errors).toContain('connect ETIMEDOUT');
  });
});
