import { RepeatOnlineCustomersAllocationService } from './repeat-online-customers-allocation.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('RepeatOnlineCustomersAllocationService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: RepeatOnlineCustomersAllocationService;

  const disbursalNewStatus = {
    id: 25,
    name: 'DISBURSAL-NEW',
    stageCode: 'S20',
  };
  const inProcessStatus = {
    id: 5,
    name: 'APPLICATION-INPROCESS',
    stageCode: 'S5',
  };
  const creditRole = { id: 3, code: 'CR2' };

  beforeEach(() => {
    jest.useFakeTimers();
    // 2026-01-01 10:00 local time -> within the 07:00-23:30 working window
    jest.setSystemTime(new Date(2026, 0, 1, 10, 0));

    leadRepository = repo();
    masterStatusRepository = repo();
    userRoleRepository = repo();
    roleTypeRepository = repo();
    leadFollowupRepository = repo();

    masterStatusRepository.findOne.mockImplementation(
      async ({ where }: { where: { name: string } }) =>
        where.name === 'DISBURSAL-NEW' ? disbursalNewStatus : inProcessStatus,
    );

    service = new RepeatOnlineCustomersAllocationService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      userRoleRepository as never,
      roleTypeRepository as never,
      leadFollowupRepository as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules the every-2-minutes job on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'repeat-online-customers-allocation',
      '*/2 * * * *',
      expect.any(Function),
    );
  });

  it('no-ops outside the 07:00-23:30 working-hours window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 1, 6, 0));

    const result = await service.run();

    expect(result).toEqual({ assigned: 0 });
    expect(leadRepository.find).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('no-ops when required master_statuses rows are missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.run();
    expect(result).toEqual({ assigned: 0 });
  });

  it('assigns direct-disbursal REPEAT leads to the least-loaded active CR2 user', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    const busyUser = { id: 10, name: 'Busy Credit', isActive: true };
    const idleUser = { id: 20, name: 'Idle Credit', isActive: true };
    userRoleRepository.find.mockResolvedValue([
      { user: busyUser },
      { user: idleUser },
    ]);
    leadRepository.count.mockImplementation(
      async ({ where }: { where: { creditAssignedTo: { id: number } } }) =>
        where.creditAssignedTo.id === busyUser.id ? 5 : 0,
    );

    const lead = { id: 1, screenerAssignedTo: null };
    leadRepository.find.mockResolvedValue([lead]);

    const result = await service.run();

    expect(result).toEqual({ assigned: 1 });
    expect(lead.creditAssignedTo).toBe(idleUser);
    expect(lead.screenerAssignedTo).toBe(idleUser);
    expect(lead.leadStatus).toBe(inProcessStatus);
    const [{ where }] = leadRepository.find.mock.calls[0];
    expect(where.leadDirectDisbursal).toBe(true);
  });

  it('does not overwrite an existing screener assignment', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'CR', isActive: true } },
    ]);
    const existingScreener = { id: 99 };
    const lead = { id: 1, screenerAssignedTo: existingScreener };
    leadRepository.find.mockResolvedValue([lead]);

    await service.run();

    expect(lead.screenerAssignedTo).toBe(existingScreener);
  });

  it('no-ops when there are no active CR2 credit users', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([
      { id: 1, screenerAssignedTo: null },
    ]);

    const result = await service.run();

    expect(result).toEqual({ assigned: 0 });
  });
});
