import { ApiCallStatus } from '@finance-crm/database';
import { PoiFatherNameSyncService } from './poi-father-name-sync.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    ...overrides,
  };
}

describe('PoiFatherNameSyncService', () => {
  const jobRunner = { schedule: jest.fn() };
  let poiLogRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let service: PoiFatherNameSyncService;

  beforeEach(() => {
    poiLogRepository = repo();
    leadCustomerRepository = repo();

    service = new PoiFatherNameSyncService(
      jobRunner as never,
      poiLogRepository as never,
      leadCustomerRepository as never,
    );
  });

  it('schedules the daily sync on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'poi-father-name-sync',
      'disabled',
      expect.any(Function),
    );
  });

  it('does nothing when there are no successful PAN-fetch logs', async () => {
    const result = await service.run();
    expect(result).toEqual({ updated: 0 });
    expect(leadCustomerRepository.find).not.toHaveBeenCalled();
  });

  it('queries only successful, PAN-fetch (method 1) logs with a father name', async () => {
    await service.run();
    expect(poiLogRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          method: 1,
          status: ApiCallStatus.SUCCESS,
          fatherName: expect.anything(),
        },
      }),
    );
  });

  it('backfills only customers whose father name is currently missing', async () => {
    poiLogRepository.find.mockResolvedValue([
      { lead: { id: 1 }, fatherName: 'ram kumar' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead: { id: 1 }, fatherName: null },
    ]);

    const result = await service.run();

    expect(leadCustomerRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fatherName: expect.anything(),
        }),
      }),
    );
    expect(leadCustomerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ fatherName: 'RAM KUMAR' }),
    );
    expect(result).toEqual({ updated: 1 });
  });

  it('the most recently-created log wins when a lead has more than one', async () => {
    poiLogRepository.find.mockResolvedValue([
      { id: 1, lead: { id: 5 }, fatherName: 'old name' },
      { id: 2, lead: { id: 5 }, fatherName: 'new name' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead: { id: 5 }, fatherName: null },
    ]);

    await service.run();

    expect(leadCustomerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ fatherName: 'NEW NAME' }),
    );
    expect(leadCustomerRepository.save).toHaveBeenCalledTimes(1);
  });

  it('returns 0 updated when no customer is missing a father name', async () => {
    poiLogRepository.find.mockResolvedValue([
      { lead: { id: 1 }, fatherName: 'ram kumar' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([]);

    const result = await service.run();

    expect(result).toEqual({ updated: 0 });
    expect(leadCustomerRepository.save).not.toHaveBeenCalled();
  });
});
