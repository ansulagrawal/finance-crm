import { NotContactableLeadEmailService } from './not-contactable-lead-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('NotContactableLeadEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let rejectionReasonRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: NotContactableLeadEmailService;

  const rejectStatus = { id: 9, name: 'REJECT' };
  const notContactableReasons = [
    { id: 7, reason: 'NOT CONTACTABLE' },
    { id: 31, reason: 'NOT CONTACTABLE' },
  ];

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    rejectionReasonRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({}) };
    configService = { get: (_key: string, fallback?: string) => fallback };

    service = new NotContactableLeadEmailService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      rejectionReasonRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules the once-daily job on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'not-contactable-lead-email',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when REJECT status or NOT CONTACTABLE reasons are missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
    expect(leadRepository.find).not.toHaveBeenCalled();
  });

  it('excludes emails already present on a lead in an active/successful status', async () => {
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.find.mockResolvedValue(notContactableReasons);
    masterStatusRepository.find.mockResolvedValue([
      { id: 14, name: 'DISBURSED' },
    ]);
    leadRepository.find
      .mockResolvedValueOnce([{ email: 'Keep@Example.com' }]) // excluded leads
      .mockResolvedValueOnce([
        { id: 1, email: 'keep@example.com' },
        { id: 2, email: 'fresh@example.com' },
      ]); // candidates

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({ leadId: 2, email: 'fresh@example.com' }),
    );
  });

  it('dedupes distinct emails case-insensitively', async () => {
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.find.mockResolvedValue(notContactableReasons);
    masterStatusRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([
      { id: 1, email: 'a@example.com' },
      { id: 2, email: 'A@Example.com' },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 0 });
  });

  it('counts a failed send without stopping the rest of the batch', async () => {
    masterStatusRepository.findOne.mockResolvedValue(rejectStatus);
    rejectionReasonRepository.find.mockResolvedValue(notContactableReasons);
    masterStatusRepository.find.mockResolvedValue([]);
    leadRepository.find.mockResolvedValue([
      { id: 1, email: 'a@example.com' },
      { id: 2, email: 'b@example.com' },
    ]);
    integrationsApiClient.post
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({});

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 1 });
  });
});
