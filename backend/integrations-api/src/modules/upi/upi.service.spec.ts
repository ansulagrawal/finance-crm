import { generateKeyPairSync } from 'node:crypto';
import { ApiCallStatus, Lead, Loan, UpiCollectionLog } from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { encryptForIcici } from './icici-rsa.util';
import { UpiService } from './upi.service';

describe('UpiService', () => {
  let service: UpiService;
  let httpServicePost: jest.Mock;
  let leadRepository: { findOneBy: jest.Mock };
  let loanRepository: { findOne: jest.Mock };
  let logRepository: { create: jest.Mock; save: jest.Mock };
  let publicKey: string;
  let privateKey: string;

  const lead = { id: 42 } as Lead;

  beforeAll(() => {
    const { publicKey: pub, privateKey: priv } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    publicKey = pub;
    privateKey = priv;
  });

  beforeEach(async () => {
    httpServicePost = jest.fn();
    leadRepository = { findOneBy: jest.fn().mockResolvedValue(lead) };
    loanRepository = {
      findOne: jest
        .fn()
        .mockResolvedValue({ loanNumber: 'LN-001', status: 'DISBURSED' }),
    };
    logRepository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpiService,
        { provide: HttpService, useValue: { post: httpServicePost } },
        {
          provide: ConfigService,
          useValue: {
            ...(() => {
              const values: Record<string, string> = {
                ICICI_UPI_MERCHANT_ID: 'test-merchant',
                ICICI_UPI_TERMINAL_ID: 'test-terminal',
                ICICI_UPI_API_KEY: 'test-api-key',
                ICICI_UPI_QR_API_URL: 'https://icici.example/upi/qr',
                ICICI_UPI_PUBLIC_KEY: publicKey,
                ICICI_UPI_PRIVATE_KEY: privateKey,
              };
              const lookup = (key: string) => {
                if (key in values) return values[key];
                throw new Error(`Unexpected config key: ${key}`);
              };
              // readPemFromConfig uses get(); the rest use getOrThrow.
              return { get: lookup, getOrThrow: lookup };
            })(),
          },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(UpiCollectionLog),
          useValue: logRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(UpiService);
  });

  it('throws BadRequestException when the lead has no loan yet', async () => {
    loanRepository.findOne.mockResolvedValue(null);

    await expect(
      service.createQrRequest({ leadId: 42, amount: 1000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the loan is not DISBURSED', async () => {
    loanRepository.findOne.mockResolvedValue({
      loanNumber: 'LN-001',
      status: 'DISBURSE-PENDING',
    });

    await expect(
      service.createQrRequest({ leadId: 42, amount: 1000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('encrypts the request for ICICI, decrypts the real response, and marks SUCCESS', async () => {
    const responsePayload = { qrString: 'upi://pay?pa=merchant@icici' };
    const encryptedResponse = encryptForIcici(
      JSON.stringify(responsePayload),
      publicKey,
    );
    httpServicePost.mockReturnValue(of({ data: encryptedResponse }));

    const result = await service.createQrRequest({ leadId: 42, amount: 1500 });

    expect(httpServicePost).toHaveBeenCalledWith(
      'https://icici.example/upi/qr',
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: 'test-api-key' }),
      }),
    );
    // The wire payload must never carry the plaintext request params.
    const [, wirePayload] = httpServicePost.mock.calls[0];
    expect(wirePayload).not.toContain('merchant@icici');
    expect(wirePayload).not.toContain('test-merchant');

    expect(result.status).toBe(ApiCallStatus.SUCCESS);
    expect(JSON.parse(result.response ?? '')).toEqual(responsePayload);
    expect(result.requestedAmount).toBe('1500');
  });

  it('marks the log API_ERROR when the configured key value is not valid PEM', async () => {
    // RSA_PKCS1_PADDING decryption of garbage ciphertext doesn't reliably
    // throw (padding-check outcome is probabilistic, see icici-rsa.util
    // .spec.ts) -- a malformed key value is the deterministic way to
    // exercise the catch branch instead.
    httpServicePost.mockReturnValue(of({ data: 'irrelevant' }));
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpiService,
        { provide: HttpService, useValue: { post: httpServicePost } },
        {
          provide: ConfigService,
          useValue: {
            ...(() => {
              const values: Record<string, string> = {
                ICICI_UPI_MERCHANT_ID: 'test-merchant',
                ICICI_UPI_TERMINAL_ID: 'test-terminal',
                ICICI_UPI_API_KEY: 'test-api-key',
                ICICI_UPI_QR_API_URL: 'https://icici.example/upi/qr',
                // Not PEM at all — readPemFromConfig rejects it before
                // OpenSSL ever sees it.
                ICICI_UPI_PUBLIC_KEY: 'not-a-pem',
                ICICI_UPI_PRIVATE_KEY: privateKey,
              };
              const lookup = (key: string) => {
                if (key in values) return values[key];
                throw new Error(`Unexpected config key: ${key}`);
              };
              // readPemFromConfig uses get(); the rest use getOrThrow.
              return { get: lookup, getOrThrow: lookup };
            })(),
          },
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(UpiCollectionLog),
          useValue: logRepository,
        },
      ],
    }).compile();
    const brokenService = moduleRef.get(UpiService);

    const result = await brokenService.createQrRequest({
      leadId: 42,
      amount: 1000,
    });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.errors).toBeTruthy();
  });

  it('marks the log API_ERROR when the HTTP call itself fails', async () => {
    httpServicePost.mockReturnValue(
      throwError(() => new Error('connect ETIMEDOUT')),
    );

    const result = await service.createQrRequest({ leadId: 42, amount: 1000 });

    expect(result.status).toBe(ApiCallStatus.API_ERROR);
    expect(result.errors).toContain('connect ETIMEDOUT');
  });
});
