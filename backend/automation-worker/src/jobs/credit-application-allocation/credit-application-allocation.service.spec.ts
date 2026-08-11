import { LeadUserType } from '@finance-crm/database';
import { In } from 'typeorm';
import { CreditApplicationAllocationService } from './credit-application-allocation.service';

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

describe('CreditApplicationAllocationService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let userRoleRepository: ReturnType<typeof repo>;
  let roleTypeRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: CreditApplicationAllocationService;

  const applicationNewStatus = {
    id: 1,
    name: 'APPLICATION-NEW',
    stageCode: 'S4',
  };
  const applicationInProcessStatus = {
    id: 2,
    name: 'APPLICATION-INPROCESS',
    stageCode: 'S5',
  };
  const creditRole = { id: 6, code: 'CR2' };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 1, 10, 0));

    leadRepository = repo();
    masterStatusRepository = repo();
    userRoleRepository = repo();
    roleTypeRepository = repo();
    leadFollowupRepository = repo();

    service = new CreditApplicationAllocationService(
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

  it('schedules all three bands on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledTimes(3);
  });

  it('assigns applications to the least-loaded active CR2 user and backfills a missing screener', async () => {
    masterStatusRepository.find.mockResolvedValue([applicationNewStatus]);
    masterStatusRepository.findOne.mockResolvedValue(
      applicationInProcessStatus,
    );
    roleTypeRepository.findOne.mockResolvedValue(creditRole);

    const creditUser = { id: 300, name: 'Credit Officer', isActive: true };
    userRoleRepository.find.mockResolvedValue([{ user: creditUser }]);

    const lead = {
      id: 7,
      userType: LeadUserType.NEW,
      monthlySalaryAmount: 60000,
      screenerAssignedTo: null,
    };
    leadRepository.find.mockResolvedValue([lead]);

    const result = await service.runBand(
      CreditApplicationAllocationService.BANDS[0],
    );

    expect(result).toEqual({ assigned: 1 });
    expect(lead.creditAssignedTo).toBe(creditUser);
    expect(lead.screenerAssignedTo).toBe(creditUser);
    expect(lead.leadStatus).toBe(applicationInProcessStatus);
  });

  it('does not overwrite an existing screener assignment', async () => {
    masterStatusRepository.find.mockResolvedValue([applicationNewStatus]);
    masterStatusRepository.findOne.mockResolvedValue(
      applicationInProcessStatus,
    );
    roleTypeRepository.findOne.mockResolvedValue(creditRole);
    userRoleRepository.find.mockResolvedValue([
      { user: { id: 1, name: 'CR', isActive: true } },
    ]);

    const existingScreener = { id: 99 };
    const lead = {
      id: 7,
      monthlySalaryAmount: 60000,
      screenerAssignedTo: existingScreener,
    };
    leadRepository.find.mockResolvedValue([lead]);

    await service.runBand(CreditApplicationAllocationService.BANDS[0]);

    expect(lead.screenerAssignedTo).toBe(existingScreener);
  });

  it('queries both S1 and S4 stages for the REPEAT band', async () => {
    masterStatusRepository.find.mockResolvedValue([]);

    await service.runBand(CreditApplicationAllocationService.BANDS[2]);

    const [{ where }] = masterStatusRepository.find.mock.calls[0];
    expect(where.stageCode).toEqual(In(['S1', 'S4']));
  });
});
