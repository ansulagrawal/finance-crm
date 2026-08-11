import { LeadRejectionService } from './lead-rejection.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('LeadRejectionService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let rejectionReasonRepository: ReturnType<typeof repo>;
  let leadFollowupRepository: ReturnType<typeof repo>;
  let service: LeadRejectionService;

  const rejectStatus = { id: 9, name: 'REJECT', stageCode: 'S9' };
  const rejectionReason = { id: 63, reason: 'TAT 90 HOURS COMPLETED' };

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    rejectionReasonRepository = repo();
    leadFollowupRepository = repo();

    service = new LeadRejectionService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      rejectionReasonRepository as never,
      leadFollowupRepository as never,
    );
  });

  it('schedules all three TAT rules on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledTimes(3);
  });

  it('no-ops when the stage statuses cannot be resolved', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const result = await service.runRule(LeadRejectionService.RULES[0]);
    expect(result).toEqual({ rejected: 0 });
    expect(leadRepository.find).not.toHaveBeenCalled();
  });

  it('no-ops when REJECT status or the seeded rejection reason is missing', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 2, stageCode: 'S2' }]);
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.runRule(LeadRejectionService.RULES[0]);
    expect(result).toEqual({ rejected: 0 });
  });

  it('rejects leads past the screener TAT threshold and writes a followup', async () => {
    masterStatusRepository.find.mockResolvedValue([
      { id: 2, stageCode: 'S2' },
      { id: 3, stageCode: 'S3' },
    ]);
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.findOne.mockResolvedValue(rejectionReason);

    const lead = { id: 55 };
    leadRepository.find.mockResolvedValue([lead]);

    const result = await service.runRule(LeadRejectionService.RULES[0]);

    expect(result).toEqual({ rejected: 1 });
    expect(lead.leadStatus).toBe(rejectStatus);
    expect(lead.rejectionReason).toBe(rejectionReason);
    expect(lead.rejectedAt).toBeInstanceOf(Date);
    expect(leadRepository.save).toHaveBeenCalledWith(lead);
    const [followupArg] = leadFollowupRepository.create.mock.calls[0];
    expect(followupArg.remarks).toBe('Auto Rejected - TAT 48 HOURS COMPLETED');
  });

  it('applies the correct threshold hours per rule in the followup remark', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 1, stageCode: 'S1' }]);
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.findOne.mockResolvedValue(rejectionReason);
    leadRepository.find.mockResolvedValue([{ id: 1 }]);

    await service.runRule(LeadRejectionService.RULES[1]);

    const [followupArg] = leadFollowupRepository.create.mock.calls[0];
    expect(followupArg.remarks).toBe('Auto Rejected - TAT 72 HOURS COMPLETED');
  });

  it('reject-application rule applies no hardcoded user restriction (queries by stage/TAT only)', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 5, stageCode: 'S5' }]);
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.findOne.mockResolvedValue(rejectionReason);
    leadRepository.find.mockResolvedValue([]);

    await service.runRule(LeadRejectionService.RULES[2]);

    const [{ where }] = leadRepository.find.mock.calls[0];
    expect(where).not.toHaveProperty('creditAssignedTo');
    expect(where.userType).toBe('NEW');
  });
});
