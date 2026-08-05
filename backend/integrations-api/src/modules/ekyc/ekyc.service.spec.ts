import {
  ApiCallStatus,
  ApiProvider,
  EkycLog,
  Lead,
  LeadCustomer,
  Pincode,
} from '@finance-crm/database';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DigitapClientService } from '../digitap/digitap-client.service';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { EkycService } from './ekyc.service';

describe('EkycService', () => {
  let service: EkycService;
  let signzyPost: jest.Mock;
  let digitapPostJson: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let ekycLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };
  let leadCustomerRepository: { findOne: jest.Mock; save: jest.Mock };
  let pincodeRepository: { findOne: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    signzyPost = jest.fn();
    digitapPostJson = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    ekycLogRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      findOne: jest.fn(),
    };
    leadCustomerRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    pincodeRepository = { findOne: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EkycService,
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        {
          provide: DigitapClientService,
          useValue: { postJson: digitapPostJson },
        },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: string) => fallback },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(EkycLog), useValue: ekycLogRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        {
          provide: getRepositoryToken(Pincode),
          useValue: pincodeRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(EkycService);
  });

  it('calls the real Signzy Digilocker createUrl path with the real request shape', async () => {
    signzyPost.mockResolvedValue({
      data: {
        result: {
          requestId: 'req-123',
          url: 'https://signzy.example/redirect',
        },
      },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.createDigilockerUrl(42);

    expect(signzyPost).toHaveBeenCalledTimes(1);
    const [path, body] = signzyPost.mock.calls[0];
    expect(path).toBe('v3/digilocker-v2/createUrl');
    expect(body).toMatchObject({
      signup: true,
      docType: ['PANCR', 'ADHAR'],
      purpose: 'kyc',
      getScope: true,
      companyName: 'Signzy',
    });
    expect(result.methodId).toBe(1);
    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(result.returnRequestId).toBe('req-123');
    expect(result.returnUrl).toBe('https://signzy.example/redirect');
  });

  it('marks the log as API_ERROR when Signzy returns no requestId/url', async () => {
    signzyPost.mockResolvedValue({
      data: { result: {} },
      requestJson: '{}',
      responseJson: '{}',
      errorMessage: null,
    });

    const result = await service.createDigilockerUrl(42);

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
  });

  it('rejects getDigilockerDetails when no prior create-URL request exists for the lead', async () => {
    ekycLogRepository.findOne.mockResolvedValue(null);

    await expect(service.getDigilockerDetails(42)).rejects.toThrow(
      'No Digilocker create-URL request found',
    );
  });

  describe('getEaadhaar address write-back', () => {
    const customer = { aaAddressLine1: null } as unknown as LeadCustomer;

    beforeEach(() => {
      ekycLogRepository.findOne.mockResolvedValue({
        returnRequestId: 'req-123',
      });
    });

    it('writes the structured Aadhaar address back onto lead_customer, resolving state/city via pincode', async () => {
      signzyPost.mockResolvedValue({
        data: {
          result: {
            uid: 'uid-1',
            dob: '1990-01-01',
            address: '221B Baker St, Marylebone, 110001',
            splitAddress: {
              city: ['Marylebone'],
              district: ['Central'],
              addressLine: '221B Baker St',
              landMark: 'Near Park',
              pincode: '110001',
            },
          },
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });
      leadCustomerRepository.findOne.mockResolvedValue(customer);
      const city = { id: 1, state: { id: 1 } };
      pincodeRepository.findOne.mockResolvedValue({ city });

      const result = await service.getEaadhaar(42);

      expect(pincodeRepository.findOne).toHaveBeenCalledWith({
        where: { value: '110001' },
        relations: { city: { state: true } },
      });
      expect(leadCustomerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          aaAddressLine1: '221B Baker St',
          aaAddressLine2: 'Marylebone',
          aaLandmark: 'Near Park',
          aaCurrentEaadhaarAddress: '221B Baker St, Marylebone, 110001',
          aaPincode: '110001',
          aaState: city.state,
          aaCity: city,
        }),
      );
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });

    it('skips the write-back entirely when the lead has no lead_customer row', async () => {
      signzyPost.mockResolvedValue({
        data: {
          result: {
            uid: 'uid-1',
            dob: '1990-01-01',
            splitAddress: { pincode: '110001' },
          },
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });
      leadCustomerRepository.findOne.mockResolvedValue(null);

      await service.getEaadhaar(42);

      expect(pincodeRepository.findOne).not.toHaveBeenCalled();
      expect(leadCustomerRepository.save).not.toHaveBeenCalled();
    });

    it('does not attempt a write-back when Signzy returns no uid/dob', async () => {
      signzyPost.mockResolvedValue({
        data: { result: {} },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.getEaadhaar(42);

      expect(leadCustomerRepository.findOne).not.toHaveBeenCalled();
      expect(result.status).toBe(ApiCallStatus.API_ERROR);
    });
  });

  describe('Digitap Digilocker', () => {
    it('calls the real Digitap create-url request shape and stores provider=DIGITAP', async () => {
      digitapPostJson.mockResolvedValue({
        data: {
          model: {
            transactionId: 'txn-123',
            kycUrl: 'https://digitap.example/redirect',
          },
        },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.createDigitapDigilockerUrl(42);

      expect(digitapPostJson).toHaveBeenCalledWith(
        'https://api.digitap.ai/ent/v1/kyc/generate-url',
        expect.objectContaining({ serviceId: '4', isSendOtp: true }),
      );
      expect(result.provider).toBe(ApiProvider.DIGITAP);
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(result.returnRequestId).toBe('txn-123');
      expect(result.returnUrl).toBe('https://digitap.example/redirect');
    });

    it('rejects getDigitapDigilockerDetails when no prior create-url request exists', async () => {
      ekycLogRepository.findOne.mockResolvedValue(null);

      await expect(service.getDigitapDigilockerDetails(42)).rejects.toThrow(
        'No Digitap Digilocker create-URL request found',
      );
    });

    it('fetches Digitap Digilocker details using the prior transactionId', async () => {
      ekycLogRepository.findOne.mockResolvedValue({
        returnRequestId: 'txn-123',
      });
      digitapPostJson.mockResolvedValue({
        data: { model: { status: 's' } },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.getDigitapDigilockerDetails(42);

      expect(digitapPostJson).toHaveBeenCalledWith(
        'https://api.digitap.ai/ent/v1/kyc/get-digilocker-details',
        { transactionId: 'txn-123' },
      );
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });
  });

  describe('Digitap eKYC OTP', () => {
    it('sends an OTP create request with the real Digitap request shape', async () => {
      digitapPostJson.mockResolvedValue({
        data: { code: '200', msg: 'OTP sent' },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.createDigitapEkycOtp(42, '123456789012');

      expect(digitapPostJson).toHaveBeenCalledWith(
        'https://svc.digitap.ai/ent/v3/kyc/intiate-kyc-auto',
        expect.objectContaining({ uid: '123456789012' }),
      );
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
      expect(result.provider).toBe(ApiProvider.DIGITAP);
    });

    it('rejects submitDigitapEkycOtp when no prior create-otp request exists', async () => {
      ekycLogRepository.findOne.mockResolvedValue(null);

      await expect(service.submitDigitapEkycOtp(42, '1234')).rejects.toThrow(
        'No Digitap eKYC create-OTP request found',
      );
    });

    it('submits the OTP using the transactionId/fwdp/codeVerifier from the create-otp response', async () => {
      ekycLogRepository.findOne.mockResolvedValue({
        response: JSON.stringify({
          model: {
            transactionId: 'txn-otp-1',
            fwdp: 'fwdp-value',
            codeVerifier: 'verifier-value',
          },
        }),
        aadhaarNo: '123412341234',
      });
      digitapPostJson.mockResolvedValue({
        data: { code: '200' },
        requestJson: '{}',
        responseJson: '{}',
        errorMessage: null,
      });

      const result = await service.submitDigitapEkycOtp(42, '1234');

      expect(digitapPostJson).toHaveBeenCalledWith(
        'https://svc.digitap.ai/ent/v3/kyc/submit-otp',
        expect.objectContaining({
          transactionId: 'txn-otp-1',
          fwdp: 'fwdp-value',
          codeVerifier: 'verifier-value',
          otp: '1234',
        }),
      );
      expect(result.status).toBe(ApiCallStatus.SUCCESS);
    });
  });
});
