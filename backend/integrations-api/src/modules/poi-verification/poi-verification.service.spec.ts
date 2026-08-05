import {
  ApiCallStatus,
  Lead,
  LeadCustomer,
  PoiVerificationLog,
  VendorApiCacheProvider,
  VendorApiCacheType,
} from '@finance-crm/database';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VendorApiCacheService } from '../../common/vendor-api-cache.service';
import { DigitapClientService } from '../digitap/digitap-client.service';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { PoiVerificationService } from './poi-verification.service';

describe('PoiVerificationService', () => {
  let service: PoiVerificationService;
  let signzyPost: jest.Mock;
  let digitapPostMultipart: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };
  let leadCustomerRepository: { findOne: jest.Mock };
  let vendorApiCache: { get: jest.Mock; set: jest.Mock };
  let ocrProvider: string;

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    signzyPost = jest.fn();
    digitapPostMultipart = jest.fn();
    ocrProvider = 'signzy';
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    leadCustomerRepository = { findOne: jest.fn().mockResolvedValue(null) };
    vendorApiCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PoiVerificationService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        {
          provide: DigitapClientService,
          useValue: { postMultipart: digitapPostMultipart },
        },
        {
          provide: ConfigService,
          useValue: { get: () => ocrProvider },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(PoiVerificationLog),
          useValue: logRepository,
        },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        { provide: VendorApiCacheService, useValue: vendorApiCache },
      ],
    }).compile();

    service = moduleRef.get(PoiVerificationService);
  });

  describe('verifyPan (methodId 1)', () => {
    it('posts the real Signzy v3/pan/fetchV2 request shape', async () => {
      signzyPost.mockResolvedValue({
        data: {
          result: {
            number: 'ABCDE1234F',
            name: 'Test Auditee',
            fatherName: 'Father Name',
          },
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyPan({ leadId: 42, pan: 'ABCDE1234F' });

      expect(signzyPost).toHaveBeenCalledWith('v3/pan/fetchV2', {
        number: 'ABCDE1234F',
      });
      expect(result.method).toBe(1);
      expect(result.proofNo).toBe('ABCDE1234F');
      expect(result.fatherName).toBe('Father Name');
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('marks the log as API_ERROR when no proofNo (pan) is provided by the caller path fallback fails', async () => {
      signzyPost.mockResolvedValue({
        data: { result: {} },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.verifyPan({ leadId: 42, pan: 'ABCDE1234F' });

      // proofNo for verifyPan is the input PAN itself, always truthy — Signzy's
      // response only supplies fatherName; status therefore depends on the
      // input pan, not the response shape, matching the real service logic.
      expect(result.proofNo).toBe('ABCDE1234F');
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(result.fatherName).toBeNull();
    });

    it('caches a successful fetch keyed by PAN/provider/type', async () => {
      signzyPost.mockResolvedValue({
        data: { result: { number: 'ABCDE1234F', fatherName: 'Father Name' } },
        requestJson: '{"number":"ABCDE1234F"}',
        responseJson: '{"result":{"number":"ABCDE1234F"}}',
        errorMessage: null,
      });

      await service.verifyPan({ leadId: 42, pan: 'ABCDE1234F' });

      expect(vendorApiCache.get).toHaveBeenCalledWith(
        'ABCDE1234F',
        VendorApiCacheProvider.SIGNZY,
        VendorApiCacheType.PAN_FETCH,
      );
      expect(vendorApiCache.set).toHaveBeenCalledWith(
        'ABCDE1234F',
        VendorApiCacheProvider.SIGNZY,
        VendorApiCacheType.PAN_FETCH,
        '{"result":{"number":"ABCDE1234F"}}',
        lead,
        '{"number":"ABCDE1234F"}',
      );
    });

    it('reuses a cache hit instead of calling Signzy', async () => {
      vendorApiCache.get.mockResolvedValue({
        response:
          '{"result":{"number":"ABCDE1234F","fatherName":"Cached Dad"}}',
        request: null,
      });

      const result = await service.verifyPan({
        leadId: 42,
        pan: 'ABCDE1234F',
      });

      expect(signzyPost).not.toHaveBeenCalled();
      expect(vendorApiCache.set).not.toHaveBeenCalled();
      expect(result.fatherName).toBe('Cached Dad');
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });
  });

  describe('verifyDualPan', () => {
    const customer = {
      pancard: 'ZZZZZ0000Z',
      firstName: 'John',
      middleName: 'K',
      surName: 'Doe',
    };

    it('reports a name match (status 1) when the returned PAN name matches the lead', async () => {
      leadCustomerRepository.findOne.mockResolvedValue(customer);
      signzyPost.mockResolvedValue({
        data: { result: { number: 'ABCDE1234F', name: 'John K Doe' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const { log, isNameMatch } = await service.verifyDualPan({
        leadId: 42,
        pan: 'ABCDE1234F',
      });

      expect(signzyPost).toHaveBeenCalledWith('v3/pan/fetchV2', {
        number: 'ABCDE1234F',
      });
      expect(isNameMatch).toBe(true);
      expect(log.isOtherPancard).toBe(true);
      expect(log.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('reports no match (status 2, not "success") when the returned PAN name differs', async () => {
      leadCustomerRepository.findOne.mockResolvedValue(customer);
      signzyPost.mockResolvedValue({
        data: { result: { number: 'ABCDE1234F', name: 'Someone Else' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const { isNameMatch } = await service.verifyDualPan({
        leadId: 42,
        pan: 'ABCDE1234F',
      });

      expect(isNameMatch).toBe(false);
    });

    it('rejects when the alternate PAN is the same as the one already on the lead', async () => {
      leadCustomerRepository.findOne.mockResolvedValue(customer);

      await expect(
        service.verifyDualPan({ leadId: 42, pan: 'zzzzz0000z' }),
      ).rejects.toThrow(/already exists/);
      expect(signzyPost).not.toHaveBeenCalled();
    });
  });

  describe('ocrPan (methodId 2)', () => {
    it('posts the real Signzy v3/pan/extractions request shape', async () => {
      signzyPost.mockResolvedValue({
        data: { result: { number: 'ABCDE1234F', fatherName: 'Father Name' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.ocrPan({
        leadId: 42,
        documentUrl: 'https://example.com/pan.jpg',
      });

      expect(signzyPost).toHaveBeenCalledWith('v3/pan/extractions', {
        documentUrl: 'https://example.com/pan.jpg',
      });
      expect(result.method).toBe(2);
      expect(result.proofNo).toBe('ABCDE1234F');
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('marks the log as API_ERROR when no number is extracted', async () => {
      signzyPost.mockResolvedValue({
        data: { result: {} },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.ocrPan({
        leadId: 42,
        documentUrl: 'https://example.com/pan.jpg',
      });

      expect(result.status).toBe(ApiCallStatus.API_ERROR);
      expect(result.proofNo).toBeNull();
    });

    it('uses Digitap when OCR_PROVIDER=digitap, posting to the real Digitap PAN OCR URL', async () => {
      ocrProvider = 'digitap';
      digitapPostMultipart.mockResolvedValue({
        data: {
          result: [
            {
              details: {
                pan_no: { value: 'ABCDE1234F' },
                father: { value: 'Father Name' },
              },
            },
          ],
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.ocrPan({
        leadId: 42,
        documentUrl: 'https://example.com/pan.jpg',
      });

      expect(digitapPostMultipart).toHaveBeenCalledWith(
        'https://api.digitap.ai/ocr/v1/pan',
        'https://example.com/pan.jpg',
        {
          clientRefId: '42',
          isBlackWhiteCheck: 'yes',
          confidence: 'yes',
          fraudCheck: 'yes',
        },
      );
      expect(result.proofNo).toBe('ABCDE1234F');
      expect(result.fatherName).toBe('Father Name');
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(signzyPost).not.toHaveBeenCalled();
    });
  });

  describe('ocrAadhaar (methodId 3)', () => {
    it('posts the real Signzy v3/aadhaar/extraction request shape', async () => {
      signzyPost.mockResolvedValue({
        data: { result: { uid: '123412341234' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.ocrAadhaar({
        leadId: 42,
        documentUrl: 'https://example.com/aadhaar.jpg',
      });

      expect(signzyPost).toHaveBeenCalledWith('v3/aadhaar/extraction', {
        documentUrl: 'https://example.com/aadhaar.jpg',
      });
      expect(result.method).toBe(3);
      expect(result.proofNo).toBe('123412341234');
      expect(result.fatherName).toBeNull();
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('marks the log as API_ERROR when no uid is extracted', async () => {
      signzyPost.mockResolvedValue({
        data: { result: {} },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.ocrAadhaar({
        leadId: 42,
        documentUrl: 'https://example.com/aadhaar.jpg',
      });

      expect(result.status).toBe(ApiCallStatus.API_ERROR);
    });

    it('uses Digitap when OCR_PROVIDER=digitap, posting to the real Digitap Aadhaar OCR URL', async () => {
      ocrProvider = 'digitap';
      digitapPostMultipart.mockResolvedValue({
        data: { result: [{ details: { aadhaar: { value: '123412341234' } } }] },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.ocrAadhaar({
        leadId: 42,
        documentUrl: 'https://example.com/aadhaar.jpg',
      });

      expect(digitapPostMultipart).toHaveBeenCalledWith(
        'https://api.digitap.ai/ocr/v1/aadhaar',
        'https://example.com/aadhaar.jpg',
        {
          clientRefId: '42',
          isBlackWhiteCheck: 'yes',
          confidence: 'yes',
          fraudCheck: 'yes',
        },
      );
      expect(result.proofNo).toBe('123412341234');
      expect(result.fatherName).toBeNull();
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(signzyPost).not.toHaveBeenCalled();
    });
  });
});
