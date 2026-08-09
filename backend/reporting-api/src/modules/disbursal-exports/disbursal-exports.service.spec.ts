import { Lead, MasterStatus } from '@finance-crm/database';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisbursalExportsService } from './disbursal-exports.service';

const CHAIN_METHODS = [
  'innerJoin',
  'leftJoin',
  'select',
  'addSelect',
  'where',
  'andWhere',
  'groupBy',
  'orderBy',
  'setParameters',
] as const;

function queryBuilder(rawMany: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {
    getRawMany: jest.fn().mockResolvedValue(rawMany),
    getQuery: jest.fn().mockReturnValue('SELECT 1'),
    getParameters: jest.fn().mockReturnValue({}),
  };
  for (const method of CHAIN_METHODS) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  return qb;
}

describe('DisbursalExportsService', () => {
  let service: DisbursalExportsService;
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
        DisbursalExportsService,
        { provide: getRepositoryToken(Lead), useValue: leadRepository },
        {
          provide: getRepositoryToken(MasterStatus),
          useValue: masterStatusRepository,
        },
      ],
    }).compile();

    service = moduleRef.get(DisbursalExportsService);
  });

  describe('loanDisbursed', () => {
    it('scopes to disbursed-family lead statuses and a DISBURSED loan', async () => {
      const rows = [{ applicationNo: 'APP-1' }];
      qb.getRawMany.mockResolvedValue(rows);

      const result = await service.loanDisbursed({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [
          { name: 'DISBURSED' },
          { name: 'CLOSED' },
          { name: 'SETTLED' },
          { name: 'WRITEOFF' },
          { name: 'PART-PAYMENT' },
        ],
      });
      expect(qb.where).toHaveBeenCalledWith(
        'leadStatus.id IN (:...statusIds)',
        {
          statusIds: [14, 19],
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('loan.status = :loanStatus', {
        loanStatus: 'DISBURSED',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt >= :fromDate',
        {
          fromDate: '2026-07-01',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.finalDisbursedAt <= :toDate',
        {
          toDate: '2026-07-31',
        },
      );
      expect(result).toBe(rows);
    });

    it('skips the date filters entirely when no range is given', async () => {
      await service.loanDisbursed({});

      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('finalDisbursedAt'),
        expect.anything(),
      );
    });
  });

  describe('loanPendingNeftFile', () => {
    it('produces the bank-file column layout, applying the (legacy-dead) date filters for real', async () => {
      await service.loanPendingNeftFile({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [{ name: 'DISBURSE-PENDING' }],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.disbursalApprovedAt >= :fromDate',
        { fromDate: '2026-07-01' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'lead.disbursalApprovedAt <= :toDate',
        { toDate: '2026-07-31' },
      );
      expect(qb.select).toHaveBeenCalledWith(
        'banking.beneficiaryName',
        'beneficiaryName',
      );
    });
  });

  describe('sendback/hold exports', () => {
    it.each([
      ['loanDisbursedSendback', 'DISBURSAL-SEND-BACK'],
      ['loanDisbursedHold', 'DISBURSAL-HOLD'],
    ] as const)('%s scopes to the %s status', async (method, statusName) => {
      await service[method]({});

      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [{ name: statusName }],
      });
      expect(qb.orderBy).toHaveBeenCalledWith(
        'lead.disbursalAssignedAt',
        'DESC',
      );
    });
  });

  describe('newLoanDisbursed', () => {
    it('adds the NEW-user-type filter on top of the disbursed base query', async () => {
      await service.newLoanDisbursed({});

      expect(qb.andWhere).toHaveBeenCalledWith("lead.userType = 'NEW'");
    });
  });

  describe('loanDumpReport', () => {
    it('filters on lead creation date when given', async () => {
      await service.loanDumpReport({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('lead.createdAt >= :fromDate', {
        fromDate: '2026-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('lead.createdAt <= :toDate', {
        toDate: '2026-12-31',
      });
    });

    it('does not filter by date at all when no range is given', async () => {
      await service.loanDumpReport({});

      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('GST split (masterDisbursalReport / disbursalAccountReport)', () => {
    it('splits admin fee into CGST+SGST for a home-state customer', async () => {
      qb.getRawMany.mockResolvedValue([
        {
          applicationNo: 'APP-1',
          adminFee: '1000',
          stateName: 'Rajasthan',
        },
      ]);

      const [row] = await service.masterDisbursalReport({});

      expect(row.cgst).toBeCloseTo(76.271186440678, 5);
      expect(row.sgst).toBeCloseTo(76.271186440678, 5);
      expect(row.igst).toBe(0);
    });

    it('splits admin fee into IGST for an inter-state customer', async () => {
      qb.getRawMany.mockResolvedValue([
        {
          applicationNo: 'APP-2',
          netDisbursalAmount: '9000',
          adminFee: '1000',
          stateName: 'Maharashtra',
        },
      ]);

      const [row] = await service.disbursalAccountReport({});

      expect(row.igst).toBeCloseTo(152.542372881356, 5);
      expect(row.cgst).toBe(0);
      expect(row.sgst).toBe(0);
    });

    it('treats a null admin fee as zero', async () => {
      qb.getRawMany.mockResolvedValue([
        { applicationNo: 'APP-3', adminFee: null, stateName: 'Rajasthan' },
      ]);

      const [row] = await service.masterDisbursalReport({});

      expect(row.cgst).toBe(0);
      expect(row.sgst).toBe(0);
      expect(row.igst).toBe(0);
    });
  });

  describe('closedLoan', () => {
    it('excludes any pancard still active elsewhere and filters by closedAt range', async () => {
      await service.closedLoan({
        fromDate: '2026-07-01',
        toDate: '2026-07-31',
      });

      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [{ name: 'CLOSED' }],
      });
      expect(masterStatusRepository.find).toHaveBeenCalledWith({
        where: [
          { name: 'DISBURSED' },
          { name: 'SETTLED' },
          { name: 'WRITEOFF' },
          { name: 'PART-PAYMENT' },
        ],
      });
      expect(qb.andWhere).toHaveBeenCalledWith('loan.closedAt >= :fromDate', {
        fromDate: '2026-07-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('loan.closedAt <= :toDate', {
        toDate: '2026-07-31',
      });
      expect(qb.setParameters).toHaveBeenCalled();
    });
  });
});
