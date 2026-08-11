import { LoanOutstandingRecomputeService } from './loan-outstanding-recompute.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

const CLOSURE_STATUSES = [
  { id: 16, name: 'CLOSED' },
  { id: 17, name: 'SETTLED' },
  { id: 18, name: 'WRITEOFF' },
];

describe('LoanOutstandingRecomputeService', () => {
  const jobRunner = { schedule: jest.fn() };
  let loanRepository: ReturnType<typeof repo>;
  let leadRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo> & {
    createQueryBuilder: jest.Mock;
  };
  let masterStatusRepository: ReturnType<typeof repo>;
  let service: LoanOutstandingRecomputeService;

  beforeEach(() => {
    loanRepository = repo();
    leadRepository = repo();
    camRepository = repo();
    collectionRepository = repo({
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      })) as unknown as jest.Mock,
    }) as never;
    masterStatusRepository = repo();
    masterStatusRepository.find.mockResolvedValue(CLOSURE_STATUSES);

    service = new LoanOutstandingRecomputeService(
      jobRunner as never,
      loanRepository as never,
      leadRepository as never,
      camRepository as never,
      collectionRepository as never,
      masterStatusRepository as never,
    );
  });

  it('schedules the nightly recompute, disabled by default', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'loan-outstanding-recompute',
      'disabled',
      expect.any(Function),
    );
  });

  it('does nothing when there are no disbursed loans', async () => {
    const result = await service.run();
    expect(result).toEqual({ processed: 0, failed: 0 });
    expect(leadRepository.findOne).not.toHaveBeenCalled();
  });

  it('queries only active, currently-disbursed loans', async () => {
    await service.run();
    expect(loanRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'DISBURSED', isActive: true, isDeleted: false },
      }),
    );
  });

  it("recomputes and persists a disbursed loan's outstanding figures", async () => {
    loanRepository.find.mockResolvedValue([
      {
        loanNumber: 'LN1',
        status: 'DISBURSED',
        principalDiscount: 0,
        interestDiscount: 0,
        penaltyDiscount: 0,
        totalDiscount: 0,
        lead: { id: 1 },
      },
    ]);
    leadRepository.findOne.mockResolvedValue({
      id: 1,
      isBlacklisted: false,
      leadStatus: { name: 'DISBURSED' },
      finalDisbursedAt: new Date('2026-01-01'),
    });
    camRepository.findOne.mockResolvedValue({
      recommendedLoanAmount: 10000,
      roi: 1,
      repaymentAmount: 13000,
      repaymentDate: new Date('2026-01-31'), // 30-day tenure, well in the past
      advanceInterestAmount: 0,
    });

    const result = await service.run();

    expect(result).toEqual({ processed: 1, failed: 0 });
    // hand-computed, same scenario as core-api's collection.service.spec.ts:
    // interest=3000, repaymentAmount=13000, penaltyDays capped at 60,
    // penalRoi=2 -> penaltyInterest=10000*2*60/100=12000,
    // totalRepaymentAmount=25000.
    expect(loanRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        totalPayable: 25000,
        totalOutstanding: 25000,
        penaltyOutstanding: 12000,
      }),
    );
    expect(camRepository.update).toHaveBeenCalledWith(
      { lead: { id: 1 } },
      expect.objectContaining({ tenureDays: 30, repaymentAmount: 13000 }),
    );
  });

  it('continues processing remaining loans when one fails, and counts it', async () => {
    loanRepository.find.mockResolvedValue([
      { loanNumber: 'LN1', status: 'DISBURSED', lead: { id: 1 } },
      { loanNumber: 'LN2', status: 'DISBURSED', lead: { id: 2 } },
    ]);
    leadRepository.findOne
      .mockResolvedValueOnce(null) // lead 1 missing -> recompute() returns early, still "processed"
      .mockResolvedValueOnce({
        id: 2,
        isBlacklisted: false,
        leadStatus: { name: 'DISBURSED' },
        finalDisbursedAt: null,
      });

    const result = await service.run();

    expect(result.processed + result.failed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('does not query collections at all when the loan has no active CAM (gate fails)', async () => {
    loanRepository.find.mockResolvedValue([
      { loanNumber: 'LN1', status: 'DISBURSED', lead: { id: 1 } },
    ]);
    leadRepository.findOne.mockResolvedValue({
      id: 1,
      isBlacklisted: false,
      leadStatus: { name: 'DISBURSED' },
      finalDisbursedAt: null,
    });
    camRepository.findOne.mockResolvedValue(null);

    await service.run();

    expect(collectionRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(loanRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ totalOutstanding: 0, totalPayable: 0 }),
    );
  });
});
