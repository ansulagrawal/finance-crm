import { ApplicationHoldRedistributionService } from './application-hold-redistribution.service';

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

describe('ApplicationHoldRedistributionService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: ApplicationHoldRedistributionService;

  const holdStatus = { id: 6, name: 'APPLICATION-HOLD', stageCode: 'S6' };
  const inProcessStatus = {
    id: 5,
    name: 'APPLICATION-INPROCESS',
    stageCode: 'S5',
  };
  const creditRole = { id: 3, code: 'CR2' };

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    userRoleRepository = repo();
    roleTypeRepository = repo();
    leadFollowupRepository = repo();

    masterStatusRepository.findOne.mockImplementation(
      async ({ where }: { where: { name: string } }) =>
        where.name === 'APPLICATION-HOLD' ? holdStatus : inProcessStatus,
    );

    service = new ApplicationHoldRedistributionService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      userRoleRepository as never,
      roleTypeRepository as never,
      leadFollowupRepository as never,
    );
  });

  it('schedules both the G50K and B50K bands on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'application-hold-redistribution-g50k',
      expect.any(String),
      expect.any(Function),
    );
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'application-hold-redistribution-b50k',
      expect.any(String),
      expect.any(Function),
    );
  });

  it('no-ops when required master_statuses rows are missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.runBand(
      ApplicationHoldRedistributionService.BANDS[0],
    );
    expect(result).toEqual({ redistributed: 0 });
  });

  it('redistributes held G50K applications to the least-loaded active CR2 credit user', async () => {
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

    const lead = { id: 7, monthlySalaryAmount: 60000 };
    leadRepository.find.mockResolvedValue([lead]);

    const result = await service.runBand(
      ApplicationHoldRedistributionService.BANDS[0],
    );

    expect(result).toEqual({ redistributed: 1 });
    expect(lead.creditAssignedTo).toBe(idleUser);
    expect(lead.leadStatus).toBe(inProcessStatus);
    expect(leadRepository.save).toHaveBeenCalledWith(lead);
    expect(leadFollowupRepository.save).toHaveBeenCalled();
  });

  it('applies the B50K upper salary bound', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'Credit User', isActive: true } },
    ]);
    leadRepository.find.mockResolvedValue([
      { id: 1, monthlySalaryAmount: 55000 }, // above B50K max, must be filtered out
      { id: 2, monthlySalaryAmount: 40000 },
    ]);

    const result = await service.runBand(
      ApplicationHoldRedistributionService.BANDS[1],
    );

    expect(result).toEqual({ redistributed: 1 });
  });

  it('no-ops when there are no active CR2 credit users', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([
      { id: 1, monthlySalaryAmount: 60000 },
    ]);

    const result = await service.runBand(
      ApplicationHoldRedistributionService.BANDS[0],
    );

    expect(result).toEqual({ redistributed: 0 });
  });
});
