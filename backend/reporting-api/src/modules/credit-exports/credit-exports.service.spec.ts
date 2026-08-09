import { BreRuleResult, CustomerBlacklist, Loan } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreditExportsService } from './credit-exports.service';

const CHAIN_METHODS = [
  'leftJoin',
  'innerJoin',
  'select',
  'addSelect',
  'where',
  'andWhere',
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

describe('CreditExportsService', () => {
  let service: CreditExportsService;
  let loanRepository: { createQueryBuilder: jest.Mock };
  let breRuleResultRepository: { createQueryBuilder: jest.Mock };
  let customerBlacklistRepository: { createQueryBuilder: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    qb = queryBuilder();
    loanRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    breRuleResultRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    customerBlacklistRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreditExportsService,
        { provide: getRepositoryToken(Loan), useValue: loanRepository },
        {
          provide: getRepositoryToken(BreRuleResult),
          useValue: breRuleResultRepository,
        },
        {
          provide: getRepositoryToken(CustomerBlacklist),
          useValue: customerBlacklistRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(CreditExportsService);
  });

  describe('totalSanction', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.totalSanction({ fromDate: '2026-07-01' })).toEqual(
        [],
      );
      expect(loanRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('filters DISBURSED loans by disbursal-date range', async () => {
      const rows = [{ leadId: 1, loanNumber: 'LN-001' }];
      qb.getRawMany.mockResolvedValue(rows);

      const result = await service.totalSanction({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.where).toHaveBeenCalledWith('loan.status = :status', {
        status: 'DISBURSED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'cam.disbursalDate BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
      expect(result).toBe(rows);
    });
  });

  describe('totalApprovedSanction', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.totalApprovedSanction({})).toEqual([]);
      expect(loanRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('filters by credit-approval date range, no verified-bank requirement', async () => {
      await service.totalApprovedSanction({
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

  describe('breRulesResult', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.breRulesResult({})).toEqual([]);
      expect(breRuleResultRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('joins the rule and its category, scoped to the created-date range', async () => {
      await service.breRulesResult({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.where).toHaveBeenCalledWith(
        'DATE(r.createdAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });

  describe('cibilReport', () => {
    it('returns [] without querying when toDate is missing', async () => {
      expect(await service.cibilReport({})).toEqual([]);
      expect(loanRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('only requires toDate (an upper bound, not a range)', async () => {
      await service.cibilReport({ toDate: '2026-07-31' });

      expect(qb.where).toHaveBeenCalledWith('loan.status = :status', {
        status: 'DISBURSED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('cam.disbursalDate <= :toDate', {
        toDate: '2026-07-31',
      });
    });
  });

  describe('blacklisted', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.blacklisted({})).toEqual([]);
      expect(
        customerBlacklistRepository.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('scopes to active entries created within the date range, newest first', async () => {
      await service.blacklisted({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.where).toHaveBeenCalledWith('b.isActive = :active', {
        active: true,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'DATE(b.createdAt) BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
      expect(qb.orderBy).toHaveBeenCalledWith('b.id', 'DESC');
    });
  });

  describe('loanWaived', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.loanWaived({})).toEqual([]);
      expect(loanRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('filters by the DISBURSED-WAIVED lead status and disbursal-date range', async () => {
      await service.loanWaived({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.where).toHaveBeenCalledWith('ms.name = :status', {
        status: 'DISBURSED-WAIVED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'cam.disbursalDate BETWEEN :fromDate AND :toDate',
        { fromDate: '2026-07-01', toDate: '2026-07-31' },
      );
    });
  });
});
