import { STORAGE_ADAPTER } from '@finance-crm/common';
import { ApiCallStatus, BankAnalysisLog, Document, Lead } from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { BankAnalysisService } from './bank-analysis.service';

describe('BankAnalysisService', () => {
  let service: BankAnalysisService;
  let httpServicePost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let documentRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let logRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let storageAdapter: { download: jest.Mock };

  const lead = { id: 42 } as Lead;
  const bankStatementDoc = {
    id: 7,
    filePath: 'documents/statement.pdf',
    documentType: { name: 'BANK STATEMENT' },
    novelReturnDocId: null as string | null,
  } as Document;

  beforeEach(async () => {
    httpServicePost = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    documentRepository = {
      findOne: jest.fn().mockResolvedValue({ ...bankStatementDoc }),
      save: jest.fn(async (x: unknown) => x),
    };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      findOne: jest.fn().mockResolvedValue(null),
    };
    storageAdapter = {
      download: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BankAnalysisService,
        { provide: HttpService, useValue: { post: httpServicePost } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                BANK_ANALYSIS_UPLOAD_URL: 'https://cartbi.com/api/upload',
                BANK_ANALYSIS_DOWNLOAD_URL:
                  'https://cartbi.com/api/downloadFile',
                BANK_ANALYSIS_API_TOKEN: 'test-token',
              };
              if (key in map) return map[key];
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(Document),
          useValue: documentRepository,
        },
        {
          provide: getRepositoryToken(BankAnalysisLog),
          useValue: logRepository,
        },
        { provide: STORAGE_ADAPTER, useValue: storageAdapter },
      ],
    }).compile();

    service = moduleRef.get(BankAnalysisService);
  });

  it('rejects when the document is not a BANK STATEMENT type', async () => {
    documentRepository.findOne.mockResolvedValue({
      ...bankStatementDoc,
      documentType: { name: 'AADHAAR CARD' },
    });

    await expect(service.upload({ leadId: 42, documentId: 7 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('uploads to CartBI and stores the returned docId on the document', async () => {
    httpServicePost.mockReturnValue(
      of({ data: { status: 'submitted', docId: 'CART-1' } }),
    );

    const result = await service.upload({ leadId: 42, documentId: 7 });

    expect(storageAdapter.download).toHaveBeenCalledWith(
      'documents/statement.pdf',
    );
    expect(httpServicePost).toHaveBeenCalledWith(
      'https://cartbi.com/api/upload',
      expect.anything(),
      expect.objectContaining({
        headers: { 'auth-token': 'test-token' },
      }),
    );
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.novelReturnDocId).toBe('CART-1');
    expect(documentRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ novelReturnDocId: 'CART-1' }),
    );
  });

  it('triggers the download call immediately when CartBI reports "processed" on upload', async () => {
    httpServicePost.mockReturnValueOnce(
      of({ data: { status: 'processed', docId: 'CART-2' } }),
    );
    documentRepository.findOne
      .mockResolvedValueOnce({ ...bankStatementDoc })
      .mockResolvedValueOnce({
        ...bankStatementDoc,
        lead,
        novelReturnDocId: 'CART-2',
      });
    httpServicePost.mockReturnValueOnce(
      of({ data: { status: 'downloaded', data: [{ fraudScore: 0 }] } }),
    );

    await service.upload({ leadId: 42, documentId: 7 });

    expect(httpServicePost).toHaveBeenCalledTimes(2);
    expect(httpServicePost).toHaveBeenNthCalledWith(
      2,
      'https://cartbi.com/api/downloadFile',
      'CART-2',
      expect.objectContaining({
        headers: { 'Content-Type': 'text/plain', 'auth-token': 'test-token' },
      }),
    );
  });

  it('marks the upload log as API_ERROR when CartBI omits a docId', async () => {
    httpServicePost.mockReturnValue(of({ data: { status: 'submitted' } }));

    const result = await service.upload({ leadId: 42, documentId: 7 });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(documentRepository.save).not.toHaveBeenCalled();
  });

  it('marks the log as NETWORK_ERROR when the CartBI call throws', async () => {
    httpServicePost.mockReturnValue(throwError(() => new Error('timeout')));

    const result = await service.upload({ leadId: 42, documentId: 7 });

    expect(result.status).toBe(ApiCallStatus.NETWORK_ERROR);
    expect(result.errors).toBe('timeout');
  });

  describe('downloadResult', () => {
    it('throws when no document matches the CartBI docId', async () => {
      documentRepository.findOne.mockResolvedValue(null);

      await expect(service.downloadResult('CART-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('records a successful download result', async () => {
      documentRepository.findOne.mockResolvedValue({
        ...bankStatementDoc,
        lead,
        novelReturnDocId: 'CART-1',
      });
      httpServicePost.mockReturnValue(
        of({ data: { status: 'downloaded', data: [{ fraudScore: 0 }] } }),
      );

      const result = await service.downloadResult('CART-1');

      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });
  });

  describe('getResult', () => {
    it('throws when no successful DOWNLOAD log exists yet', async () => {
      logRepository.findOne.mockResolvedValue(null);

      await expect(service.getResult(42)).rejects.toThrow(NotFoundException);
    });

    it('parses the real CartBI data[0] shape into a flat result', async () => {
      logRepository.findOne.mockResolvedValue({
        respondedAt: new Date('2026-07-31T00:00:00Z'),
        response: JSON.stringify({
          data: [
            {
              bankName: 'ICICI',
              bankFullName: 'ICICI Bank Ltd',
              accountNumber: '148801508980',
              accountName: 'RAJ RATAN',
              ifscCode: 'icic0001234',
              accountType: 'Saving',
              periodStart: '30/04/2026',
              periodEnd: '31/07/2026',
              fraudScore: 0,
              camAnalysisData: {
                totalNetCredits: 984513,
                averageBalance: 7066.49,
                averageBalanceLastThreeMonth: 9282.65,
                averageBalanceLastSixMonth: 7066.49,
                minBalanceLastThreeMonth: 0.01,
                minBalanceLastSixMonth: 0.01,
              },
            },
          ],
        }),
      });

      const result = await service.getResult(42);

      expect(result).toEqual({
        respondedAt: new Date('2026-07-31T00:00:00Z'),
        accountNumber: '148801508980',
        ifscCode: 'ICIC0001234',
        bankName: 'ICICI Bank Ltd',
        accountName: 'RAJ RATAN',
        accountType: 'Saving',
        periodStart: '30/04/2026',
        periodEnd: '31/07/2026',
        fraudScore: 0,
        totalNetCredits: 984513,
        averageBalance: 7066.49,
        averageBalanceLastThreeMonth: 9282.65,
        averageBalanceLastSixMonth: 7066.49,
        minBalanceLastThreeMonth: 0.01,
        minBalanceLastSixMonth: 0.01,
      });
    });

    it('throws when the log has no data[0] account entry', async () => {
      logRepository.findOne.mockResolvedValue({
        respondedAt: new Date(),
        response: JSON.stringify({ data: [] }),
      });

      await expect(service.getResult(42)).rejects.toThrow(NotFoundException);
    });
  });
});
