import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { CollectionReportsService } from './collection-reports.service';

describe('CollectionReportsService', () => {
  let service: CollectionReportsService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CollectionReportsService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(CollectionReportsService);
  });

  describe('collectionPercentageByExecutive', () => {
    it('applies no date filter (bare 1=1) when the range is incomplete', async () => {
      await service.collectionPercentageByExecutive({});

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain('WHERE 1=1');
      expect(params).toEqual([]);
    });

    it('binds the credit-approval date range when given', async () => {
      await service.collectionPercentageByExecutive({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain('lead.lead_credit_approve_datetime >= ?');
      expect(params).toEqual(['2026-07-01', '2026-07-31']);
    });
  });

  describe('monthwisePendingCollection', () => {
    it('scopes to the open lifecycle statuses and verified collections', async () => {
      await service.monthwisePendingCollection();

      const [sql] = dataSource.query.mock.calls[0];
      expect(sql).toContain("'DISBURSED','PART-PAYMENT'");
      expect(sql).toContain('payment_verification=1');
    });
  });

  describe('collectionCallsByTime', () => {
    // Ported verbatim from legacy: the bucket is `windows[min(floor(hour/2),
    // 7)]` -- the label text ("04:00-06:00 PM" etc) does NOT line up with a
    // literal 2-hour-window read of the hour for most of the day (e.g. hour
    // 9 lands in the "04:00-06:00 PM" bucket), a legacy quirk kept as-is,
    // not "fixed" here.
    it("buckets each call using legacy's hour/2 index (label text does not literally match the hour)", async () => {
      dataSource.query.mockResolvedValue([
        { userName: 'Priya', createdAt: new Date(2026, 6, 1, 9, 15) },
        { userName: 'Priya', createdAt: new Date(2026, 6, 1, 9, 45) },
        { userName: 'Priya', createdAt: new Date(2026, 6, 1, 15, 0) },
        { userName: 'Ravi', createdAt: new Date(2026, 6, 1, 23, 0) },
      ]);

      const result = await service.collectionCallsByTime({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(result).toEqual([
        {
          userName: 'Priya',
          buckets: { '04:00-06:00 PM': 2, '10:00-12:00 AM': 1 },
        },
        { userName: 'Ravi', buckets: { '10:00-12:00 AM': 1 } },
      ]);
    });

    it('filters the "Call" followup type by name and binds the date range', async () => {
      await service.collectionCallsByTime({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain("m_followup_type_name='Call'");
      expect(params).toEqual(['2026-07-01', '2026-07-31']);
    });
  });

  describe('collectionCallsByStatus', () => {
    it('binds the date range params', async () => {
      await service.collectionCallsByStatus({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      const [, params] = dataSource.query.mock.calls[0];
      expect(params).toEqual(['2026-07-01', '2026-07-31']);
    });
  });

  describe('monthlyCollectionDetail', () => {
    it('derives the calendar-month bounds from any day in that month', async () => {
      await service.monthlyCollectionDetail({ month: '2026-02-15' });

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain(
        "'DISBURSED','PART-PAYMENT','CLOSED','SETTLED','WRITEOFF'",
      );
      expect(params).toEqual(['2026-02-01', '2026-02-28']);
    });
  });

  describe('paymentAnalysisByDisbursalMonth', () => {
    it('derives a 12-month financial-year window from the given start', async () => {
      await service.paymentAnalysisByDisbursalMonth({
        financialYearStart: '2026-04-01',
      });

      const [, params] = dataSource.query.mock.calls[0];
      expect(params).toEqual(['2026-04-01', '2027-03-31']);
    });
  });

  describe('DPD-bucket reports (preCollectionByMonth/collectionByMonth/recoveryByMonth)', () => {
    const sharedRow = {
      leadId: 1,
      loanNumber: 'LN-001',
      repaymentDate: '2026-07-01',
      recommendedLoanAmount: '50000',
      preCollectionAmount: null,
      collectionAmount: '2000',
      recoveryAmount: null,
    };

    it('preCollectionByMonth defaults a null bucket amount to 0', async () => {
      dataSource.query.mockResolvedValue([sharedRow]);

      const [row] = await service.preCollectionByMonth({ month: '2026-07-15' });

      expect(row).toEqual({
        leadId: 1,
        loanNumber: 'LN-001',
        repaymentDate: '2026-07-01',
        loanRecommended: '50000',
        preCollectionAmount: 0,
      });
    });

    it('collectionByMonth surfaces its own bucket amount', async () => {
      dataSource.query.mockResolvedValue([sharedRow]);

      const [row] = await service.collectionByMonth({ month: '2026-07-15' });

      expect(row.collectionAmount).toBe('2000');
    });

    it('recoveryByMonth defaults a null bucket amount to 0', async () => {
      dataSource.query.mockResolvedValue([sharedRow]);

      const [row] = await service.recoveryByMonth({ month: '2026-07-15' });

      expect(row.recoveryAmount).toBe(0);
    });
  });

  describe('collectionBucketCaseWise', () => {
    const baseRow = {
      leadId: 1,
      userType: 'NEW' as const,
      repaymentDate: '2026-07-01T00:00:00.000Z',
    };

    it('buckets a CLOSED-family lead paid on/before the due date', async () => {
      dataSource.query.mockResolvedValue([
        {
          ...baseRow,
          statusName: 'CLOSED',
          lastPaymentDate: '2026-06-30T00:00:00.000Z',
          lastPaymentAmount: '5000',
        },
      ]);

      const rows = await service.collectionBucketCaseWise({}, false);

      expect(rows.find((r) => r.bucket === 'On/Before Due Date')?.NEW).toBe(1);
    });

    it('buckets 1-10 DPD and 10+ DPD correctly', async () => {
      dataSource.query.mockResolvedValue([
        {
          ...baseRow,
          leadId: 2,
          statusName: 'CLOSED',
          lastPaymentDate: '2026-07-05T00:00:00.000Z', // 4 DPD
          lastPaymentAmount: '1000',
        },
        {
          ...baseRow,
          leadId: 3,
          userType: 'REPEAT',
          statusName: 'SETTLED',
          lastPaymentDate: '2026-07-20T00:00:00.000Z', // 19 DPD
          lastPaymentAmount: '3000',
        },
      ]);

      const rows = await service.collectionBucketCaseWise({}, false);

      expect(
        rows.find((r) => r.bucket === 'Collection (1 to 10 DPD)')?.NEW,
      ).toBe(1);
      expect(rows.find((r) => r.bucket === 'Recovery (10+ DPD)')?.REPEAT).toBe(
        1,
      );
    });

    it('treats a still-open lead as "Not Closed" regardless of payment date', async () => {
      dataSource.query.mockResolvedValue([
        {
          ...baseRow,
          statusName: 'DISBURSED',
          lastPaymentDate: null,
          lastPaymentAmount: null,
        },
      ]);

      const rows = await service.collectionBucketCaseWise({}, false);

      expect(rows.find((r) => r.bucket === 'Not Closed')?.NEW).toBe(1);
    });

    it('sums received amount instead of counting cases when byAmount=true', async () => {
      dataSource.query.mockResolvedValue([
        {
          ...baseRow,
          statusName: 'CLOSED',
          lastPaymentDate: '2026-06-30T00:00:00.000Z',
          lastPaymentAmount: '5000',
        },
      ]);

      const rows = await service.collectionBucketCaseWise({}, true);

      expect(rows.find((r) => r.bucket === 'On/Before Due Date')?.NEW).toBe(
        5000,
      );
    });

    it('treats a CLOSED lead with no verified payment yet as 0 DPD (on/before due date)', async () => {
      dataSource.query.mockResolvedValue([
        {
          ...baseRow,
          statusName: 'CLOSED',
          lastPaymentDate: null,
          lastPaymentAmount: null,
        },
      ]);

      const rows = await service.collectionBucketCaseWise({}, false);

      expect(rows.find((r) => r.bucket === 'On/Before Due Date')?.NEW).toBe(1);
    });
  });

  describe('collectionByCollectionExecutive / collectionBySanctionExecutive', () => {
    it('filters by actual payment date when typeId=1', async () => {
      await service.collectionByCollectionExecutive({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
        typeId: 1,
      });

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain(
        'c.date_of_recived >= ? AND c.date_of_recived <= ?',
      );
      expect(params).toEqual(['CO1', 'CO2', 'CO3', '2026-07-01', '2026-07-31']);
    });

    it('filters by due date when typeId=2', async () => {
      await service.collectionByCollectionExecutive({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
        typeId: 2,
      });

      const [sql] = dataSource.query.mock.calls[0];
      expect(sql).toContain(
        'cam.repayment_date >= ? AND cam.repayment_date <= ?',
      );
    });

    it('collectionBySanctionExecutive restricts to the sanction-executive role codes', async () => {
      await service.collectionBySanctionExecutive({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
        typeId: 1,
      });

      const [, params] = dataSource.query.mock.calls[0];
      expect(params).toEqual(['CR1', 'CR2', 'CR3', '2026-07-01', '2026-07-31']);
    });
  });

  describe('collectionByBranch', () => {
    it('has no role restriction, grouped by branch', async () => {
      await service.collectionByBranch({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
        typeId: 2,
      });

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain('GROUP BY b.m_branch_id');
      expect(params).toEqual(['2026-07-01', '2026-07-31']);
    });
  });

  describe('hourlyCollection', () => {
    it('groups verified collections by hour of day', async () => {
      await service.hourlyCollection({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      const [sql] = dataSource.query.mock.calls[0];
      expect(sql).toContain('GROUP BY HOUR(date_of_recived)');
    });
  });

  describe('sanctionWiseLeadConversion', () => {
    it('binds the single target date', async () => {
      await service.sanctionWiseLeadConversion('2026-07-15');

      const [, params] = dataSource.query.mock.calls[0];
      expect(params).toEqual(['2026-07-15']);
    });
  });

  describe('currentBucketStatus', () => {
    it('runs with no bound params (current snapshot)', async () => {
      await service.currentBucketStatus();

      const [, params] = dataSource.query.mock.calls[0];
      expect(params).toBeUndefined();
    });

    it('joins the credit-head/supervisor and the daily allocation-log activity flags', async () => {
      await service.currentBucketStatus();

      const [sql] = dataSource.query.mock.calls[0];
      expect(sql).toContain('user_lead_allocation_log');
      expect(sql).toContain('ur.user_role_supervisor_role_id');
      expect(sql).toContain("role_type_labels IN ('CR1','CR2')");
    });
  });

  describe('fyRepaymentCollection', () => {
    it('derives the 12-month financial-year window', async () => {
      await service.fyRepaymentCollection({ financialYearStart: '2026-04-01' });

      const [, params] = dataSource.query.mock.calls[0];
      expect(params).toEqual(['2026-04-01', '2027-03-31']);
    });
  });

  describe('collectionApprovalHour', () => {
    it('returns [] without querying when the date range is incomplete', async () => {
      expect(await service.collectionApprovalHour({})).toEqual([]);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('computes turnaround only for verified, closed collections in range', async () => {
      await service.collectionApprovalHour({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain('c.payment_verification = 1');
      expect(sql).toContain('c.closure_payment_updated_on IS NOT NULL');
      expect(params).toEqual(['2026-07-01', '2026-07-31']);
    });
  });
});
