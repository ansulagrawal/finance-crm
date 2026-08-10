import {
  CreditAnalysisMemo,
  Lead,
  Loan,
  MasterStatus,
  State,
} from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FinancialExportsService } from './financial-exports.service';

describe('FinancialExportsService', () => {
  let service: FinancialExportsService;
  let loanRepository: { find: jest.Mock };
  let leadRepository: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let camRepository: { find: jest.Mock };
  let masterStatusRepository: { find: jest.Mock; findOne: jest.Mock };
  let stateRepository: { findOne: jest.Mock };

  beforeEach(async () => {
    loanRepository = { find: jest.fn() };
    leadRepository = { find: jest.fn(), createQueryBuilder: jest.fn() };
    camRepository = { find: jest.fn() };
    masterStatusRepository = { find: jest.fn(), findOne: jest.fn() };
    stateRepository = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FinancialExportsService,
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(CreditAnalysisMemo),
          useValue: camRepository,
        },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
        { provide: getRepositoryToken(State), useValue: stateRepository },
      ],
    }).compile();

    service = moduleRef.get(FinancialExportsService);
  });

  describe('acReport / tallyExport', () => {
    it('computes CGST+SGST for a home-state (Delhi) customer and IGST for others', async () => {
      masterStatusRepository.find.mockResolvedValue([{ id: 14 }, { id: 16 }]);
      stateRepository.findOne.mockResolvedValue({ id: 5, name: 'Delhi' });
      loanRepository.find.mockResolvedValue([
        {
          id: 1,
          loanNumber: 'LN-1',
          status: 'DISBURSED',
          disbursementReferenceNo: 'REF-1',
          lead: { id: 100, state: { id: 5 }, city: { name: 'New Delhi' } },
        },
        {
          id: 2,
          loanNumber: 'LN-2',
          status: 'DISBURSED',
          disbursementReferenceNo: 'REF-2',
          lead: { id: 101, state: { id: 9 }, city: { name: 'Mumbai' } },
        },
      ]);
      camRepository.find.mockResolvedValue([
        { lead: { id: 100 }, adminFee: 1000, roi: 24, tenureDays: 30 },
        { lead: { id: 101 }, adminFee: 1000, roi: 24, tenureDays: 30 },
      ]);

      const rows = await service.acReport({});

      const delhiRow = rows.find((r) => r.leadId === 100);
      const mumbaiRow = rows.find((r) => r.leadId === 101);

      expect(delhiRow?.cgst).toBeCloseTo(76.27, 1);
      expect(delhiRow?.sgst).toBeCloseTo(76.27, 1);
      expect(delhiRow?.igst).toBe(0);

      expect(mumbaiRow?.cgst).toBe(0);
      expect(mumbaiRow?.sgst).toBe(0);
      expect(mumbaiRow?.igst).toBeCloseTo(152.54, 1);
    });

    it('produces a Tally-shaped voucher row (date/ledger/debit/credit/narration) from the AC report data', async () => {
      masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
      stateRepository.findOne.mockResolvedValue({ id: 5, name: 'Delhi' });
      loanRepository.find.mockResolvedValue([
        {
          id: 1,
          loanNumber: 'LN-1',
          status: 'DISBURSED',
          disbursementReferenceNo: 'REF-1',
          lead: { id: 100, state: { id: 5 }, city: { name: 'New Delhi' } },
        },
      ]);
      camRepository.find.mockResolvedValue([
        { lead: { id: 100 }, adminFee: 1000, disbursalDate: '2026-01-15' },
      ]);

      const rows = await service.tallyExport({});

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        voucherDate: '2026-01-15',
        ledgerName: 'Loan LN-1',
        debitAmount: 1000,
        creditAmount: 0,
      });
      expect(rows[0].narration).toContain('LN-1');
    });
  });

  describe('reloanTatReport', () => {
    it('returns [] when no CLOSED master status exists (defensive, should not happen in a seeded DB)', async () => {
      masterStatusRepository.findOne.mockResolvedValue(null);
      const rows = await service.reloanTatReport();
      expect(rows).toEqual([]);
    });

    it('queries only non-blacklisted leads in the CLOSED status', async () => {
      masterStatusRepository.findOne.mockResolvedValue({
        id: 16,
        name: 'CLOSED',
      });
      leadRepository.find.mockResolvedValue([
        {
          id: 1,
          applicationNo: 'APP-1',
          firstName: 'Test',
          pancard: 'ABCDE1234F',
          mobile: '9999999999',
        },
      ]);

      const rows = await service.reloanTatReport();

      expect(leadRepository.find).toHaveBeenCalledWith({
        where: { leadStatus: { id: 16 }, isBlacklisted: false },
      });
      expect(rows).toEqual([
        {
          leadId: 1,
          applicationNo: 'APP-1',
          firstName: 'Test',
          pancard: 'ABCDE1234F',
          mobile: '9999999999',
        },
      ]);
    });
  });

  describe('conversionTatReport', () => {
    it('computes disbursement percentage per screener from raw grouped counts', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            screenerId: 1,
            screenerName: 'Alice',
            totalLeads: '10',
            disbursedCount: '4',
          },
        ]),
      };
      leadRepository.createQueryBuilder.mockReturnValue(qb);

      const rows = await service.conversionTatReport({});

      expect(rows).toEqual([
        {
          screenerId: 1,
          screenerName: 'Alice',
          totalLeads: 10,
          disbursedCount: 4,
          disbursementPercentage: 40,
        },
      ]);
    });

    it('returns a zero percentage rather than dividing by zero when a screener has no leads', async () => {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            screenerId: 2,
            screenerName: 'Bob',
            totalLeads: '0',
            disbursedCount: '0',
          },
        ]),
      };
      leadRepository.createQueryBuilder.mockReturnValue(qb);

      const rows = await service.conversionTatReport({});
      expect(rows[0].disbursementPercentage).toBe(0);
    });
  });

  describe('auditTatReport', () => {
    it('returns per-stage assignment timestamps for NEW closed-out leads', async () => {
      masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
      leadRepository.find.mockResolvedValue([
        {
          id: 1,
          applicationNo: 'APP-1',
          userType: 'NEW',
          creditAssignedTo: { name: 'Amit' },
          creditAssignedAt: new Date('2026-01-01'),
          auditAssignedTo: { name: 'Priya' },
          auditAssignedAt: new Date('2026-01-02'),
          disbursalAssignedTo: { name: 'Rahul' },
          disbursalAssignedAt: new Date('2026-01-03'),
          finalDisbursedAt: new Date('2026-01-04'),
        },
      ]);

      const rows = await service.auditTatReport({});

      expect(rows).toEqual([
        {
          leadId: 1,
          applicationNo: 'APP-1',
          userType: 'NEW',
          creditAssignedTo: 'Amit',
          creditAssignedAt: new Date('2026-01-01'),
          auditAssignedTo: 'Priya',
          auditAssignedAt: new Date('2026-01-02'),
          disbursalAssignedTo: 'Rahul',
          disbursalAssignedAt: new Date('2026-01-03'),
          finalDisbursedAt: new Date('2026-01-04'),
        },
      ]);
      expect(leadRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userType: 'NEW' }),
        }),
      );
    });

    it('returns an empty array when no closed-out NEW leads exist', async () => {
      masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
      leadRepository.find.mockResolvedValue([]);

      expect(await service.auditTatReport({})).toEqual([]);
    });
  });

  describe('dashboardData', () => {
    it('joins loans with in-range CAM repayment rows and returns dashboard detail', async () => {
      masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
      loanRepository.find.mockResolvedValue([
        {
          loanNumber: 'LN-1',
          totalReceived: 5000,
          principalOutstanding: 15000,
          totalOutstanding: 15000,
          lead: { id: 100, userType: 'NEW', branch: { name: 'Jaipur' } },
        },
      ]);
      camRepository.find.mockResolvedValue([
        {
          lead: { id: 100 },
          repaymentDate: '2026-01-15',
          recommendedLoanAmount: 20000,
          repaymentAmount: 22000,
          sanctionedBy: { name: 'Amit' },
          roi: 24,
          tenureDays: 30,
        },
      ]);

      const rows = await service.dashboardData({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      });

      expect(rows).toEqual([
        {
          leadId: 100,
          loanNumber: 'LN-1',
          recommendedAmount: 20000,
          repaymentAmount: 22000,
          totalReceived: 5000,
          principalOutstanding: 15000,
          totalOutstanding: 15000,
          userType: 'NEW',
          branchName: 'Jaipur',
          sanctionedBy: 'Amit',
          disbursalDate: null,
          repaymentDate: '2026-01-15',
          roi: 24,
          tenureDays: 30,
        },
      ]);
    });

    it('excludes loans whose CAM has no repaymentDate, and returns an empty array when none qualify', async () => {
      masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
      loanRepository.find.mockResolvedValue([
        { loanNumber: 'LN-2', lead: { id: 101, branch: null } },
      ]);
      camRepository.find.mockResolvedValue([
        { lead: { id: 101 }, repaymentDate: null },
      ]);

      expect(await service.dashboardData({})).toEqual([]);
    });
  });
});
