import { Lead, MasterStatus } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisbursalReportsService } from './disbursal-reports.service';

const CHAIN_METHODS = [
  'innerJoin',
  'leftJoin',
  'select',
  'addSelect',
  'where',
  'andWhere',
  'groupBy',
  'orderBy',
] as const;

function queryBuilder(rawMany: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {
    getRawMany: jest.fn().mockResolvedValue(rawMany),
  };
  for (const method of CHAIN_METHODS) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  return qb;
}

describe('DisbursalReportsService', () => {
  let service: DisbursalReportsService;
  let leadRepository: { createQueryBuilder: jest.Mock };
  let masterStatusRepository: { find: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    qb = queryBuilder();
    leadRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    masterStatusRepository = {
      find: jest.fn().mockResolvedValue([{ id: 14 }, { id: 19 }]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DisbursalReportsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(DisbursalReportsService);
  });

  describe('disbursalSummary', () => {
    it('joins CAM within the calendar-month window and a DISBURSED loan', async () => {
      const rows = [{ disbursalDate: '2026-07-01', count: '3' }];
      qb.getRawMany.mockResolvedValue(rows);

      const result = await service.disbursalSummary({ month: '2026-07-15' });

      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [
          { name: 'DISBURSED' },
          { name: 'CLOSED' },
          { name: 'SETTLED' },
          { name: 'WRITEOFF' },
          { name: 'PART-PAYMENT' },
        ],
      });
      const [, , camCondition, camParams] = qb.innerJoin.mock.calls[1];
      expect(camCondition).toContain(
        'cam.disbursalDate BETWEEN :start AND :end',
      );
      expect(camParams.start).toEqual(new Date(2026, 6, 1));
      expect(camParams.end).toEqual(new Date(2026, 6, 31, 23, 59, 59));
      expect(result).toBe(rows);
    });
  });

  describe('monthlyDisbursal', () => {
    it('returns row-level detail for the target month', async () => {
      await service.monthlyDisbursal({ month: '2026-02-15' });

      const [, , camCondition, camParams] = qb.innerJoin.mock.calls[1];
      expect(camCondition).toContain('BETWEEN :start AND :end');
      expect(camParams.start).toEqual(new Date(2026, 1, 1));
      expect(camParams.end).toEqual(new Date(2026, 1, 28, 23, 59, 59));
    });
  });

  describe('hourlyDisbursal', () => {
    it('buckets disbursals into two-hour bands, split NEW vs. repeat', async () => {
      qb.getRawMany.mockResolvedValue([
        {
          finalDisbursedAt: new Date(2026, 6, 1, 9, 0),
          userType: 'NEW',
          loanRecommended: '10000',
        },
        {
          finalDisbursedAt: new Date(2026, 6, 1, 9, 30),
          userType: 'REPEAT',
          loanRecommended: '5000',
        },
        {
          finalDisbursedAt: new Date(2026, 6, 1, 15, 0),
          userType: 'NEW',
          loanRecommended: '20000',
        },
      ]);

      const buckets = await service.hourlyDisbursal({});

      const earlyBand = buckets.find((b) => b.band === '12:01 AM-10:00 AM');
      expect(earlyBand?.counts).toBe(2);
      expect(earlyBand?.loanRecommended).toBe(15000);
      expect(earlyBand?.new).toEqual({ counts: 1, loanRecommended: 10000 });
      expect(earlyBand?.repeat).toEqual({ counts: 1, loanRecommended: 5000 });

      const afternoonBand = buckets.find((b) => b.band === '02:01 PM-04:00 PM');
      expect(afternoonBand?.counts).toBe(1);
      expect(afternoonBand?.loanRecommended).toBe(20000);

      // every one of the 8 fixed bands is always present, even when empty
      expect(buckets).toHaveLength(8);
      const emptyBand = buckets.find((b) => b.band === '10:01 PM-12:00 AM');
      expect(emptyBand?.counts).toBe(0);
    });

    it('uses a no-op 1=1 filter (not skipping the andWhere call) when no date range is given', async () => {
      await service.hourlyDisbursal({});

      expect(qb.andWhere).toHaveBeenCalledWith('1=1', {});
    });

    it('applies real date filters when given', async () => {
      await service.hourlyDisbursal({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt >= :fromDate',
        { fromDate: '2026-07-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt <= :toDate',
        { toDate: '2026-07-31' },
      );
    });
  });

  describe('fyDisbursementCollection', () => {
    it('spans a 12-month financial-year window from the given start month', async () => {
      await service.fyDisbursementCollection({ month: '2026-04-10' });

      const [, , camCondition, camParams] = qb.innerJoin.mock.calls[1];
      expect(camCondition).toContain('BETWEEN :start AND :end');
      expect(camParams.start.getDate()).toBe(1);
      // end is the last day of the month before (start + 12 months) -- a
      // 12-month FY window.
      const expectedEndMonth = (camParams.start.getMonth() + 11) % 12;
      expect(camParams.end.getMonth()).toBe(expectedEndMonth);
      expect(camParams.end.getFullYear()).toBe(
        camParams.start.getFullYear() +
          (expectedEndMonth < camParams.start.getMonth() ? 1 : 0),
      );
    });
  });

  describe('hourlyLoanDisbursalByExecutive', () => {
    it('buckets by band + executive, grouping unassigned leads separately', async () => {
      qb.getRawMany.mockResolvedValue([
        {
          finalDisbursedAt: new Date(2026, 6, 1, 9, 0),
          executiveId: 5,
          executiveName: 'Priya',
          loanRecommended: '10000',
        },
        {
          finalDisbursedAt: new Date(2026, 6, 1, 9, 30),
          executiveId: 5,
          executiveName: 'Priya',
          loanRecommended: '5000',
        },
        {
          finalDisbursedAt: new Date(2026, 6, 1, 9, 45),
          executiveId: null,
          executiveName: null,
          loanRecommended: '2000',
        },
      ]);

      const buckets = await service.hourlyLoanDisbursalByExecutive({});

      const priyaBucket = buckets.find((b) => b.executiveId === 5);
      expect(priyaBucket).toMatchObject({
        band: '12:01 AM-10:00 AM',
        counts: 2,
        loanRecommended: 15000,
      });
      const unassignedBucket = buckets.find((b) => b.executiveId === null);
      expect(unassignedBucket).toMatchObject({
        counts: 1,
        loanRecommended: 2000,
      });
    });
  });

  describe('disbursalDateWise', () => {
    it('scopes to DISBURSED/PART-PAYMENT only (a narrower set than the other reports)', async () => {
      await service.disbursalDateWise({});

      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [{ name: 'DISBURSED' }, { name: 'PART-PAYMENT' }],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt IS NOT NULL',
      );
    });

    it('applies date filters only when supplied', async () => {
      await service.disbursalDateWise({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt >= :fromDate',
        { fromDate: '2026-07-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt <= :toDate',
        { toDate: '2026-07-31' },
      );
    });
  });

  describe('disbursalExecutiveWise', () => {
    it('groups by the real disbursal executive, not the credit executive (legacy join bug not reproduced)', async () => {
      await service.disbursalExecutiveWise({});

      expect(qb.innerJoin).toHaveBeenCalledWith(
        'lead.disbursalAssignedTo',
        'executive',
      );
      expect(qb.groupBy).toHaveBeenCalledWith('executive.id');
    });
  });

  describe('disbursalExecutiveTa', () => {
    it('requires both assignment and approval timestamps to be set', async () => {
      await service.disbursalExecutiveTa({});

      expect(qb.where).toHaveBeenCalledWith(
        'lead.disbursalApprovedAt IS NOT NULL',
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.disbursalAssignedAt IS NOT NULL',
      );
    });

    it('applies DATE()-truncated date filters when supplied', async () => {
      await service.disbursalExecutiveTa({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.disbursalApprovedAt) >= :fromDate',
        { fromDate: '2026-07-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.disbursalApprovedAt) <= :toDate',
        { toDate: '2026-07-31' },
      );
    });
  });
});
