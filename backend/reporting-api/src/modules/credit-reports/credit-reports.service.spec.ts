import { Lead, LeadFollowup } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreditReportsService } from './credit-reports.service';

const CHAIN_METHODS = [
  'innerJoin',
  'leftJoin',
  'select',
  'addSelect',
  'where',
  'andWhere',
  'groupBy',
  'addGroupBy',
  'orderBy',
  'addOrderBy',
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

describe('CreditReportsService', () => {
  let service: CreditReportsService;
  let leadRepository: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let leadFollowupRepository: { query: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    qb = queryBuilder();
    leadRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      query: jest.fn().mockResolvedValue([]),
    };
    leadFollowupRepository = { query: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreditReportsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(LeadFollowup),
          useValue: leadFollowupRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(CreditReportsService);
  });

  describe('totalSanction', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.totalSanction({ fromDate: '2026-07-01' })).toEqual(
        [],
      );
      expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('filters on credit-approval date range and returns the raw rows', async () => {
      const rows = [{ executiveName: 'Priya', newCases: '2' }];
      qb.getRawMany.mockResolvedValue(rows);

      const result = await service.totalSanction({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
      expect(result).toBe(rows);
    });
  });

  describe('sanctionKpi', () => {
    it('derives the calendar-month bounds from any day in that month', async () => {
      await service.sanctionKpi({ month: '2026-07-15' });

      expect(qb.where).toHaveBeenCalledWith(
        'cam.disbursalDate BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });

    it('handles a 28-day February correctly', async () => {
      await service.sanctionKpi({ month: '2026-02-10' });

      expect(qb.where).toHaveBeenCalledWith(
        'cam.disbursalDate BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-02-01', toDate: '2026-02-28' },
      );
    });
  });

  describe('outstandingSanctionCases', () => {
    it('filters DISBURSED loans by repayment-date month', async () => {
      await service.outstandingSanctionCases({ month: '2026-07-15' });

      expect(qb.where).toHaveBeenCalledWith('loan.status = :status', {
        status: 'DISBURSED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(cam.repaymentDate) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });

  describe('userTypeOutstanding', () => {
    it('is a current snapshot with no date params', async () => {
      const rows = [{ userType: 'NEW', caseCount: '3' }];
      qb.getRawMany.mockResolvedValue(rows);

      const result = await service.userTypeOutstanding();

      expect(qb.where).toHaveBeenCalledWith('loan.status = :status', {
        status: 'DISBURSED',
      });
      expect(result).toBe(rows);
    });
  });

  describe('leadStatusSanctionWise* wrappers', () => {
    it.each([
      ['leadStatusSanctionWiseNew', 'NEW'],
      ['leadStatusSanctionWiseRepeat', 'REPEAT'],
      ['leadStatusSanctionWiseRepeatNew', 'REPEAT'],
    ] as const)(
      '%s scopes by screener-assignment date range and userType=%s',
      async (method, userType) => {
        await service[method]({
          fromDate: '2026-07-01',
          toDate: '2026-07-31',
        });

        expect(qb.andWhere).toHaveBeenCalledWith('lead.userType = :userType', {
          userType,
        });
        expect(qb.andWhere).toHaveBeenCalledWith(
          'DATE(lead.screenerAssignedAt) BETWEEN :fromDate AND :toDate',
          { fromDate: '2026-07-01', toDate: '2026-07-31' },
        );
      },
    );

    it('returns [] without querying when the date range is incomplete', async () => {
      expect(
        await service.leadStatusSanctionWiseNew({ fromDate: '2026-07-01' }),
      ).toEqual([]);
      expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('outstandingSanctionAmount', () => {
    it('sums recommended/received/outstanding amounts for the repayment month', async () => {
      await service.outstandingSanctionAmount({ month: '2026-07-15' });

      expect(qb.andWhere).toHaveBeenCalledWith('loan.status = :status', {
        status: 'DISBURSED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(cam.repaymentDate) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });

  describe('outstandingCasesDateRange', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.outstandingCasesDateRange({})).toEqual([]);
      expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('applies a free date range against repaymentDate', async () => {
      await service.outstandingCasesDateRange({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(cam.repaymentDate) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-01-01', toDate: '2026-12-31' },
      );
    });
  });

  describe('sanctionExecutiveTa', () => {
    it('computes turnaround only for leads with both timestamps set, for the target month', async () => {
      await service.sanctionExecutiveTa({ month: '2026-07-15' });

      expect(qb.where).toHaveBeenCalledWith(
        'lead.creditApprovedAt IS NOT NULL',
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.creditAssignedAt IS NOT NULL',
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });

  describe('sanctionExecutiveAchievement', () => {
    it('sums recommended amount per executive for the target month', async () => {
      await service.sanctionExecutiveAchievement({ month: '2026-07-15' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });

  describe('sanctionStatusWiseDetailed', () => {
    it('filters by the fixed pipeline-stage status list even with no date range', async () => {
      await service.sanctionStatusWiseDetailed({});

      expect(qb.where).toHaveBeenCalledWith('ms.name IN (:...statusNames)', {
        statusNames: expect.arrayContaining(['SANCTION', 'DISBURSAL-NEW']),
      });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('additionally scopes by creditAssignedAt when a date range is given (legacy bug fixed, not reproduced)', async () => {
      await service.sanctionStatusWiseDetailed({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.creditAssignedAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });

  describe('bucketWiseSanctionExecutive', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.bucketWiseSanctionExecutive({})).toEqual([]);
      expect(leadRepository.query).not.toHaveBeenCalled();
    });

    it('runs the screener/credit-manager fresh-repeat query with the date range bound twice (once per branch)', async () => {
      await service.bucketWiseSanctionExecutive({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(leadRepository.query).toHaveBeenCalledWith(
        expect.stringContaining("'SCREENER' AS reportType"),
        ['2026-07-01', '2026-07-31', '2026-07-01', '2026-07-31'],
      );
      const [sql] = leadRepository.query.mock.calls[0];
      expect(sql).toContain("'CREDIT' AS reportType");
      expect(sql).not.toContain('DATEDIFF');
    });
  });

  describe('processTat', () => {
    it('runs the raw window-function query bound to a single date param', async () => {
      const rows = [{ leadId: 1, statusName: 'LEAD-NEW' }];
      leadFollowupRepository.query.mockResolvedValue(rows);

      const result = await service.processTat('2026-07-15');

      expect(leadFollowupRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('ROW_NUMBER()'),
        ['2026-07-15'],
      );
      expect(result).toBe(rows);
    });
  });

  describe('sanctionTat', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.sanctionTat({})).toEqual([]);
      expect(leadRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('computes per-lead turnaround hours for leads approved in the date range', async () => {
      await service.sanctionTat({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.where).toHaveBeenCalledWith(
        'lead.creditApprovedAt IS NOT NULL',
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(lead.creditApprovedAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });
});
