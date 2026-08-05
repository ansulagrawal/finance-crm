import {
  ApiCallStatus,
  EsignLog,
  EsignMethod,
  EsignProvider,
  Lead,
} from '@finance-crm/database';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { EsignService } from './esign.service';

describe('EsignService', () => {
  let service: EsignService;
  let signzyPost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let esignLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    signzyPost = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    esignLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      findOne: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EsignService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: string) => fallback },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(EsignLog), useValue: esignLogRepository },
      ],
    }).compile();

    service = moduleRef.get(EsignService);
  });

  describe('initiateContract', () => {
    it('posts the real Signzy contract/initiate request shape with method UPLOAD_DOCUMENT', async () => {
      signzyPost.mockResolvedValue({
        data: {
          customerId: 'cust-1',
          signerdetail: [{ workflowUrl: 'https://signzy.example/sign' }],
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.initiateContract({
        leadId: 42,
        documentBase64: 'base64pdf',
        signerName: 'Test Auditee',
        signerMobile: '9999999999',
        signerEmail: 'auditee@example.com',
        aadhaarLastFourDigits: '1234',
      });

      expect(signzyPost).toHaveBeenCalledTimes(1);
      const [path, body] = signzyPost.mock.calls[0];
      expect(path).toBe('v3/contract/initiate');
      expect(body).toMatchObject({
        pdf: 'base64pdf',
        contractName: 'Esign Letter',
        contractExecuterName: 'Signzy',
        eSignProvider: 'eMudhra',
        signerdetail: [
          {
            signerName: 'Test Auditee',
            signerMobile: '9999999999',
            signerEmail: 'auditee@example.com',
            uidLastFourDigits: '1234',
            signatureType: 'AADHAARESIGN-OTP',
          },
        ],
        customerMailList: ['auditee@example.com'],
      });
      expect(result.method).toBe(EsignMethod.UPLOAD_DOCUMENT);
      expect(result.provider).toBe(EsignProvider.SIGNZY);
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(result.returnUrl).toBe('https://signzy.example/sign');
      expect(result.aadhaarNo).toBe('1234');
    });

    it('marks the log as API_ERROR when Signzy returns no customerId/workflowUrl', async () => {
      signzyPost.mockResolvedValue({
        data: { signerdetail: [{}] },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.initiateContract({
        leadId: 42,
        documentBase64: 'base64pdf',
        signerName: 'Test Auditee',
        signerMobile: '9999999999',
        signerEmail: 'auditee@example.com',
        aadhaarLastFourDigits: '1234',
      });

      expect(result.status).toBe(ApiCallStatus.API_ERROR);
      expect(result.returnUrl).toBeNull();
    });
  });

  describe('downloadSignedDocument', () => {
    it('rejects when no prior initiateContract request exists for the lead', async () => {
      esignLogRepository.findOne.mockResolvedValue(null);

      await expect(service.downloadSignedDocument(42)).rejects.toThrow(
        'No eSign contract initiated for this lead',
      );
      expect(signzyPost).not.toHaveBeenCalled();
    });

    it('posts contract/pullData with method DOWNLOAD_DOCS and marks SUCCESS on finalSignedContract', async () => {
      esignLogRepository.findOne.mockResolvedValue({
        id: 1,
        method: EsignMethod.UPLOAD_DOCUMENT,
      });
      signzyPost.mockResolvedValue({
        data: { finalSignedContract: 'https://signzy.example/signed.pdf' },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.downloadSignedDocument(42);

      expect(signzyPost).toHaveBeenCalledWith('v3/contract/pullData', {});
      expect(result.method).toBe(EsignMethod.DOWNLOAD_DOCS);
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(result.returnUrl).toBe('https://signzy.example/signed.pdf');
    });

    it('marks the log as API_ERROR when no finalSignedContract is returned', async () => {
      esignLogRepository.findOne.mockResolvedValue({
        id: 1,
        method: EsignMethod.UPLOAD_DOCUMENT,
      });
      signzyPost.mockResolvedValue({
        data: {},
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.downloadSignedDocument(42);

      expect(result.status).toBe(ApiCallStatus.API_ERROR);
    });
  });
});
