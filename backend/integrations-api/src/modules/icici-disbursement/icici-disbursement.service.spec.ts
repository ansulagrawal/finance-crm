import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import {
  ApiCallStatus,
  DisbursementApiLog,
  Lead,
  LoanPaymentType,
} from '@finance-crm/database';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { IciciDisbursementService } from './icici-disbursement.service';

// A real generated keypair passed by value, so the real crypto path runs
// rather than being mocked. Mocking it would leave the most consequential code
// in the module untested.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const CONFIG: Record<string, string> = {
  ICICI_DISBURSAL_PASSCODE: 'secret-passcode',
  ICICI_DISBURSAL_BC_ID: 'secret-bcid',
  ICICI_DISBURSAL_API_KEY: 'secret-apikey',
  // Supplied by value, as production does — and deliberately flattened to
  // literal \n, the awkward single-line .env shape, so the whole
  // config -> readPemFromConfig -> OpenSSL path is exercised.
  ICICI_DISBURSAL_PUBLIC_CERT: publicKey.replace(/\n/g, '\\n'),
  ICICI_DISBURSAL_PRIVATE_KEY: privateKey,
  COMPANY_NAME: 'Acme Leasing',
};

/** Encrypts a plaintext response the way ICICI would. */
function iciciResponse(plaintext: string): string {
  const sessionKey = randomBytes(16);
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-128-cbc', sessionKey, iv);
  return JSON.stringify({
    encryptedKey: publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
      sessionKey,
    ).toString('base64'),
    iv: iv.toString('base64'),
    encryptedData: Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]).toString('base64'),
  });
}

const DTO = {
  leadId: 1,
  transactionReferenceNo: 'SLPRD20260807010203123',
  paymentType: LoanPaymentType.IMPS,
  amount: 9000,
  loanNumber: 'LN-001',
  beneficiaryAccountNumber: '20279774002',
  beneficiaryIfscCode: 'SBIN0016732',
  beneficiaryName: 'Priyadarshini Sharma Extra Long',
};

describe('IciciDisbursementService', () => {
  let service: IciciDisbursementService;
  let post: jest.Mock;
  let logRepository: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    post = jest.fn();
    logRepository = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: unknown) => x),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IciciDisbursementService,
        {
          provide: getRepositoryToken(Lead),
          useValue: { findOneBy: jest.fn().mockResolvedValue({ id: 1 }) },
        },
        {
          provide: getRepositoryToken(DisbursementApiLog),
          useValue: logRepository,
        },
        { provide: HttpService, useValue: { post } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => CONFIG[key] ?? fallback,
            getOrThrow: (key: string) => {
              if (!CONFIG[key]) throw new Error(`missing ${key}`);
              return CONFIG[key];
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(IciciDisbursementService);
  });

  function outcomeOf(log: unknown): string | undefined {
    return (log as { outcome?: string }).outcome;
  }

  describe('outcome classification', () => {
    it('SUCCESS on ActCode 0 + success true + BankRRN', async () => {
      post.mockReturnValue(
        of({
          data: iciciResponse(
            '{"ActCode":"0","success":true,"BankRRN":"200701023783"}',
          ),
        }),
      );

      const log = await service.disburse(DTO);

      expect(outcomeOf(log)).toBe('SUCCESS');
      expect(log.bankReferenceNo).toBe('200701023783');
      expect(log.status).toBe(ApiCallStatus.SUCCESS);
      expect(log.errors).toBeNull();
    });

    it('UNKNOWN — not SUCCESS — when success-shaped but BankRRN is missing', async () => {
      // The money may well have moved, so this must never be treated as a
      // failure the caller can retry.
      post.mockReturnValue(
        of({ data: iciciResponse('{"ActCode":"0","success":true}') }),
      );

      const log = await service.disburse(DTO);

      expect(outcomeOf(log)).toBe('UNKNOWN');
      expect(log.bankReferenceNo).toBeNull();
      expect(log.errors).toMatch(/BankRRN is not available/);
    });

    it('REJECTED when ActCode is non-zero', async () => {
      post.mockReturnValue(
        of({
          data: iciciResponse(
            '{"ActCode":"96","success":false,"ActCodeDesc":"Insufficient balance"}',
          ),
        }),
      );

      const log = await service.disburse(DTO);

      expect(outcomeOf(log)).toBe('REJECTED');
      expect(log.errors).toBe('Insufficient balance');
    });

    it.each([
      ['ActCodeDesc', '{"ActCode":"1","ActCodeDesc":"A","MESSAGE":"B"}', 'A'],
      ['MESSAGE', '{"ActCode":"1","MESSAGE":"B","Response":"C"}', 'B'],
      ['Response', '{"ActCode":"1","Response":"C","description":"D"}', 'C'],
      ['description', '{"ActCode":"1","description":"D"}', 'D'],
    ])(
      'uses legacy error precedence, preferring %s',
      async (_label, body, expected) => {
        post.mockReturnValue(of({ data: iciciResponse(body) }));

        const log = await service.disburse(DTO);

        expect(log.errors).toBe(expected);
      },
    );

    it('UNKNOWN on transport failure — the outcome is genuinely unknown', async () => {
      post.mockReturnValue(throwError(() => new Error('socket hang up')));

      const log = await service.disburse(DTO);

      expect(outcomeOf(log)).toBe('UNKNOWN');
      expect(log.errors).toMatch(/outcome unknown/i);
    });

    it('UNKNOWN when the response cannot be decrypted', async () => {
      post.mockReturnValue(
        of({ data: '{"encryptedKey":"zz","encryptedData":"zz"}' }),
      );

      const log = await service.disburse(DTO);

      expect(outcomeOf(log)).toBe('UNKNOWN');
      expect(log.errors).toMatch(/could not decrypt/i);
    });

    it('UNKNOWN when the decrypted body is not JSON', async () => {
      post.mockReturnValue(of({ data: iciciResponse('not json at all') }));

      const log = await service.disburse(DTO);

      expect(outcomeOf(log)).toBe('UNKNOWN');
      expect(log.errors).toMatch(/not valid JSON/i);
    });
  });

  describe('request construction', () => {
    beforeEach(() => {
      post.mockReturnValue(
        of({
          data: iciciResponse('{"ActCode":"0","success":true,"BankRRN":"R1"}'),
        }),
      );
    });

    it('truncates the beneficiary name to 15 chars in paymentRef, as legacy does', async () => {
      const log = await service.disburse(DTO);

      // 'Priyadarshini Sharma Extra Long'.slice(0, 15) === 'Priyadarshini S'
      expect(log.paymentReferenceNo).toBe(
        'IMPS/ICICI/LN-001/Priyadarshini S/9000',
      );
    });

    it('trims a trailing space left by the 15-char cut', async () => {
      // 'Ramesh Kumar Ji'.slice(0, 15) would keep a trailing space for a name
      // whose 15th char is one — legacy's trim(substr(...)) drops it, and a
      // stray space inside a bank payment reference is worth not sending.
      const log = await service.disburse({
        ...DTO,
        beneficiaryName: 'Ramesh Kumarrr Singh',
      });

      expect(log.paymentReferenceNo).toBe(
        'IMPS/ICICI/LN-001/Ramesh Kumarrr/9000',
      );
    });

    it('sends tranRefNo as the envelope requestId, so a repeat is idempotent', async () => {
      await service.disburse(DTO);

      const [, body] = post.mock.calls[0];
      expect(JSON.parse(body).requestId).toBe(DTO.transactionReferenceNo);
    });

    it('sets the apikey and x-priority headers legacy used', async () => {
      await service.disburse(DTO);

      const [, , options] = post.mock.calls[0];
      expect(options.headers.apikey).toBe('secret-apikey');
      expect(options.headers['x-priority']).toBe('0100');
    });

    it('posts an encrypted envelope, never the plaintext payload', async () => {
      await service.disburse(DTO);

      const [, body] = post.mock.calls[0];
      expect(body).not.toContain('20279774002');
      expect(body).not.toContain('secret-passcode');
      expect(Object.keys(JSON.parse(body)).sort()).toEqual(
        [
          'clientInfo',
          'encryptedData',
          'encryptedKey',
          'iv',
          'oaepHashingAlgorithm',
          'optionalParam',
          'requestId',
          'service',
        ].sort(),
      );
    });

    it('redacts passCode and bcID from the persisted request log', async () => {
      // Those are standing credentials, not per-transaction values — logging
      // them would put them in the database in plaintext.
      const log = await service.disburse(DTO);

      expect(log.request).not.toContain('secret-passcode');
      expect(log.request).not.toContain('secret-bcid');
      expect(log.request).toContain('[redacted]');
      // The non-secret fields are still there for reconciliation.
      expect(log.request).toContain('20279774002');
    });
  });

  describe('NEFT', () => {
    it('is rejected without any API call, since legacy never built a payload for it', async () => {
      const log = await service.disburse({
        ...DTO,
        paymentType: LoanPaymentType.NEFT,
      });

      expect(outcomeOf(log)).toBe('REJECTED');
      expect(log.errors).toMatch(/Only IMPS is supported/);
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('checkStatus', () => {
    it('reports SUCCESS when the bank confirms with a BankRRN', async () => {
      post.mockReturnValue(
        of({
          data: iciciResponse('{"ActCode":"0","success":true,"BankRRN":"R9"}'),
        }),
      );

      const log = await service.checkStatus({
        leadId: 1,
        transactionReferenceNo: DTO.transactionReferenceNo,
      });

      expect(outcomeOf(log)).toBe('SUCCESS');
      expect(log.bankReferenceNo).toBe('R9');
    });

    it('reports UNKNOWN rather than REJECTED when the bank does not confirm', async () => {
      // A status query that does not confirm success is not proof of failure —
      // the transfer may still be settling.
      post.mockReturnValue(
        of({ data: iciciResponse('{"ActCode":"1","MESSAGE":"In process"}') }),
      );

      const log = await service.checkStatus({
        leadId: 1,
        transactionReferenceNo: DTO.transactionReferenceNo,
      });

      expect(outcomeOf(log)).toBe('UNKNOWN');
      expect(log.errors).toBe('In process');
    });
  });
});
