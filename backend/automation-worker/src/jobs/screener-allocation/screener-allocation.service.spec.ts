import { LeadUserType } from '@finance-crm/database';
import { ScreenerAllocationService } from './screener-allocation.service';

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

describe('ScreenerAllocationService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let dataSourceRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: ScreenerAllocationService;

  const leadNewStatus = { id: 1, name: 'LEAD-NEW', stageCode: 'S1' };
  const leadInProcessStatus = {
    id: 2,
    name: 'LEAD-INPROCESS',
    stageCode: 'S2',
  };
  const screenerRole = { id: 5, code: 'CR1' };

  beforeEach(() => {
    jest.useFakeTimers();
    // 2026-01-01 10:00 local time -> within the 09:00-23:30 allocation window
    jest.setSystemTime(new Date(2026, 0, 1, 10, 0));

    leadRepository = repo();
    masterStatusRepository = repo();
    userRoleRepository = repo();
    roleTypeRepository = repo();
    dataSourceRepository = repo();
    leadFollowupRepository = repo();

    service = new ScreenerAllocationService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      userRoleRepository as never,
      roleTypeRepository as never,
      dataSourceRepository as never,
      leadFollowupRepository as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules both the G50K and B50K bands on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'screener-lead-allocation-g50k',
      expect.any(String),
      expect.any(Function),
    );
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'screener-lead-allocation-b50k',
      expect.any(String),
      expect.any(Function),
    );
  });

  it('no-ops outside the 09:00-23:30 working-hours window', async () => {
    jest.setSystemTime(new Date(2026, 0, 1, 6, 0));

    const result = await service.runBand(ScreenerAllocationService.BANDS[0]);

    expect(result).toEqual({ assigned: 0 });
    expect(leadRepository.find).not.toHaveBeenCalled();
  });

  it('no-ops when master_statuses has no S1 row', async () => {
    masterStatusRepository.find.mockResolvedValue([]);

    const result = await service.runBand(ScreenerAllocationService.BANDS[0]);

    expect(result).toEqual({ assigned: 0 });
  });

  it('assigns eligible leads to the least-loaded active CR1 screener and writes a followup', async () => {
    masterStatusRepository.find.mockResolvedValue([leadNewStatus]);
    masterStatusRepository.findOne.mockResolvedValue(leadInProcessStatus);
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

    const lead = {
      id: 42,
      userType: LeadUserType.NEW,
      monthlySalaryAmount: 60000,
      dataSource: null,
    };
    leadRepository.find.mockResolvedValue([lead]);

    const result = await service.runBand(ScreenerAllocationService.BANDS[0]);

    expect(result).toEqual({ assigned: 1 });
    expect(lead.screenerAssignedTo).toBe(idleUser);
    expect(lead.leadStatus).toBe(leadInProcessStatus);
    expect(leadRepository.save).toHaveBeenCalledWith(lead);
    expect(leadFollowupRepository.save).toHaveBeenCalled();
    const [followupArg] = leadFollowupRepository.create.mock.calls[0];
    expect(followupArg.remarks).toBe('Lead Auto Allocated to Idle Screener');
  });

  it('excludes leads from the excluded AffiliatesApp data source', async () => {
    masterStatusRepository.find.mockResolvedValue([leadNewStatus]);
    masterStatusRepository.findOne.mockResolvedValue(leadInProcessStatus);
    roleTypeRepository.findOne.mockResolvedValue(screenerRole);
    dataSourceRepository.findOne.mockResolvedValue({ id: 17, code: 'AFFAPP' });
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'Only Screener', isActive: true } },
    ]);

    leadRepository.find.mockResolvedValue([
      { id: 1, monthlySalaryAmount: 60000, dataSource: { id: 17 } },
    ]);

    const result = await service.runBand(ScreenerAllocationService.BANDS[0]);

    expect(result).toEqual({ assigned: 0 });
    expect(leadRepository.save).not.toHaveBeenCalled();
  });

  it('applies the upper salary bound for banded configs (B50K)', async () => {
    masterStatusRepository.find.mockResolvedValue([leadNewStatus]);
    masterStatusRepository.findOne.mockResolvedValue(leadInProcessStatus);
    roleTypeRepository.findOne.mockResolvedValue(screenerRole);
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'Screener', isActive: true } },
    ]);

    leadRepository.find.mockResolvedValue([
      { id: 1, monthlySalaryAmount: 55000, dataSource: null }, // above the B50K max, must be filtered out
      { id: 2, monthlySalaryAmount: 40000, dataSource: null },
    ]);

    const result = await service.runBand(ScreenerAllocationService.BANDS[1]);

    expect(result).toEqual({ assigned: 1 });
  });
});
