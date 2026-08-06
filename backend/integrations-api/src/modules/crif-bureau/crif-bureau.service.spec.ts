import { BureauType, CrifBureauLog, Lead } from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { SignzyClientService } from '../signzy/signzy-client.service';
import { CrifBureauService } from './crif-bureau.service';

describe('CrifBureauService', () => {
  let service: CrifBureauService;
  let httpServicePost: jest.Mock;
  let httpServiceGet: jest.Mock;
  let signzyPost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock };

  const lead = { id: 42 } as Lead;

  beforeEach(async () => {
    httpServicePost = jest.fn();
    httpServiceGet = jest.fn();
    signzyPost = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CrifBureauService,
        {
          provide: HttpService,
          useValue: { post: httpServicePost, get: httpServiceGet },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback?: string) => fallback,
            getOrThrow: (key: string) => {
              if (key === 'SUREPASS_API_TOKEN') return 'test-token';
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
        { provide: SignzyClientService, useValue: { post: signzyPost } },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(CrifBureauLog), useValue: logRepository },
      ],
    }).compile();

    service = moduleRef.get(CrifBureauService);
  });

  it('posts the real Surepass CRIF request shape to the real endpoint with Bearer auth', async () => {
    httpServicePost.mockReturnValue(
      of({
        data: {
          status_code: 200,
          success: true,
          data: {
            credit_report: {
              SCORES: { SCORE: { 'SCORE-VALUE': '742' } },
            },
          },
        },
      }),
    );

    const result = await service.fetchReport({
      leadId: 42,
      firstName: 'Test',
      lastName: 'Auditee',
      mobile: '9999999999',
      pan: 'ABCDE1234F',
    });

    expect(httpServicePost).toHaveBeenCalledWith(
      'https://kyc-api.surepass.app/api/v1/credit-report-crif/fetch-report-pdf',
      {
        first_name: 'Test',
        last_name: 'Auditee',
        mobile: '9999999999',
        pan: 'ABCDE1234F',
        consent: 'Y',
        raw: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      },
    );
    expect(result.cibilScore).toBe('742');
    expect(result.bureauType).toBe(BureauType.CRIF);
  });

  it('downloads and stores the real report PDF from credit_report_link as base64', async () => {
    httpServicePost.mockReturnValue(
      of({
        data: {
          status_code: 200,
          success: true,
          data: {
            credit_report: {
              SCORES: { SCORE: { 'SCORE-VALUE': '742' } },
            },
            credit_report_link: 'https://surepass.example/report.pdf',
          },
        },
      }),
    );
    // `Buffer.from(str).buffer` exposes Node's shared internal pool
    // ArrayBuffer (not an isolated one sized to this string), which leaks
    // unrelated bytes -- `new Uint8Array(buf).buffer` copies into a fresh,
    // correctly-sized ArrayBuffer, matching what a real arraybuffer-typed
    // axios response actually provides.
    httpServiceGet.mockReturnValue(
      of({ data: new Uint8Array(Buffer.from('pdf-bytes')).buffer }),
    );

    const result = await service.fetchReport({
      leadId: 42,
      firstName: 'Test',
      lastName: 'Auditee',
      mobile: '9999999999',
      pan: 'ABCDE1234F',
    });

    expect(httpServiceGet).toHaveBeenCalledWith(
      'https://surepass.example/report.pdf',
      { responseType: 'arraybuffer' },
    );
    expect(result.reportFile).toBe(Buffer.from('pdf-bytes').toString('base64'));
  });

  it('leaves cibilScore/reportFile null when Surepass returns a non-200 status_code', async () => {
    httpServicePost.mockReturnValue(
      of({ data: { status_code: 400, success: false } }),
    );

    const result = await service.fetchReport({
      leadId: 42,
      firstName: 'Test',
      lastName: 'Auditee',
      mobile: '9999999999',
      pan: 'ABCDE1234F',
    });

    expect(result.cibilScore).toBeNull();
    expect(result.reportFile).toBeNull();
  });

  it('leaves cibilScore null without throwing when the HTTP call itself fails', async () => {
    httpServicePost.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED')),
    );

    const result = await service.fetchReport({
      leadId: 42,
      firstName: 'Test',
      lastName: 'Auditee',
      mobile: '9999999999',
      pan: 'ABCDE1234F',
    });

    expect(result.cibilScore).toBeNull();
  });

  describe('fetchReportViaSignzy', () => {
    const signzyDto = {
      leadId: 42,
      firstName: 'Test',
      lastName: 'Auditee',
      mobile: '9999999999',
      pan: 'ABCDE1234F',
      dob: '1990-01-01',
      gender: 'MALE',
      addressLine1: 'House 1',
      addressLine2: 'Locality',
      landmark: 'Landmark',
      city: 'City',
      state: 'State',
      pincode: '110001',
    };

    it('chains all 3 Signzy steps and returns the consent URL', async () => {
      signzyPost
        .mockResolvedValueOnce({
          statusCode: 200,
          data: {
            decryptedData: { requestId: 'req-1' },
            encryptedData: 'encrypted-payload',
          },
          requestJson: '{"step":1}',
          responseJson: '{"decryptedData":{"requestId":"req-1"}}',
          errorMessage: null,
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          data: { responseData: 'consent-payload' },
          requestJson: '{"step":2}',
          responseJson: '{"responseData":"consent-payload"}',
          errorMessage: null,
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          data: { result: { url: 'https://consent.example/redirect' } },
          requestJson: '{"step":3}',
          responseJson: '{"result":{"url":"https://consent.example/redirect"}}',
          errorMessage: null,
        });

      const result = await service.fetchReportViaSignzy(signzyDto);

      expect(signzyPost).toHaveBeenNthCalledWith(
        1,
        'v3/test-encrypt-data',
        expect.objectContaining({
          phoneNumber: '9999999999',
          panNumber: 'ABCDE1234F',
          gender: 'Male',
          otpBypass: true,
        }),
      );
      expect(signzyPost).toHaveBeenNthCalledWith(
        2,
        'https://api.signzy.app/api/v3/create-bureau-consent',
        { requestData: 'encrypted-payload' },
      );
      expect(signzyPost).toHaveBeenNthCalledWith(
        3,
        'https://api.signzy.app/api/v3/test-decrypt-data',
        { requestData: 'consent-payload' },
      );
      expect(result.consentUrl).toBe('https://consent.example/redirect');
      expect(result.log.applicationId).toBe('req-1');
      expect(result.log.isActive).toBe(true);
      expect(result.log.isDeleted).toBe(false);
    });

    it('stops after step 1 when there is no requestId/encryptedData', async () => {
      signzyPost.mockResolvedValueOnce({
        statusCode: 422,
        data: null,
        requestJson: '{"step":1}',
        responseJson: '{}',
        errorMessage: 'bad request',
      });

      const result = await service.fetchReportViaSignzy(signzyDto);

      expect(signzyPost).toHaveBeenCalledTimes(1);
      expect(result.consentUrl).toBeNull();
      expect(result.log.isActive).toBe(false);
      expect(result.log.isDeleted).toBe(true);
    });

    it('stops after step 2 when there is no responseData', async () => {
      signzyPost
        .mockResolvedValueOnce({
          statusCode: 200,
          data: {
            decryptedData: { requestId: 'req-1' },
            encryptedData: 'encrypted-payload',
          },
          requestJson: '{"step":1}',
          responseJson: '{}',
          errorMessage: null,
        })
        .mockResolvedValueOnce({
          statusCode: 422,
          data: null,
          requestJson: '{"step":2}',
          responseJson: '{}',
          errorMessage: 'bad request',
        });

      const result = await service.fetchReportViaSignzy(signzyDto);

      expect(signzyPost).toHaveBeenCalledTimes(2);
      expect(result.consentUrl).toBeNull();
    });
  });

  describe('getReportBytes', () => {
    it('downloads the stored PDF for the most recent log with a reportFile', async () => {
      logRepository.findOne.mockResolvedValue({
        reportFile: Buffer.from('pdf-bytes').toString('base64'),
      });

      const result = await service.getReportBytes(42);

      expect(result).toEqual(Buffer.from('pdf-bytes'));
    });

    it('throws NotFoundException when no log has a stored report', async () => {
      logRepository.findOne.mockResolvedValue(null);
      await expect(service.getReportBytes(42)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
