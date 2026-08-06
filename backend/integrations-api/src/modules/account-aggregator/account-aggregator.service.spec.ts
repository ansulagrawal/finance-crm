import {
  AccountAggregatorLog,
  AccountAggregatorMethod,
  AccountAggregatorProvider,
  ApiCallStatus,
  Lead,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { AccountAggregatorService } from './account-aggregator.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue({ id: 1 }),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('AccountAggregatorService', () => {
  let service: AccountAggregatorService;
  let leadRepository: ReturnType<typeof repo>;
  let logRepository: ReturnType<typeof repo>;
  let httpService: { post: jest.Mock };

  beforeEach(async () => {
    leadRepository = repo({
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 1, mobile: '9000000001', firstName: 'Raj' }),
    });
    logRepository = repo();
    httpService = { post: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountAggregatorService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(AccountAggregatorLog),
          useValue: logRepository,
        },
        { provide: HttpService, useValue: httpService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('http://vendor/'),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AccountAggregatorService);
  });

  describe('requestConsent (LEGACY)', () => {
    it('logs a SUCCESS status and stores the returned consentHandle', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            result: {
              url: 'https://reactjssdk.finvu.in/?ecreq=x',
              consentHandle: 'ch-1',
            },
          },
        }),
      );

      const log = await service.requestConsent({
        leadId: 1,
        mobileNumber: '9000000001',
      });

      expect(log.consentHandleId).toBe('ch-1');
      expect(log.status).toBe(ApiCallStatus.SUCCESS);
      expect(log.provider).toBe(AccountAggregatorProvider.LEGACY);
      expect(log.method).toBe(AccountAggregatorMethod.CONSENT_REQUEST);
    });

    it('logs NETWORK_ERROR when the vendor call fails', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('timeout')));

      const log = await service.requestConsent({
        leadId: 1,
        mobileNumber: '9000000001',
      });

      expect(log.status).toBe(ApiCallStatus.NETWORK_ERROR);
      expect(log.consentHandleId).toBeNull();
    });
  });

  describe('getConsentStatus (LEGACY)', () => {
    it('throws when no prior consent request exists for the lead', async () => {
      logRepository.findOne.mockResolvedValue(null);
      await expect(service.getConsentStatus(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("chains off the latest consent request's consentHandleId", async () => {
      logRepository.findOne.mockResolvedValue({ consentHandleId: 'ch-1' });
      httpService.post.mockReturnValue(
        of({
          data: { result: { consentId: 'c-1', consentStatus: 'ACCEPTED' } },
        }),
      );

      const log = await service.getConsentStatus(1);

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('generateNetBankingRequest'),
        { mobileNumber: '9000000001', consentHandleId: 'ch-1' },
        expect.anything(),
      );
      expect(log.consentId).toBe('c-1');
    });
  });

  describe('requestFi (LEGACY)', () => {
    it('throws when consent was never accepted', async () => {
      logRepository.findOne.mockResolvedValue(null);
      await expect(
        service.requestFi(1, { fromDate: '2026-01-01', toDate: '2026-06-30' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('fetchFiData (LEGACY)', () => {
    it('parses fiObjects.Transactions.Transaction into a year/month summary', async () => {
      logRepository.findOne.mockResolvedValue({
        sessionId: 's-1',
        consentHandleId: 'ch-1',
        consentId: 'c-1',
      });
      httpService.post.mockReturnValue(
        of({
          data: {
            result: {
              body: [
                {
                  fiObjects: [
                    {
                      Transactions: {
                        Transaction: [
                          {
                            transactionTimestamp: '2026-01-05T00:00:00Z',
                            amount: 1000,
                            type: 'CREDIT',
                            currentBalance: 5000,
                          },
                          {
                            transactionTimestamp: '2026-01-10T00:00:00Z',
                            amount: 400,
                            type: 'DEBIT',
                            currentBalance: 4600,
                          },
                          {
                            transactionTimestamp: '2026-02-01T00:00:00Z',
                            amount: 200,
                            type: 'CREDIT',
                            currentBalance: 4800,
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        }),
      );

      const { monthlySummary } = await service.fetchFiData(1);

      expect(monthlySummary).toEqual([
        {
          yearMonth: '2026-01',
          credits: 1000,
          debits: 400,
          netChange: 600,
          closingBalance: 4600,
          transactionCount: 2,
        },
        {
          yearMonth: '2026-02',
          credits: 200,
          debits: 0,
          netChange: 200,
          closingBalance: 4800,
          transactionCount: 1,
        },
      ]);
    });
  });

  describe('createConsentRequestNp (NOVEL_PATTERN)', () => {
    it('logs a SUCCESS status and returns the tempUrl', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            requestId: 'KIS000000010994',
            tempUrl: 'https://consent.financecrm.com/api/open?r=x',
          },
        }),
      );

      const { log, tempUrl } = await service.createConsentRequestNp(1);

      expect(log.provider).toBe(AccountAggregatorProvider.NOVEL_PATTERN);
      expect(log.method).toBe(AccountAggregatorMethod.CONSENT_REQUEST);
      expect(log.consentHandleId).toBe('KIS000000010994');
      expect(log.status).toBe(ApiCallStatus.SUCCESS);
      expect(tempUrl).toBe('https://consent.financecrm.com/api/open?r=x');
    });

    it('logs API_ERROR when the vendor returns no tempUrl', async () => {
      httpService.post.mockReturnValue(of({ data: {} }));

      const { log, tempUrl } = await service.createConsentRequestNp(1);

      expect(log.status).toBe(ApiCallStatus.API_ERROR);
      expect(tempUrl).toBeNull();
    });
  });

  describe('downloadNpReport (NOVEL_PATTERN)', () => {
    it('stores the raw downloaded report as a longtext responsePayload', async () => {
      httpService.post.mockReturnValue(
        of({
          data: {
            docId: 'DOC1',
            status: 'Processed',
            data: [{ ifscCode: null }],
          },
        }),
      );

      const log = await service.downloadNpReport(
        { id: 1 } as never,
        'DOC33447669',
        'report.json',
      );

      expect(log.provider).toBe(AccountAggregatorProvider.NOVEL_PATTERN);
      expect(log.method).toBe(AccountAggregatorMethod.FI_FETCH_DATA);
      expect(log.docId).toBe('DOC33447669');
      expect(log.status).toBe(ApiCallStatus.SUCCESS);
      expect(typeof log.responsePayload).toBe('string');
    });
  });
});
