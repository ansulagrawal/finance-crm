import { IntegrationsApiClient } from '@finance-crm/common';
import {
  CreditAnalysisMemo,
  CustomerBanking,
  DisbursalAuthorisedUser,
  DisbursementBank,
  DisbursementTransactionLog,
  DisbursementTransactionStatus,
  Lead,
  Loan,
  LoanPaymentMode,
  LoanPaymentType,
  User,
} from '@finance-crm/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisbursalService } from './disbursal.service';

// `Loan.status` is a free-string legacy lifecycle label, not a LoanStatus
// enum (there is no such enum in @finance-crm/database) -- mirrors DisbursalService's
// own private LOAN_STATUS constant.
const LOAN_STATUS = {
  PENDING: 'DISBURSE-PENDING',
  DISBURSED: 'DISBURSED',
  SETTLED: 'SETTLED',
  CLOSED: 'CLOSED',
  WRITTEN_OFF: 'WRITEOFF',
} as const;

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('DisbursalService', () => {
  let service: DisbursalService;
  let loanRepository: ReturnType<typeof repo>;
  let bankRepository: ReturnType<typeof repo>;
  let transactionLogRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let customerBankingRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let authorisedUserRepository: ReturnType<typeof repo> & { exists: jest.Mock };
  let userRepository: ReturnType<typeof repo>;
  let integrationsPost: jest.Mock;

  beforeEach(async () => {
    loanRepository = repo();
    bankRepository = repo();
    transactionLogRepository = repo();
    leadRepository = repo();
    customerBankingRepository = repo();
    camRepository = repo();
    // Default: the acting user IS on the disbursal whitelist, so the ONLINE
    // cases below exercise the money path itself. The whitelist's own
    // deny/fail-closed behaviour is tested separately.
    authorisedUserRepository = repo({
      exists: jest.fn().mockResolvedValue(true),
    }) as ReturnType<typeof repo> & { exists: jest.Mock };
    userRepository = repo();
    integrationsPost = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DisbursalService,
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(DisbursementBank),
          useValue: bankRepository,
        },
        {
          provide: getRepositoryToken(DisbursementTransactionLog),
          useValue: transactionLogRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(CustomerBanking),
          useValue: customerBankingRepository,
        },
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: camRepository,
        },
        {
          provide: getRepositoryToken(DisbursalAuthorisedUser),
          useValue: authorisedUserRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: IntegrationsApiClient,
          useValue: { post: integrationsPost },
        },
      ],
    }).compile();

    service = moduleRef.get(DisbursalService);
  });

  describe('banks', () => {
    it('listBanks returns all banks ordered by id', async () => {
      const rows = [{ id: 1 }];
      bankRepository.find.mockResolvedValue(rows);
      await expect(service.listBanks()).resolves.toBe(rows);
    });

    it('findBankById 404s for an unknown id', async () => {
      bankRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findBankById(404)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createBank defaults imps/neft flags to false when omitted', async () => {
      const result = await service.createBank({ accountNumber: '12345' }, 9);
      expect(result.isImpsEnabled).toBe(false);
      expect(result.isNeftEnabled).toBe(false);
      expect(result.createdById).toBe(9);
    });

    it('updateBank only overwrites supplied fields', async () => {
      const bank = {
        id: 1,
        accountNumber: '111',
        isImpsEnabled: false,
        isNeftEnabled: true,
      };
      bankRepository.findOneBy.mockResolvedValue(bank);

      await service.updateBank(1, { isImpsEnabled: true }, 9);

      expect(bank.isImpsEnabled).toBe(true);
      expect(bank.isNeftEnabled).toBe(true);
      expect(bank.accountNumber).toBe('111');
    });

    it('removeBank soft-deletes the bank', async () => {
      const bank = { id: 1, isActive: true, isDeleted: false };
      bankRepository.findOneBy.mockResolvedValue(bank);
      await service.removeBank(1);
      expect(bank.isActive).toBe(false);
      expect(bank.isDeleted).toBe(true);
    });
  });

  describe('createLoan', () => {
    it('creates a PENDING loan for a lead with no existing loan', async () => {
      const lead = { id: 1 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      loanRepository.findOne.mockResolvedValue(null);

      const result = await service.createLoan(1, { loanNumber: 'LN-001' });

      expect(result.status).toBe(LOAN_STATUS.PENDING);
      expect(result.lead).toBe(lead);
    });

    it('throws ConflictException when the lead already has a loan', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      loanRepository.findOne.mockResolvedValue({ id: 5 });

      await expect(
        service.createLoan(1, { loanNumber: 'LN-002' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for an unknown lead', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.createLoan(404, { loanNumber: 'LN-003' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('disburse', () => {
    // OFFLINE: a human already moved the money and supplies the reference.
    // These two cases predate the ICICI port and were only ever exercising
    // that bookkeeping path, so they now say so explicitly rather than
    // relying on ONLINE having been a no-op.
    const disburseDto = {
      disbursementBankId: 7,
      paymentMode: LoanPaymentMode.OFFLINE,
      paymentType: LoanPaymentType.NEFT,
      disbursementReferenceNo: 'REF-1',
    };

    it('disburses a PENDING loan and logs a COMPLETE transaction', async () => {
      const loan = {
        id: 1,
        lead: { id: 1 },
        loanNumber: 'LN-001',
        status: LOAN_STATUS.PENDING,
      };
      const bank = { id: 7 };
      loanRepository.findOne.mockResolvedValue(loan);
      bankRepository.findOneBy.mockResolvedValue(bank);

      const result = await service.disburse(1, disburseDto);

      expect(result.status).toBe(LOAN_STATUS.DISBURSED);
      expect(result.disbursementBank).toBe(bank);
      expect(transactionLogRepository.save).toHaveBeenCalled();
      const [logArg] = transactionLogRepository.create.mock.calls[0];
      expect(logArg.status).toBe(DisbursementTransactionStatus.COMPLETE);
      expect(logArg.referenceNo).toBe('REF-1');
    });

    it('falls back to the loan number as the transaction reference when none supplied', async () => {
      const loan = {
        id: 1,
        lead: { id: 1 },
        loanNumber: 'LN-001',
        status: LOAN_STATUS.PENDING,
      };
      loanRepository.findOne.mockResolvedValue(loan);
      bankRepository.findOneBy.mockResolvedValue({ id: 7 });

      await service.disburse(1, {
        ...disburseDto,
        disbursementReferenceNo: undefined,
      });

      const [logArg] = transactionLogRepository.create.mock.calls[0];
      expect(logArg.referenceNo).toBe('LN-001');
    });

    describe('ONLINE — the real ICICI money path', () => {
      const onlineDto = {
        disbursementBankId: 7,
        paymentMode: LoanPaymentMode.ONLINE,
        paymentType: LoanPaymentType.IMPS,
      };

      function readyToDisburse() {
        loanRepository.findOne.mockResolvedValue({
          id: 1,
          lead: { id: 1, firstName: 'Priya' },
          loanNumber: 'LN-001',
          status: LOAN_STATUS.PENDING,
        });
        bankRepository.findOneBy.mockResolvedValue({ id: 7 });
        customerBankingRepository.findOne.mockResolvedValue({
          accountNumber: '20279774002',
          ifscCode: 'SBIN0016732',
          beneficiaryName: 'Priya Sharma',
        });
        camRepository.findOne.mockResolvedValue({
          recommendedLoanAmount: 10000,
          netDisbursalAmount: 9000,
        });
      }

      it('marks the loan DISBURSED with the bank reference on SUCCESS', async () => {
        readyToDisburse();
        integrationsPost.mockResolvedValue({
          outcome: 'SUCCESS',
          bankReferenceNo: '200701023783',
        });
        // The service mutates one transaction object in place, and the repo
        // mocks return it by reference — so `mock.calls` would show only its
        // final state. Snapshot the status at each save to see the real
        // sequence: INITIATED before the vendor call (so a crash mid-call
        // still leaves a blocking record), COMPLETE after.
        const savedStatuses: number[] = [];
        transactionLogRepository.save.mockImplementation(
          async (row: { status: number }) => {
            savedStatuses.push(row.status);
            return row;
          },
        );

        const result = await service.disburse(1, onlineDto, 42);

        expect(result.status).toBe(LOAN_STATUS.DISBURSED);
        expect(result.disbursementReferenceNo).toBe('200701023783');
        expect(savedStatuses).toEqual([
          DisbursementTransactionStatus.INITIATED,
          DisbursementTransactionStatus.COMPLETE,
        ]);
      });

      it('sends a unique SLPRD transaction reference as the idempotency key', async () => {
        readyToDisburse();
        integrationsPost.mockResolvedValue({
          outcome: 'SUCCESS',
          bankReferenceNo: 'RRN',
        });

        await service.disburse(1, onlineDto, 42);

        const [path, body] = integrationsPost.mock.calls[0];
        expect(path).toBe('/icici-disbursement/disburse');
        expect(body.transactionReferenceNo).toMatch(/^SLPRD\d{14}\d{3}$/);
        expect(body.amount).toBe(9000); // net disbursal, not sanctioned
      });

      it('leaves the transaction FAILED and the loan untouched on REJECTED', async () => {
        readyToDisburse();
        integrationsPost.mockResolvedValue({
          outcome: 'REJECTED',
          errors: 'Insufficient balance',
        });

        await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
          BadRequestException,
        );
        expect(
          transactionLogRepository.save.mock.calls.at(-1)?.[0].status,
        ).toBe(DisbursementTransactionStatus.FAILED);
        expect(loanRepository.save).not.toHaveBeenCalled();
      });

      it('leaves the transaction PENDING on UNKNOWN, so no retry is possible', async () => {
        // The dangerous case: the money may or may not have moved. PENDING is
        // what the in-flight guard blocks on.
        readyToDisburse();
        integrationsPost.mockResolvedValue({
          outcome: 'UNKNOWN',
          errors: 'BankRRN is not available in IMPS response',
        });

        await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
          ServiceUnavailableException,
        );
        expect(
          transactionLogRepository.save.mock.calls.at(-1)?.[0].status,
        ).toBe(DisbursementTransactionStatus.PENDING);
        expect(loanRepository.save).not.toHaveBeenCalled();
      });

      it('leaves the transaction PENDING when the vendor call itself throws', async () => {
        readyToDisburse();
        integrationsPost.mockRejectedValue(new Error('socket hang up'));

        await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
          ServiceUnavailableException,
        );
        expect(
          transactionLogRepository.save.mock.calls.at(-1)?.[0].status,
        ).toBe(DisbursementTransactionStatus.PENDING);
        expect(loanRepository.save).not.toHaveBeenCalled();
      });

      it.each([
        DisbursementTransactionStatus.INITIATED,
        DisbursementTransactionStatus.PENDING,
        DisbursementTransactionStatus.HOLD,
      ])(
        'refuses to send a second payment while a prior one is %s',
        async (status) => {
          readyToDisburse();
          transactionLogRepository.findOne.mockResolvedValue({
            id: 5,
            referenceNo: 'SLPRD20260807010203123',
            status,
          });

          await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
            ConflictException,
          );
          expect(integrationsPost).not.toHaveBeenCalled();
        },
      );

      it('refuses when a prior transaction already COMPLETED', async () => {
        readyToDisburse();
        transactionLogRepository.findOne.mockResolvedValue({
          id: 5,
          status: DisbursementTransactionStatus.COMPLETE,
        });

        await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
          /already done/i,
        );
        expect(integrationsPost).not.toHaveBeenCalled();
      });

      it('allows a fresh attempt after a FAILED transaction', async () => {
        readyToDisburse();
        transactionLogRepository.findOne.mockResolvedValue({
          id: 5,
          status: DisbursementTransactionStatus.FAILED,
        });
        integrationsPost.mockResolvedValue({
          outcome: 'SUCCESS',
          bankReferenceNo: 'RRN2',
        });

        const result = await service.disburse(1, onlineDto, 42);

        expect(result.status).toBe(LOAN_STATUS.DISBURSED);
        expect(integrationsPost).toHaveBeenCalledTimes(1);
      });

      it('refuses when the loan already carries a bank reference', async () => {
        readyToDisburse();
        loanRepository.findOne.mockResolvedValue({
          id: 1,
          lead: { id: 1 },
          loanNumber: 'LN-001',
          status: LOAN_STATUS.PENDING,
          disbursementReferenceNo: 'ALREADY-PAID',
        });

        await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
          ConflictException,
        );
        expect(integrationsPost).not.toHaveBeenCalled();
      });

      it.each([
        [6999, /lesser than/],
        [100001, /greater than/],
      ])(
        'enforces the legacy rupee bounds: %s is rejected',
        async (amount, message) => {
          readyToDisburse();
          camRepository.findOne.mockResolvedValue({
            recommendedLoanAmount: amount,
            netDisbursalAmount: 9000,
          });

          await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
            message,
          );
          expect(integrationsPost).not.toHaveBeenCalled();
        },
      );

      it('refuses without verified customer banking details', async () => {
        readyToDisburse();
        customerBankingRepository.findOne.mockResolvedValue(null);

        await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
          /verify the customer banking details/i,
        );
        expect(integrationsPost).not.toHaveBeenCalled();
      });
    });

    it.each([
      LOAN_STATUS.DISBURSED,
      LOAN_STATUS.SETTLED,
      LOAN_STATUS.CLOSED,
      LOAN_STATUS.WRITTEN_OFF,
    ])(
      'rejects disbursing a loan that is already %s (bug fix: prevents double-disbursement)',
      async (status) => {
        loanRepository.findOne.mockResolvedValue({
          id: 1,
          lead: { id: 1 },
          loanNumber: 'LN-001',
          status,
        });

        await expect(service.disburse(1, disburseDto)).rejects.toThrow(
          ConflictException,
        );
        expect(loanRepository.save).not.toHaveBeenCalled();
        expect(transactionLogRepository.save).not.toHaveBeenCalled();
      },
    );

    it('throws NotFoundException when the lead has no loan', async () => {
      loanRepository.findOne.mockResolvedValue(null);
      await expect(service.disburse(1, disburseDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an unknown disbursement bank', async () => {
      loanRepository.findOne.mockResolvedValue({
        id: 1,
        lead: { id: 1 },
        loanNumber: 'LN-001',
        status: LOAN_STATUS.PENDING,
      });
      bankRepository.findOneBy.mockResolvedValue(null);

      await expect(service.disburse(1, disburseDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('lifecycle transitions', () => {
    it('settle marks the loan SETTLED and stamps settledAt', async () => {
      loanRepository.findOne.mockResolvedValue({
        id: 1,
        status: LOAN_STATUS.DISBURSED,
      });
      const result = await service.settle(1);
      expect(result.status).toBe(LOAN_STATUS.SETTLED);
      expect(result.settledAt).toBeInstanceOf(Date);
    });

    it('close marks the loan CLOSED and stamps closedAt', async () => {
      loanRepository.findOne.mockResolvedValue({
        id: 1,
        status: LOAN_STATUS.SETTLED,
      });
      const result = await service.close(1);
      expect(result.status).toBe(LOAN_STATUS.CLOSED);
      expect(result.closedAt).toBeInstanceOf(Date);
    });

    it('writeOff marks the loan WRITTEN_OFF and stamps writtenOffAt', async () => {
      loanRepository.findOne.mockResolvedValue({
        id: 1,
        status: LOAN_STATUS.DISBURSED,
      });
      const result = await service.writeOff(1);
      expect(result.status).toBe(LOAN_STATUS.WRITTEN_OFF);
      expect(result.writtenOffAt).toBeInstanceOf(Date);
    });
  });

  // `DisbursementTransactionLog` has no relation back to `Loan` (`Loan` FKs
  // to it, not the reverse) -- createTransaction resolves lead + bank only.
  describe('transaction logs', () => {
    it('listTransactions 404s when the lead does not exist', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);
      await expect(service.listTransactions(99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createTransaction records a log entry tied to the lead and its bank', async () => {
      const lead = { id: 1 };
      const bank = { id: 7 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      bankRepository.findOneBy.mockResolvedValue(bank);

      const result = await service.createTransaction(1, {
        disbursementBankId: 7,
        referenceNo: 'REF-9',
        status: DisbursementTransactionStatus.FAILED,
      });

      expect(result.lead).toBe(lead);
      expect(result.bank).toBe(bank);
      expect(result.status).toBe(DisbursementTransactionStatus.FAILED);
    });

    it('createTransaction throws NotFoundException for an unknown bank', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      bankRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createTransaction(1, {
          disbursementBankId: 404,
          referenceNo: 'REF-9',
          status: DisbursementTransactionStatus.INITIATED,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // The named-individual whitelist legacy hardcoded as
  // `in_array($user_id, array(37, 31, 69, 83, 115))`. What matters here is
  // that a denial happens BEFORE anything is written or sent -- an unlisted
  // user must not be able to leave a blocking transaction row behind, let
  // alone reach ICICI.
  describe('disbursal authorisation whitelist', () => {
    const onlineDto = {
      disbursementBankId: 7,
      paymentMode: LoanPaymentMode.ONLINE,
      paymentType: LoanPaymentType.IMPS,
    };

    beforeEach(() => {
      loanRepository.findOne.mockResolvedValue({
        id: 1,
        lead: { id: 1, firstName: 'Priya' },
        loanNumber: 'LN-001',
        status: LOAN_STATUS.PENDING,
      });
      bankRepository.findOneBy.mockResolvedValue({ id: 7 });
    });

    it('rejects an ONLINE disbursal by a user not on the list', async () => {
      authorisedUserRepository.exists.mockResolvedValue(false);

      await expect(service.disburse(1, onlineDto, 42)).rejects.toThrow(
        ForbiddenException,
      );
      expect(transactionLogRepository.save).not.toHaveBeenCalled();
      expect(integrationsPost).not.toHaveBeenCalled();
    });

    it('fails closed when there is no acting user at all', async () => {
      authorisedUserRepository.exists.mockResolvedValue(true);

      await expect(service.disburse(1, onlineDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(authorisedUserRepository.exists).not.toHaveBeenCalled();
      expect(integrationsPost).not.toHaveBeenCalled();
    });

    it('does not gate OFFLINE bookkeeping on the list', async () => {
      authorisedUserRepository.exists.mockResolvedValue(false);

      const result = await service.disburse(1, {
        ...onlineDto,
        paymentMode: LoanPaymentMode.OFFLINE,
        disbursementReferenceNo: 'REF-1',
      });

      expect(result.status).toBe(LOAN_STATUS.DISBURSED);
    });

    it('grant reactivates an existing revoked row instead of duplicating it', async () => {
      userRepository.findOneBy.mockResolvedValue({ id: 42 });
      const existing = { id: 5, userId: 42, isActive: false, isDeleted: false };
      authorisedUserRepository.findOne.mockResolvedValue(existing);

      const result = await service.grantDisbursalAuthorisation(42, 9);

      expect(authorisedUserRepository.create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
      expect(result.isActive).toBe(true);
      expect(result.grantedById).toBe(9);
    });

    it('grant 404s for a user id that does not exist', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.grantDisbursalAuthorisation(404, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('revoke deactivates rather than deletes, keeping the grant history', async () => {
      const row = { id: 5, userId: 42, isActive: true, grantedById: 9 };
      authorisedUserRepository.findOne.mockResolvedValue(row);

      await service.revokeDisbursalAuthorisation(42);

      expect(row.isActive).toBe(false);
      expect(row.grantedById).toBe(9);
      expect(authorisedUserRepository.save).toHaveBeenCalledWith(row);
    });
  });
});
