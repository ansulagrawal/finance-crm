import { Collection, Lead, LoanCollectionFollowup } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionExportsService } from './collection-exports.service';

const CHAIN_METHODS = [
  'innerJoin',
  'leftJoin',
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

describe('CollectionExportsService', () => {
  let service: CollectionExportsService;
  let collectionRepository: { createQueryBuilder: jest.Mock };
  let followupRepository: { createQueryBuilder: jest.Mock };
  let leadRepository: { createQueryBuilder: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    qb = queryBuilder();
    collectionRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    followupRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
    leadRepository = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionExportsService,
        {
          provide: getRepositoryToken(Collection),
          useValue: collectionRepository,
        },
        {
          provide: getRepositoryToken(LoanCollectionFollowup),
          useValue: followupRepository,
        },
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
      ],
    }).compile();

    service = moduleRef.get(CollectionExportsService);
  });

  describe('applyDateRange (exercised via loanClosed/preCollection)', () => {
    it('applies both bounds when both dates are given', async () => {
      await service.loanClosed({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('collection.closedAt >= :from', {
        from: '2026-07-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('collection.closedAt <= :to', {
        to: '2026-07-31',
      });
    });

    it('applies only the given bound when one date is missing', async () => {
      await service.loanClosed({ fromDate: '2026-07-01' });

      expect(qb.andWhere).toHaveBeenCalledWith('collection.closedAt >= :from', {
        from: '2026-07-01',
      });
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('closedAt <= :to'),
        expect.anything(),
      );
    });

    it('applies no date filter at all when neither is given', async () => {
      await service.preCollection({});

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('loanClosed', () => {
    it('scopes to verified, dated, non-deleted collections', async () => {
      const rows = [{ leadId: 1 }];
      qb.getRawMany.mockResolvedValue(rows);

      const result = await service.loanClosed({});

      expect(qb.where).toHaveBeenCalledWith('collection.isDeleted = false');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :verified',
        { verified: 1 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.receivedDate IS NOT NULL',
      );
      expect(result).toBe(rows);
    });
  });

  describe('pendingRecovery', () => {
    it('scopes to PENDING (not yet verified) collections', async () => {
      await service.pendingRecovery({});

      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :pending',
        { pending: 0 },
      );
    });
  });

  describe('collection', () => {
    it('excludes contact-detail columns by default', async () => {
      await service.collection({}, false);

      expect(qb.addSelect).not.toHaveBeenCalledWith(
        'customer.mobile',
        'mobile',
      );
    });

    it('adds contact-detail columns when includeContactDetails is true', async () => {
      await service.collection({}, true);

      expect(qb.addSelect).toHaveBeenCalledWith('customer.mobile', 'mobile');
      expect(qb.addSelect).toHaveBeenCalledWith(
        'customer.alternateMobile',
        'alternateMobile',
      );
      expect(qb.addSelect).toHaveBeenCalledWith('customer.email', 'email');
      expect(qb.addSelect).toHaveBeenCalledWith(
        'customer.alternateEmail',
        'alternateEmail',
      );
    });

    it('scopes only to non-deleted collections (no verification-status filter)', async () => {
      await service.collection({}, false);

      expect(qb.where).toHaveBeenCalledWith('collection.isDeleted = false');
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('verificationStatus'),
        expect.anything(),
      );
    });
  });

  describe('totalRecovery', () => {
    it('scopes to verified, dated, non-deleted collections', async () => {
      await service.totalRecovery({});

      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :verified',
        { verified: 1 },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.receivedDate IS NOT NULL',
      );
    });
  });

  describe('preCollection', () => {
    it('scopes to non-deleted leads with a real repayment-date range', async () => {
      await service.preCollection({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(qb.where).toHaveBeenCalledWith('lead.isDeleted = false');
      expect(qb.andWhere).toHaveBeenCalledWith('cam.repaymentDate >= :from', {
        from: '2026-07-01',
      });
    });
  });

  describe('pendingCollectionVerification', () => {
    it('scopes to PENDING collections', async () => {
      await service.pendingCollectionVerification({});

      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :pending',
        { pending: 0 },
      );
    });
  });

  describe('legalData', () => {
    it('scopes to DISBURSED loans on non-deleted leads', async () => {
      await service.legalData({});

      expect(qb.andWhere).toHaveBeenCalledWith('loan.status = :disbursed', {
        disbursed: 'DISBURSED',
      });
    });
  });

  describe('outstandingData', () => {
    it('scopes to non-deleted leads with a loan', async () => {
      await service.outstandingData({});

      expect(qb.where).toHaveBeenCalledWith('lead.isDeleted = false');
      expect(leadRepository.createQueryBuilder).toHaveBeenCalledWith('lead');
    });
  });

  describe('loanPool', () => {
    it('scopes to DISBURSED loans, ordered by disbursal date', async () => {
      await service.loanPool({});

      expect(qb.andWhere).toHaveBeenCalledWith('loan.status = :disbursed', {
        disbursed: 'DISBURSED',
      });
      expect(qb.orderBy).toHaveBeenCalledWith('cam.disbursalDate', 'ASC');
    });
  });

  describe('followUp', () => {
    it('joins the followup type/status/user and scopes to non-deleted rows', async () => {
      await service.followUp({});

      expect(followupRepository.createQueryBuilder).toHaveBeenCalledWith(
        'followup',
      );
      expect(qb.where).toHaveBeenCalledWith('followup.isDeleted = false');
    });
  });

  describe('paymentRejected', () => {
    it('scopes to REJECTED collections', async () => {
      await service.paymentRejected({});

      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :rejected',
        { rejected: 2 },
      );
    });
  });

  describe('suspenseVerified', () => {
    it('scopes to verified, dated collections and computes the suspense-day gap', async () => {
      await service.suspenseVerified({});

      expect(qb.andWhere).toHaveBeenCalledWith(
        'collection.verificationStatus = :verified',
        { verified: 1 },
      );
      expect(qb.select).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining(
            'DATEDIFF(collection.closedAt, collection.receivedDate)',
          ),
        ]),
      );
    });
  });

  describe('newCollectionReport', () => {
    it('scopes to DISBURSED loans on non-deleted leads', async () => {
      await service.newCollectionReport({});

      expect(qb.andWhere).toHaveBeenCalledWith('loan.status = :disbursed', {
        disbursed: 'DISBURSED',
      });
    });
  });

  describe('legalNoticeSentLog', () => {
    it('proxies "legal notice sent" via a case-insensitive rejection-reason match', async () => {
      await service.legalNoticeSentLog({});

      expect(qb.andWhere).toHaveBeenCalledWith(
        'LOWER(rejectionReason.reason) LIKE :legal',
        { legal: '%legal%' },
      );
    });
  });
});
