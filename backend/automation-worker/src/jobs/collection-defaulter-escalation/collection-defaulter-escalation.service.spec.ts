import { LoanRecoveryStage } from '@finance-crm/database';
import { CollectionDefaulterEscalationService } from './collection-defaulter-escalation.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  };
}

describe('CollectionDefaulterEscalationService', () => {
  const jobRunner = { schedule: jest.fn() };
  let camRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let service: CollectionDefaulterEscalationService;

  beforeEach(() => {
    camRepository = repo();
    loanRepository = repo();
    masterStatusRepository = repo();

    service = new CollectionDefaulterEscalationService(
      jobRunner as never,
      camRepository as never,
      loanRepository as never,
      masterStatusRepository as never,
    );
  });

  it('schedules all three DPD buckets on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledTimes(3);
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'collection-defaulter-60-plus-dpd',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when DISBURSED/PART-PAYMENT statuses are missing', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const result = await service.runBucket(
      CollectionDefaulterEscalationService.BUCKETS[0],
    );
    expect(result).toEqual({ found: 0 });
    expect(camRepository.find).not.toHaveBeenCalled();
  });

  it('finds loans in the 1-30 DPD bucket and writes COLLECTION_PENDING', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }, { id: 19 }]);
    const lead = { id: 1 };
    camRepository.find.mockResolvedValue([{ lead }]);
    loanRepository.find.mockResolvedValue([
      { id: 5, loanNumber: 'LN-1', lead },
    ]);

    const result = await service.runBucket(
      CollectionDefaulterEscalationService.BUCKETS[0],
    );

    expect(result).toEqual({ found: 1 });
    expect(loanRepository.update).toHaveBeenCalledWith(
      { id: expect.anything() },
      { recoveryStage: LoanRecoveryStage.COLLECTION_PENDING },
    );
  });

  it('does not call update when no loans are found', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const lead = { id: 1 };
    camRepository.find.mockResolvedValue([{ lead }]);
    loanRepository.find.mockResolvedValue([]);

    await service.runBucket(CollectionDefaulterEscalationService.BUCKETS[0]);

    expect(loanRepository.update).not.toHaveBeenCalled();
  });

  it('the 60+ bucket is open-ended (dpdTo null), not capped at 90 days like legacy', () => {
    const bucket = CollectionDefaulterEscalationService.BUCKETS[2];
    expect(bucket.dpdFrom).toBe(61);
    expect(bucket.dpdTo).toBeNull();
  });

  it('returns 0 found when no CAMs fall in the bucket window', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    camRepository.find.mockResolvedValue([]);

    const result = await service.runBucket(
      CollectionDefaulterEscalationService.BUCKETS[1],
    );

    expect(result).toEqual({ found: 0 });
    expect(loanRepository.find).not.toHaveBeenCalled();
  });
});
