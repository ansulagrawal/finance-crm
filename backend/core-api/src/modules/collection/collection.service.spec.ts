import {
  BlacklistReason,
  Collection,
  CollectionVerificationStatus,
  CreditAnalysisMemo,
  CustomerBlacklist,
  EmailTemplate,
  FollowupStatus,
  FollowupType,
  Lead,
  LeadCustomer,
  LeadFollowup,
  Loan,
  LoanCollectionFollowup,
  LoanCollectionVisit,
  MasterStatus,
  PaymentMode,
  SmsTemplate,
  User,
} from '@finance-crm/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionService } from './collection.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

describe('CollectionService', () => {
  let service: CollectionService;
  let collectionRepository: ReturnType<typeof repo>;
  let paymentModeRepository: ReturnType<typeof repo>;
  let followupTypeRepository: ReturnType<typeof repo>;
  let followupStatusRepository: ReturnType<typeof repo>;
  let blacklistReasonRepository: ReturnType<typeof repo>;
  let followupRepository: ReturnType<typeof repo>;
  let visitRepository: ReturnType<typeof repo>;
  let customerBlacklistRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let userRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let creditAnalysisMemoRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;

  const CLOSURE_STATUSES = [
    { id: 16, name: 'CLOSED' },
    { id: 17, name: 'SETTLED' },
    { id: 18, name: 'WRITEOFF' },
  ];

  beforeEach(async () => {
    collectionRepository = repo();
    collectionRepository.createQueryBuilder = jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    }));
    paymentModeRepository = repo();
    followupTypeRepository = repo();
    followupStatusRepository = repo();
    blacklistReasonRepository = repo();
    followupRepository = repo();
    visitRepository = repo();
    customerBlacklistRepository = repo();
    leadRepository = repo();
    leadCustomerRepository = repo();
    userRepository = repo();
    leadFollowupRepository = repo();
    masterStatusRepository = repo();
    masterStatusRepository.find.mockResolvedValue(CLOSURE_STATUSES);
    creditAnalysisMemoRepository = repo();
    loanRepository = repo();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionService,
        {
          provide: getRepositoryToken(Collection),
          useValue: collectionRepository,
        },
        {
          provide: getRepositoryToken(PaymentMode),
          useValue: paymentModeRepository,
        },
        {
          provide: getRepositoryToken(FollowupType),
          useValue: followupTypeRepository,
        },
        {
          provide: getRepositoryToken(FollowupStatus),
          useValue: followupStatusRepository,
        },
        {
          provide: getRepositoryToken(BlacklistReason),
          useValue: blacklistReasonRepository,
        },
        {
          provide: getRepositoryToken(LoanCollectionFollowup),
          useValue: followupRepository,
        },
        {
          provide: getRepositoryToken(LoanCollectionVisit),
          useValue: visitRepository,
        },
        {
          provide: getRepositoryToken(CustomerBlacklist),
          useValue: customerBlacklistRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(LeadCustomer),
          useValue: leadCustomerRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(SmsTemplate), useValue: repo() },
        { provide: getRepositoryToken(EmailTemplate), useValue: repo() },
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: creditAnalysisMemoRepository,
        },
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(LeadFollowup),
          useValue: leadFollowupRepository,
        },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: unknown) => fallback },
        },
      ],
    }).compile();

    service = moduleRef.get(CollectionService);
  });

  describe('lookups', () => {
    it('listPaymentModes/listFollowupTypes/listFollowupStatuses/listBlacklistReasons all filter isActive', async () => {
      await service.listPaymentModes();
      expect(paymentModeRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });

      await service.listFollowupTypes();
      expect(followupTypeRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });

      await service.listFollowupStatuses();
      expect(followupStatusRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });

      await service.listBlacklistReasons();
      expect(blacklistReasonRepository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { id: 'ASC' },
      });
    });
  });

  describe('payments', () => {
    it('listPayments 404s when the lead does not exist', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);
      await expect(service.listPayments(99)).rejects.toThrow(NotFoundException);
    });

    it('createPayment resolves lead/executive/paymentMode/repaymentType FKs', async () => {
      const lead = { id: 1 };
      const executive = { id: 9 };
      const paymentMode = { id: 3 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue(executive);
      paymentModeRepository.findOneBy.mockResolvedValue(paymentMode);

      const result = await service.createPayment(
        1,
        {
          loanNumber: 'LN0000123',
          receivedAmount: 5000,
          paymentModeId: 3,
          repaymentTypeId: 1,
          referenceNo: 'TXN123456',
        },
        9,
      );

      expect(result.lead).toBe(lead);
      expect(result.collectionExecutive).toBe(executive);
      expect(result.paymentMode).toBe(paymentMode);
    });

    it('createPayment rejects a reference number already recorded on any lead', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      collectionRepository.findOne.mockResolvedValue({ id: 5 });

      await expect(
        service.createPayment(
          1,
          {
            loanNumber: 'LN0000123',
            receivedAmount: 5000,
            repaymentTypeId: 1,
            referenceNo: 'TXN123456',
          } as never,
          9,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('createPayment throws NotFoundException for an unknown payment mode', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      paymentModeRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createPayment(
          1,
          {
            loanNumber: 'LN0000123',
            receivedAmount: 100,
            paymentModeId: 404,
            repaymentTypeId: 1,
            referenceNo: 'TXN000404',
          },
          9,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('createPayment requires remarks for CO1/CO2/CR2/CAGY/CO4 roles', async () => {
      await expect(
        service.createPayment(
          1,
          {
            loanNumber: 'LN0000123',
            receivedAmount: 5000,
            repaymentTypeId: 1,
            referenceNo: 'TXN1',
          } as never,
          9,
          ['CO1'],
        ),
      ).rejects.toThrow(BadRequestException);
      expect(leadRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('createPayment does not require remarks for a role outside the SCM-remarks set', async () => {
      const lead = { id: 1 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });

      const result = await service.createPayment(
        1,
        {
          loanNumber: 'LN0000123',
          receivedAmount: 5000,
          repaymentTypeId: 1,
          referenceNo: 'TXN2',
        } as never,
        9,
        ['DS1'],
      );

      expect(result.lead).toBe(lead);
    });

    it('createPayment writes a LeadFollowup resolved from the repayment-type status', async () => {
      const lead = { id: 1 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      const executive = { id: 9 };
      userRepository.findOneBy.mockResolvedValue(executive);
      masterStatusRepository.findOneBy.mockResolvedValue({
        id: 14,
        name: 'DISBURSED',
      });

      await service.createPayment(
        1,
        {
          loanNumber: 'LN0000123',
          receivedAmount: 5000,
          repaymentTypeId: 14,
          referenceNo: 'TXN3',
          remarks: 'on-time payment',
        } as never,
        9,
        ['CO1'],
      );

      expect(leadFollowupRepository.save).toHaveBeenCalled();
      const [followupArg] = leadFollowupRepository.create.mock.calls[0];
      expect(followupArg.lead).toBe(lead);
      expect(followupArg.user).toBe(executive);
      expect(followupArg.remarks).toBe(
        'Update for DISBURSED | on-time payment',
      );
    });

    it('verifyPayment requires closure remarks for the AC1 role', async () => {
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          { verificationStatus: CollectionVerificationStatus.APPROVED },
          9,
          ['AC1'],
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('verifyPayment sets verification status, closure remarks, closedBy and closedAt', async () => {
      const payment = {
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        closureRemarks: null as string | null,
        repaymentTypeId: '99', // not CLOSED/SETTLED/WRITEOFF - no reconciliation gate
      };
      collectionRepository.findOne.mockResolvedValue(payment);
      const closer = { id: 9 };
      userRepository.findOneBy.mockResolvedValue(closer);
      leadRepository.findOneBy.mockResolvedValue({
        id: 1,
        isBlacklisted: false,
        leadStatus: { name: 'DISBURSED' },
        finalDisbursedAt: null,
        pancard: null,
      });

      const result = await service.verifyPayment(
        1,
        1,
        {
          verificationStatus: CollectionVerificationStatus.APPROVED,
          closureRemarks: 'matched bank statement',
        },
        9,
      );

      expect(result.verificationStatus).toBe(
        CollectionVerificationStatus.APPROVED,
      );
      expect(result.closureRemarks).toBe('matched bank statement');
      expect(result.closedBy).toBe(closer);
      expect(result.closedAt).toBeInstanceOf(Date);
    });

    it('verifyPayment 404s when the payment does not belong to the lead', async () => {
      collectionRepository.findOne.mockResolvedValue(null);
      await expect(
        service.verifyPayment(
          1,
          999,
          { verificationStatus: CollectionVerificationStatus.REJECTED },
          9,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('verifyPayment rejects re-verifying a payment that is already approved or rejected', async () => {
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.APPROVED,
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          { verificationStatus: CollectionVerificationStatus.APPROVED },
          9,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('verifyPayment refuses to let the user who recorded a payment approve it', async () => {
      // Segregation of duties: SA/CA satisfy both the create and verify
      // @Roles checks via RolesGuard's admin override, so without this one
      // admin could book a collection and sign it off themselves.
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        collectionExecutiveId: 9,
        repaymentTypeId: '99',
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          {
            verificationStatus: CollectionVerificationStatus.APPROVED,
            closureRemarks: 'self-approving',
          },
          9,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('verifyPayment allows a different user to approve a recorded payment', async () => {
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        collectionExecutiveId: 9,
        closureRemarks: null as string | null,
        repaymentTypeId: '99',
      });
      userRepository.findOneBy.mockResolvedValue({ id: 10 });
      leadRepository.findOneBy.mockResolvedValue({
        id: 1,
        isBlacklisted: false,
        leadStatus: { name: 'DISBURSED' },
        finalDisbursedAt: null,
        pancard: null,
      });

      const result = await service.verifyPayment(
        1,
        1,
        {
          verificationStatus: CollectionVerificationStatus.APPROVED,
          closureRemarks: 'matched bank statement',
        },
        10,
      );

      expect(result.verificationStatus).toBe(
        CollectionVerificationStatus.APPROVED,
      );
    });
  });

  describe('calculateRepaymentDetails', () => {
    it('returns loanRecommended/status/isBlacklisted only, everything else zero, when the loan is not currently DISBURSED', async () => {
      leadRepository.findOneBy.mockResolvedValue({
        id: 1,
        isBlacklisted: true,
        leadStatus: { name: 'CLOSED' },
        finalDisbursedAt: new Date('2026-01-01'),
      });
      creditAnalysisMemoRepository.findOne.mockResolvedValue({
        recommendedLoanAmount: 10000,
      });
      loanRepository.findOne.mockResolvedValue({
        loanNumber: 'LN1',
        status: 'CLOSED', // not DISBURSED
        totalDiscount: 500,
      });

      const result = await service.calculateRepaymentDetails(1);

      expect(result.loanRecommended).toBe(10000);
      expect(result.isBlacklisted).toBe(true);
      expect(result.status).toBe('CLOSED');
      expect(result.totalDueAmount).toBe(0);
      expect(result.totalRepaymentAmount).toBe(0);
      expect(result.penaltyInterest).toBe(0);
      // still persists the (zeroed) figures back onto the loan row
      expect(loanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalOutstanding: 0, totalPayable: 0 }),
      );
    });

    it('computes the full reconciliation for a disbursed loan with no payments yet, past the repayment date and penalty grace window', async () => {
      leadRepository.findOneBy.mockResolvedValue({
        id: 1,
        isBlacklisted: false,
        leadStatus: { name: 'DISBURSED' },
        finalDisbursedAt: new Date('2026-01-01'),
      });
      creditAnalysisMemoRepository.findOne.mockResolvedValue({
        recommendedLoanAmount: 10000,
        roi: 1,
        repaymentAmount: 13000,
        repaymentDate: new Date('2026-01-31'), // 30-day tenure, well past by "today"
        advanceInterestAmount: 0,
      });
      loanRepository.findOne.mockResolvedValue({
        loanNumber: 'LN1',
        status: 'DISBURSED',
        principalDiscount: 0,
        interestDiscount: 0,
        penaltyDiscount: 0,
        totalDiscount: 0,
      });
      // no verified settle/close/writeoff rows yet
      collectionRepository.findOne.mockResolvedValue(null);

      const result = await service.calculateRepaymentDetails(1);

      // hand-computed: tenure=30d, interest=round(10000*1*30/100)=3000,
      // repaymentAmount=13000 (10000 principal + 3000 interest);
      // "today" is far past repaymentDate + the 60-day grace window, so
      // penaltyDays freezes at the flat 60-day cap.
      expect(result.tenureDays).toBe(30);
      expect(result.realDays).toBe(30);
      expect(result.penaltyDays).toBe(60);
      expect(result.repaymentAmount).toBe(13000);
      expect(result.realInterest).toBe(3000);
      expect(result.repaymentWithRealInterest).toBe(13000);
      expect(result.totalInterestAmount).toBe(3000);
      expect(result.totalInterestAmountPending).toBe(3000);
      expect(result.totalPrincipleAmountPending).toBe(10000);
      // penalRoi=2, penaltyInterest = 10000*2*60/100 = 12000
      expect(result.penaltyInterest).toBe(12000);
      expect(result.totalRepaymentAmount).toBe(25000); // 13000+12000+0
      expect(result.totalReceivedAmount).toBe(0);
      expect(result.totalDueAmount).toBe(25000);
      expect(result.totalDiscountAmount).toBe(0);

      expect(loanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPayable: 25000,
          totalOutstanding: 25000,
          penaltyOutstanding: 12000,
        }),
      );
      expect(creditAnalysisMemoRepository.update).toHaveBeenCalledWith(
        { lead: { id: 1 } },
        expect.objectContaining({ tenureDays: 30, repaymentAmount: 13000 }),
      );
    });
  });

  describe('verifyPayment reconciliation (Full-Payment/Settle/Writeoff)', () => {
    let lead: {
      id: number;
      isBlacklisted: boolean;
      leadStatus: { name: string } | null;
      pancard: string | null;
    };
    let loan: { loanNumber: string; status: string };
    const closer = { id: 9 };

    function mockRepaymentDetails(overrides: Record<string, unknown> = {}) {
      return {
        loanNumber: 'LN1',
        leadId: 1,
        isBlacklisted: false,
        status: 'DISBURSED',
        disbursalDate: new Date('2026-01-01'),
        repaymentDate: new Date('2026-01-31'),
        roi: 1,
        penalRoi: 2,
        tenureDays: 30,
        realDays: 30,
        penaltyDays: 0,
        advanceInterestAmountDeducted: 0,
        repaymentAmount: 13000,
        realInterest: 3000,
        repaymentWithRealInterest: 13000,
        totalInterestAmount: 3000,
        interestDiscountAmount: 0,
        totalInterestAmountReceived: 0,
        totalInterestAmountPending: 0,
        loanRecommended: 10000,
        principleDiscountAmount: 0,
        totalPrincipleAmountReceived: 0,
        totalPrincipleAmountPending: 0,
        penaltyInterest: 0,
        penaltyDiscountAmount: 0,
        totalPenaltyInterestReceived: 0,
        totalPenaltyInterestPending: 0,
        totalRepaymentAmount: 13000,
        totalReceivedAmount: 0,
        totalDueAmount: 13000,
        totalDiscountAmount: 0,
        ...overrides,
      };
    }

    beforeEach(() => {
      lead = {
        id: 1,
        isBlacklisted: false,
        leadStatus: { name: 'DISBURSED' },
        pancard: null,
      };
      loan = { loanNumber: 'LN1', status: 'DISBURSED' };
      leadRepository.findOneBy.mockResolvedValue(lead);
      loanRepository.findOne.mockResolvedValue(loan);
      userRepository.findOneBy.mockResolvedValue(closer);
      masterStatusRepository.findOneBy.mockImplementation(
        async ({ id }: { id: number }) =>
          CLOSURE_STATUSES.find((s) => s.id === id) ?? null,
      );
    });

    it('approves a pre-due-date Full-Payment (CLOSED) when the amount exactly matches the total repayment', async () => {
      // repaymentDate is far in the future so "today" is pre-due-date
      const spy = jest
        .spyOn(service, 'calculateRepaymentDetails')
        .mockResolvedValue(
          mockRepaymentDetails({
            repaymentDate: new Date('2099-01-01'),
            totalRepaymentAmount: 13000,
          }) as never,
        );
      const payment = {
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '16', // CLOSED
        receivedAmount: 13000,
        discount: 0,
        refund: 0,
      };
      collectionRepository.findOne.mockResolvedValue(payment);

      const result = await service.verifyPayment(
        1,
        1,
        { verificationStatus: CollectionVerificationStatus.APPROVED },
        9,
      );

      expect(result.verificationStatus).toBe(
        CollectionVerificationStatus.APPROVED,
      );
      expect(lead.leadStatus).toEqual({ id: 16, name: 'CLOSED' });
      spy.mockRestore();
    });

    it('rejects a pre-due-date Full-Payment when the amount does not reconcile', async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2099-01-01'),
          totalRepaymentAmount: 13000,
        }) as never,
      );
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '16',
        receivedAmount: 5000, // way short
        discount: 0,
        refund: 0,
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          { verificationStatus: CollectionVerificationStatus.APPROVED },
          9,
        ),
      ).rejects.toThrow(/Loan closure amount/);
    });

    it("does not reject a post-due-date Full-Payment even when the amount is short, matching legacy's commented-out rejection", async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2020-01-01'), // long past
          totalRepaymentAmount: 20000,
          repaymentAmount: 13000,
        }) as never,
      );
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '16',
        receivedAmount: 5000, // doesn't reconcile against 20000, no rejection anyway
        discount: 0,
        refund: 0,
      });

      const result = await service.verifyPayment(
        1,
        1,
        { verificationStatus: CollectionVerificationStatus.APPROVED },
        9,
      );
      expect(result.verificationStatus).toBe(
        CollectionVerificationStatus.APPROVED,
      );
    });

    it('rejects a Settle (SETTLED) verification dated before the repayment date', async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2099-01-01'), // still in the future
        }) as never,
      );
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '17', // SETTLED
        receivedAmount: 13000,
        discount: 0,
        refund: 0,
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          { verificationStatus: CollectionVerificationStatus.APPROVED },
          9,
        ),
      ).rejects.toThrow(/cannot be settled/);
    });

    it('approves a Settle and splits the discount across principal/penalty when the amount reconciles', async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2020-01-01'), // past, settle allowed
          repaymentAmount: 13000,
          advanceInterestAmountDeducted: 0,
          totalRepaymentAmount: 15000, // includes some penalty
        }) as never,
      );
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '17',
        receivedAmount: 10000, // short of the 13000 principal+interest
        discount: 5000, // 10000+5000 = 15000 = totalRepaymentAmount
        refund: 0,
      });

      const result = await service.verifyPayment(
        1,
        1,
        { verificationStatus: CollectionVerificationStatus.APPROVED },
        9,
      );

      expect(result.verificationStatus).toBe(
        CollectionVerificationStatus.APPROVED,
      );
      // principalDiscount = 13000 - 10000 = 3000, penaltyDiscount = 5000-3000=2000
      expect(loanRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          principalDiscount: 3000,
          penaltyDiscount: 2000,
          totalDiscount: 5000,
        }),
      );
    });

    it('rejects a Settle when the amount does not reconcile', async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2020-01-01'),
          totalRepaymentAmount: 15000,
        }) as never,
      );
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '17',
        receivedAmount: 1000,
        discount: 0,
        refund: 0,
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          { verificationStatus: CollectionVerificationStatus.APPROVED },
          9,
        ),
      ).rejects.toThrow(/settled amount is incorrect/);
    });

    it('rejects a Writeoff verification dated before the repayment date, allows it on/after with no amount check', async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2099-01-01'),
        }) as never,
      );
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '18', // WRITEOFF
        receivedAmount: 0,
        discount: 0,
        refund: 0,
      });

      await expect(
        service.verifyPayment(
          1,
          1,
          { verificationStatus: CollectionVerificationStatus.APPROVED },
          9,
        ),
      ).rejects.toThrow(/cannot be settled/);
    });

    it('flips the most recent other UNPAID-REPEAT lead with the same PAN to REPEAT on approval', async () => {
      jest.spyOn(service, 'calculateRepaymentDetails').mockResolvedValue(
        mockRepaymentDetails({
          repaymentDate: new Date('2099-01-01'),
          totalRepaymentAmount: 13000,
        }) as never,
      );
      const pancardLead = { ...lead, pancard: 'ABCDE1234F' };
      leadRepository.findOneBy.mockResolvedValue(pancardLead);
      const repeatLead = {
        id: 2,
        pancard: 'ABCDE1234F',
        userType: 'UNPAID-REPEAT',
      };
      leadRepository.findOne.mockResolvedValue(repeatLead);
      collectionRepository.findOne.mockResolvedValue({
        id: 1,
        verificationStatus: CollectionVerificationStatus.PENDING,
        repaymentTypeId: '16',
        receivedAmount: 13000,
        discount: 0,
        refund: 0,
      });

      await service.verifyPayment(
        1,
        1,
        { verificationStatus: CollectionVerificationStatus.APPROVED },
        9,
      );

      expect(leadRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pancard: 'ABCDE1234F',
            userType: 'UNPAID-REPEAT',
          }),
        }),
      );
      expect(repeatLead.userType).toBe('REPEAT');
      expect(leadRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, userType: 'REPEAT' }),
      );
    });
  });

  describe('followups', () => {
    it('createFollowup resolves lead/user/type and optional status FKs', async () => {
      const lead = { id: 1 };
      const user = { id: 9 };
      const type = { id: 2 };
      const status = { id: 3 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue(user);
      followupTypeRepository.findOneBy.mockResolvedValue(type);
      followupStatusRepository.findOneBy.mockResolvedValue(status);

      const result = await service.createFollowup(
        1,
        { typeId: 2, statusId: 3, remarks: 'called' },
        9,
      );

      expect(result.lead).toBe(lead);
      expect(result.user).toBe(user);
      expect(result.type).toBe(type);
      expect(result.status).toBe(status);
    });

    it('createFollowup leaves status null when statusId is omitted', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      followupTypeRepository.findOneBy.mockResolvedValue({ id: 2 });

      const result = await service.createFollowup(1, { typeId: 2 }, 9);

      expect(result.status).toBeNull();
    });

    it('createFollowup 404s for an unknown followup type', async () => {
      leadRepository.findOneBy.mockResolvedValue({ id: 1 });
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      followupTypeRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.createFollowup(1, { typeId: 404 }, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // `LoanCollectionVisit` (`tbl_collection_followup`) has no addressType/
  // fieldStatus enums in the real legacy schema -- only free-text
  // visitAddress/rejectReason plus a completed-at timestamp.
  describe('visits', () => {
    it('createVisit resolves lead + requestedBy', async () => {
      const lead = { id: 1 };
      const requestedBy = { id: 9 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue(requestedBy);

      const result = await service.createVisit(
        1,
        { visitAddress: '123 Main St' },
        9,
      );

      expect(result.lead).toBe(lead);
      expect(result.requestedBy).toBe(requestedBy);
      expect(result.visitAddress).toBe('123 Main St');
    });

    it('assignVisit sets allocatedTo', async () => {
      const visit = { id: 1, allocatedTo: null as { id: number } | null };
      visitRepository.findOne.mockResolvedValue(visit);
      const allocatedTo = { id: 9 };
      userRepository.findOneBy.mockResolvedValue(allocatedTo);

      const result = await service.assignVisit(1, 1, {
        allocatedToUserId: 9,
      });

      expect(result.allocatedTo).toBe(allocatedTo);
    });

    it('assignVisit 404s when the visit does not belong to the lead', async () => {
      visitRepository.findOne.mockResolvedValue(null);
      await expect(
        service.assignVisit(1, 999, { allocatedToUserId: 9 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateVisitStatus stamps completedAt only when completed=true', async () => {
      const visit = {
        id: 1,
        completedAt: null as Date | null,
      };
      visitRepository.findOne.mockResolvedValue(visit);

      const result = await service.updateVisitStatus(1, 1, {
        completed: true,
        remarks: 'done',
      });

      expect(result.remarks).toBe('done');
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('updateVisitStatus does not stamp completedAt when completed is omitted', async () => {
      const visit = {
        id: 1,
        completedAt: null as Date | null,
      };
      visitRepository.findOne.mockResolvedValue(visit);

      const result = await service.updateVisitStatus(1, 1, {
        rejectReason: 'customer unavailable',
      });

      expect(result.rejectReason).toBe('customer unavailable');
      expect(result.completedAt).toBeNull();
    });
  });

  describe('customer blacklist', () => {
    it('blacklistLead creates the blacklist entry, snapshots identity fields, and flips lead.isBlacklisted', async () => {
      const lead = {
        id: 1,
        isBlacklisted: false,
        pancard: 'ABCDE1234F',
        mobile: '9876543210',
        email: 'a@b.com',
      };
      const createdBy = { id: 9 };
      const reason = { id: 2 };
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue(createdBy);
      blacklistReasonRepository.findOneBy.mockResolvedValue(reason);
      leadCustomerRepository.findOne.mockResolvedValue({
        firstName: 'Ramesh',
        dob: '1990-01-01',
        alternateMobile: '9999999999',
        alternateEmail: null,
      });

      const result = await service.blacklistLead(
        1,
        { reasonId: 2, remarks: 'chronic defaulter' },
        9,
      );

      expect(result.lead).toBe(lead);
      expect(result.reason).toBe(reason);
      expect(result.pancard).toBe('ABCDE1234F');
      expect(result.mobile).toBe('9876543210');
      expect(result.firstName).toBe('Ramesh');
      expect(result.alternateMobile).toBe('9999999999');
      expect(lead.isBlacklisted).toBe(true);
      expect(leadRepository.save).toHaveBeenCalledWith(lead);
    });

    it('blacklistLead works without a reasonId', async () => {
      const lead = { id: 1, isBlacklisted: false };
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });

      const result = await service.blacklistLead(1, {}, 9);

      expect(result.reason).toBeNull();
      expect(lead.isBlacklisted).toBe(true);
    });

    it('blacklistLead writes a LeadFollowup entry noting the blacklist action', async () => {
      const lead = { id: 1, isBlacklisted: false, leadStatus: { id: 5 } };
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);
      userRepository.findOneBy.mockResolvedValue({ id: 9 });
      blacklistReasonRepository.findOneBy.mockResolvedValue({
        id: 2,
        name: 'Chronic default',
      });

      await service.blacklistLead(
        1,
        { reasonId: 2, remarks: 'repeated non-payment' },
        9,
      );

      expect(leadFollowupRepository.save).toHaveBeenCalled();
      const [followupArg] = leadFollowupRepository.create.mock.calls[0];
      expect(followupArg.status).toBe(lead.leadStatus);
      expect(followupArg.remarks).toContain('black listed');
      expect(followupArg.remarks).toContain('Chronic default');
      expect(followupArg.remarks).toContain('repeated non-payment');
    });

    it('blacklistLead rejects a lead that is already blacklisted', async () => {
      const lead = { id: 1, isBlacklisted: true };
      leadRepository.findOneBy.mockResolvedValue(lead);
      leadRepository.findOne.mockResolvedValue(lead);

      await expect(service.blacklistLead(1, {}, 9)).rejects.toThrow(
        ConflictException,
      );
      expect(customerBlacklistRepository.create).not.toHaveBeenCalled();
    });

    it('listBlacklistEntries 404s when the lead does not exist', async () => {
      leadRepository.findOneBy.mockResolvedValue(null);
      await expect(service.listBlacklistEntries(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
