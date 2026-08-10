import { Collection, LoanCollectionVisit } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FieldVisitReportsService } from './field-visit-reports.service';

const CHAIN_METHODS = [
  'innerJoin',
  'select',
  'addSelect',
  'where',
  'andWhere',
  'groupBy',
  'addGroupBy',
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

describe('FieldVisitReportsService', () => {
  let service: FieldVisitReportsService;
  let visitRepository: { createQueryBuilder: jest.Mock };
  let collectionRepository: { createQueryBuilder: jest.Mock };
  let visitQb: ReturnType<typeof queryBuilder>;
  let collectionQb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    visitQb = queryBuilder();
    collectionQb = queryBuilder();
    visitRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(visitQb),
    };
    collectionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(collectionQb),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FieldVisitReportsService,
        {
          provide: getRepositoryToken(LoanCollectionVisit),
          useValue: visitRepository,
        },
        {
          provide: getRepositoryToken(Collection),
          useValue: collectionRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(FieldVisitReportsService);
  });

  describe('branchwiseVisit', () => {
    it('computes pending/completed counts and percentages per branch', async () => {
      visitQb.getRawMany.mockResolvedValue([
        {
          branchId: 1,
          branchName: 'Delhi',
          totalCount: '10',
          completedCount: '4',
        },
      ]);

      const [row] = await service.branchwiseVisit({});

      expect(row).toEqual({
        branchId: 1,
        branchName: 'Delhi',
        totalVisits: 10,
        pending: 6,
        completed: 4,
        pendingPercent: 60,
        completedPercent: 40,
      });
    });

    it('avoids a division-by-zero NaN when a branch has no visits', async () => {
      visitQb.getRawMany.mockResolvedValue([
        {
          branchId: 2,
          branchName: 'Empty',
          totalCount: '0',
          completedCount: '0',
        },
      ]);

      const [row] = await service.branchwiseVisit({});

      expect(row.pendingPercent).toBe(0);
      expect(row.completedPercent).toBe(0);
    });

    it('scopes to non-deleted visits with a resolved branch, on a disbursed loan', async () => {
      await service.branchwiseVisit({});

      expect(visitQb.where).toHaveBeenCalledWith('visit.isDeleted = false');
      expect(visitQb.andWhere).toHaveBeenCalledWith('branch.id IS NOT NULL');
      expect(visitQb.innerJoin).toHaveBeenCalledWith(
        expect.anything(),
        'loan',
        'loan.leadId = lead.id AND loan.status = :disbursed',
        { disbursed: 'DISBURSED' },
      );
    });

    it('applies the date range against visit.createdAt', async () => {
      await service.branchwiseVisit({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(visitQb.andWhere).toHaveBeenCalledWith(
        'visit.createdAt >= :from',
        {
          from: '2026-07-01',
        },
      );
      expect(visitQb.andWhere).toHaveBeenCalledWith('visit.createdAt <= :to', {
        to: '2026-07-31',
      });
    });
  });

  describe('rmwiseVisit', () => {
    it('joins visit counts with collection amounts by RM, defaulting to 0 when uncollected', async () => {
      visitQb.getRawMany.mockResolvedValue([
        { rmId: 1, rmName: 'Alice', totalCount: '5', completedCount: '2' },
        { rmId: 2, rmName: 'Bob', totalCount: '3', completedCount: '3' },
      ]);
      collectionQb.getRawMany.mockResolvedValue([
        { rmId: 1, collectionAmount: '15000' },
      ]);

      const rows = await service.rmwiseVisit({});

      expect(rows).toEqual([
        {
          rmId: 1,
          rmName: 'Alice',
          totalVisitsAssigned: 5,
          completed: 2,
          pending: 3,
          collectionAmount: 15000,
          completedPercent: 40,
        },
        {
          rmId: 2,
          rmName: 'Bob',
          totalVisitsAssigned: 3,
          completed: 3,
          pending: 0,
          collectionAmount: 0,
          completedPercent: 100,
        },
      ]);
    });

    it('only counts APPROVED, dated, non-deleted collections toward the amount', async () => {
      await service.rmwiseVisit({});

      expect(collectionQb.where).toHaveBeenCalledWith(
        'collection.isDeleted = false',
      );
      expect(collectionQb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :verified',
        { verified: 1 },
      );
      expect(collectionQb.andWhere).toHaveBeenCalledWith(
        'collection.receivedDate IS NOT NULL',
      );
    });

    it('applies the date range to both the visit (scheduledAt) and collection (receivedDate) queries', async () => {
      await service.rmwiseVisit({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(visitQb.andWhere).toHaveBeenCalledWith(
        'visit.scheduledAt >= :from',
        { from: '2026-07-01' },
      );
      expect(collectionQb.andWhere).toHaveBeenCalledWith(
        'collection.receivedDate >= :from',
        { from: '2026-07-01' },
      );
    });
  });

  describe('rmConveyance', () => {
    it('scopes to completed visits only and leaves the unmodeled fields null', async () => {
      visitQb.getRawMany.mockResolvedValue([
        {
          rmId: 1,
          rmName: 'Alice',
          completedVisitCount: '4',
          totalDistanceKm: '120.5',
        },
      ]);

      const [row] = await service.rmConveyance({});

      expect(visitQb.andWhere).toHaveBeenCalledWith(
        'visit.completedAt IS NOT NULL',
      );
      expect(row).toEqual({
        rmId: 1,
        rmName: 'Alice',
        completedVisitCount: 4,
        visitDistanceKm: null,
        rthDistanceKm: null,
        totalDistanceKm: 120.5,
        totalConveyanceAmount: null,
      });
    });

    it('keeps totalDistanceKm null when no visits contributed any distance', async () => {
      visitQb.getRawMany.mockResolvedValue([
        {
          rmId: 2,
          rmName: 'Bob',
          completedVisitCount: '0',
          totalDistanceKm: null,
        },
      ]);

      const [row] = await service.rmConveyance({});

      expect(row.totalDistanceKm).toBeNull();
    });
  });
});
