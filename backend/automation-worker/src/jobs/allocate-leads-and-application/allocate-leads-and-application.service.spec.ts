import { LeadUserType } from '@finance-crm/database';
import { AllocateLeadsAndApplicationService } from './allocate-leads-and-application.service';

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

describe('AllocateLeadsAndApplicationService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let userActivityLogRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: AllocateLeadsAndApplicationService;

  const leadHoldStatus = { id: 3, name: 'LEAD-HOLD', stageCode: 'S3' };
  const leadInProcessStatus = {
    id: 2,
    name: 'LEAD-INPROCESS',
    stageCode: 'S2',
  };
  const applicationNewStatus = {
    id: 4,
    name: 'APPLICATION-NEW',
    stageCode: 'S4',
  };
  const applicationInProcessStatus = {
    id: 5,
    name: 'APPLICATION-INPROCESS',
    stageCode: 'S5',
  };
  const applicationHoldStatus = {
    id: 6,
    name: 'APPLICATION-HOLD',
    stageCode: 'S6',
  };
  const partialStatuses = [
    { id: 42, name: 'LEAD-PARTIAL-A', stageCode: 'S1' },
    { id: 43, name: 'LEAD-PARTIAL-B', stageCode: 'S1' },
  ];
  const screenerRole = { id: 5, code: 'CR1' };
  const creditRole = { id: 6, code: 'CR2' };

  const byName: Record<string, unknown> = {
    'LEAD-HOLD': leadHoldStatus,
    'LEAD-INPROCESS': leadInProcessStatus,
    'APPLICATION-NEW': applicationNewStatus,
    'APPLICATION-INPROCESS': applicationInProcessStatus,
    'APPLICATION-HOLD': applicationHoldStatus,
  };

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    userRoleRepository = repo();
    roleTypeRepository = repo();
    userActivityLogRepository = repo();
    leadFollowupRepository = repo();

    masterStatusRepository.findOne.mockImplementation(
      async ({ where }: { where: { name: string } }) =>
        byName[where.name] ?? null,
    );
    masterStatusRepository.find.mockImplementation(
      async ({ where }: { where: { stageCode: string } }) =>
        where.stageCode === 'S1' ? partialStatuses : [],
    );

    service = new AllocateLeadsAndApplicationService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      userRoleRepository as never,
      roleTypeRepository as never,
      userActivityLogRepository as never,
      leadFollowupRepository as never,
    );
  });

  it('schedules all 5 bands on module init', () => {
    service.onModuleInit();
    const scheduledNames = jobRunner.schedule.mock.calls.map((call) => call[0]);
    expect(scheduledNames).toEqual([
      'allocate-lead-hold-to-screener',
      'allocate-application-new-to-credit',
      'allocate-application-hold-to-credit',
      'allocate-partial-lead-new-to-screener',
      'allocate-partial-lead-repeat-to-credit',
    ]);
  });

  it('no-ops when a named source/target master_statuses row is missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const band = AllocateLeadsAndApplicationService.BANDS[0];
    const result = await service.runBand(band);
    expect(result).toEqual({ assigned: 0 });
  });

  it('no-ops when the stageCode-matched source status set is empty', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const band = AllocateLeadsAndApplicationService.BANDS[3];
    const result = await service.runBand(band);
    expect(result).toEqual({ assigned: 0 });
  });

  function stubEligibleCreditUser(user: {
    id: number;
    name: string;
    isActive: boolean;
  }) {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([{ user }]);
    userActivityLogRepository.find.mockResolvedValue([
      { user: { id: user.id } },
    ]);
  }

  it('assigns App-New leads to credit with no age threshold (leadType 4)', async () => {
    stubEligibleCreditUser({ id: 1, name: 'Credit One', isActive: true });
    const lead = { id: 100, screenerAssignedTo: null };
    leadRepository.find.mockResolvedValue([lead]);

    const band = AllocateLeadsAndApplicationService.BANDS[1];
    const result = await service.runBand(band);

    expect(result).toEqual({ assigned: 1 });
    const [{ where }] = leadRepository.find.mock.calls[0];
    expect(where.createdAt).toBeUndefined();
    expect(lead.creditAssignedTo).toEqual({
      id: 1,
      name: 'Credit One',
      isActive: true,
    });
    expect(lead.screenerAssignedTo).toEqual({
      id: 1,
      name: 'Credit One',
      isActive: true,
    });
  });

  it('filters App-Hold leads by 72h-stale creditAssignedAt (leadType 6)', async () => {
    stubEligibleCreditUser({ id: 1, name: 'Credit One', isActive: true });
    leadRepository.find.mockResolvedValue([]);

    const band = AllocateLeadsAndApplicationService.BANDS[2];
    await service.runBand(band);

    const [{ where }] = leadRepository.find.mock.calls[0];
    expect(where.creditAssignedAt).toBeDefined();
    expect(where.leadStatus.id.value).toEqual([applicationHoldStatus.id]);
  });

  it('matches the 42+REPEAT band via the multi-row stageCode=S1 lookup', async () => {
    stubEligibleCreditUser({ id: 1, name: 'Credit One', isActive: true });
    leadRepository.find.mockResolvedValue([]);

    const band = AllocateLeadsAndApplicationService.BANDS[4];
    await service.runBand(band);

    const [{ where }] = leadRepository.find.mock.calls[0];
    expect(where.leadStatus.id.value).toEqual(partialStatuses.map((s) => s.id));
    expect(where.userType).toBe(LeadUserType.REPEAT);
    expect(where.createdAt).toBeDefined();
  });

  it('uses a dynamic per-user cap (floor(leads/users)) for leadType 3/6 bands', async () => {
    roleTypeRepository.findOne.mockResolvedValue(screenerRole);
    const userA = { id: 1, name: 'A', isActive: true };
    const userB = { id: 2, name: 'B', isActive: true };
    userRoleRepository.find.mockResolvedValue([
      { user: userA },
      { user: userB },
    ]);
    userActivityLogRepository.find.mockResolvedValue([
      { user: { id: userA.id } },
      { user: { id: userB.id } },
    ]);
    const leads = [1, 2, 3, 4, 5].map((id) => ({
      id,
      screenerAssignedTo: null,
    }));
    leadRepository.find.mockResolvedValue(leads);

    const band = AllocateLeadsAndApplicationService.BANDS[0];
    const result = await service.runBand(band);

    expect(result).toEqual({ assigned: 4 });
  });

  it('excludes active users who have not logged in today', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    const loggedIn = { id: 1, name: 'Logged In', isActive: true };
    const notLoggedIn = { id: 2, name: 'Not Logged In', isActive: true };
    userRoleRepository.find.mockResolvedValue([
      { user: loggedIn },
      { user: notLoggedIn },
    ]);
    userActivityLogRepository.find.mockResolvedValue([
      { user: { id: loggedIn.id } },
    ]);
    const lead = { id: 1, screenerAssignedTo: null };
    leadRepository.find.mockResolvedValue([lead]);

    const band = AllocateLeadsAndApplicationService.BANDS[1];
    await service.runBand(band);

    expect(lead.creditAssignedTo).toEqual(loggedIn);
  });

  it('no-ops when no eligible user has logged in today', async () => {
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'Nobody', isActive: true } },
    ]);
    userActivityLogRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([
      { id: 1, screenerAssignedTo: null },
    ]);

    const band = AllocateLeadsAndApplicationService.BANDS[1];
    const result = await service.runBand(band);

    expect(result).toEqual({ assigned: 0 });
  });
});
