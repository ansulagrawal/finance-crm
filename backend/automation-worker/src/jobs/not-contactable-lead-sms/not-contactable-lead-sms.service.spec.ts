import { NotContactableLeadSmsService } from './not-contactable-lead-sms.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('NotContactableLeadSmsService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let rejectionReasonRepository: ReturnType<typeof repo>;
  let service: NotContactableLeadSmsService;

  const rejectStatus = { id: 9, name: 'REJECT' };
  const notContactableReasons = [
    { id: 7, reason: 'NOT CONTACTABLE' },
    { id: 31, reason: 'NOT CONTACTABLE' },
  ];

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    rejectionReasonRepository = repo();

    service = new NotContactableLeadSmsService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      rejectionReasonRepository as never,
    );
  });

  it('schedules the once-daily job on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'not-contactable-lead-sms',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when REJECT status or NOT CONTACTABLE reasons are missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.run();
    expect(result).toEqual({ notified: 0 });
    expect(leadRepository.find).not.toHaveBeenCalled();
  });

  it('excludes mobiles already present on a lead in an active/successful status', async () => {
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.find.mockResolvedValue(notContactableReasons);
    masterStatusRepository.find.mockResolvedValue([
      { id: 14, name: 'DISBURSED' },
    ]);
    leadRepository.find
      .mockResolvedValueOnce([{ mobile: '9000000001' }]) // excluded leads
      .mockResolvedValueOnce([
        { mobile: '9000000001' },
        { mobile: '9000000002' },
      ]); // candidates

    const result = await service.run();
    expect(result).toEqual({ notified: 1 });
  });

  it('dedupes distinct mobiles', async () => {
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.find.mockResolvedValue(notContactableReasons);
    masterStatusRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([
      { mobile: '9000000001' },
      { mobile: '9000000001' },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 1 });
  });
});
