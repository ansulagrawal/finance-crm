import { LeadHoldRedistributionService } from './lead-hold-redistribution.service';

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

describe('LeadHoldRedistributionService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: LeadHoldRedistributionService;

  const holdStatus = { id: 3, name: 'LEAD-HOLD', stageCode: 'S3' };
  const inProcessStatus = { id: 2, name: 'LEAD-INPROCESS', stageCode: 'S2' };
  const screenerRole = { id: 5, code: 'CR1' };

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    userRoleRepository = repo();
    roleTypeRepository = repo();
    leadFollowupRepository = repo();

    masterStatusRepository.findOne.mockImplementation(
      async ({ where }: { where: { name: string } }) =>
        where.name === 'LEAD-HOLD' ? holdStatus : inProcessStatus,
    );

    service = new LeadHoldRedistributionService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      userRoleRepository as never,
      roleTypeRepository as never,
      leadFollowupRepository as never,
    );
  });

  it('schedules the redistribution cron on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'lead-hold-redistribution',
      expect.any(String),
      expect.any(Function),
    );
  });

  it('no-ops when required master_statuses rows are missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.run();
    expect(result).toEqual({ redistributed: 0 });
  });

  it('redistributes held leads to the least-loaded active CR1 screener', async () => {
    roleTypeRepository.findOne.mockResolvedValue(screenerRole);
    const busyUser = { id: 100, name: 'Busy Screener', isActive: true };
    const idleUser = { id: 200, name: 'Idle Screener', isActive: true };
    userRoleRepository.find.mockResolvedValue([
      { user: busyUser },
      { user: idleUser },
    ]);
    leadRepository.count.mockImplementation(
      async ({ where }: { where: { screenerAssignedTo: { id: number } } }) =>
        where.screenerAssignedTo.id === busyUser.id ? 5 : 0,
    );

    const lead = { id: 42, monthlySalaryAmount: 60000 };
    leadRepository.find.mockResolvedValue([lead]);

    const result = await service.run();

    expect(result).toEqual({ redistributed: 1 });
    expect(lead.screenerAssignedTo).toBe(idleUser);
    expect(lead.leadStatus).toBe(inProcessStatus);
    expect(leadRepository.save).toHaveBeenCalledWith(lead);
    expect(leadFollowupRepository.save).toHaveBeenCalled();
  });

  it('excludes leads whose salary is between 1 and 49999, matching legacy get_lead_hold()', async () => {
    roleTypeRepository.findOne.mockResolvedValue(screenerRole);
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'Screener', isActive: true } },
    ]);
    leadRepository.find.mockResolvedValue([
      { id: 1, monthlySalaryAmount: 25000 },
      { id: 2, monthlySalaryAmount: 0 },
      { id: 3, monthlySalaryAmount: 60000 },
    ]);

    const result = await service.run();

    expect(result).toEqual({ redistributed: 2 });
  });

  it('no-ops when there are no active CR1 screeners', async () => {
    roleTypeRepository.findOne.mockResolvedValue(screenerRole);
    userRoleRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([{ id: 1, monthlySalaryAmount: 0 }]);

    const result = await service.run();

    expect(result).toEqual({ redistributed: 0 });
  });
});
