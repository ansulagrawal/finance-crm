import { RepaymentReminderEmailService } from './repayment-reminder-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('RepaymentReminderEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let masterStatusRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: RepaymentReminderEmailService;

  beforeEach(() => {
    masterStatusRepository = repo();
    camRepository = repo();
    collectionRepository = repo();
    loanRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({}) };
    configService = { get: (_key: string, fallback?: string) => fallback };

    service = new RepaymentReminderEmailService(
      jobRunner as never,
      masterStatusRepository as never,
      camRepository as never,
      collectionRepository as never,
      loanRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules all 5 day-offset buckets (5 down to 1, no day-0) on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledTimes(5);
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'repayment-reminder-email-1-day',
      '0 9 * * *',
      expect.any(Function),
    );
  });

  it('buckets are exact day offsets 5..1, not a cumulative range and no day-0 (not scheduled in production)', () => {
    expect(
      RepaymentReminderEmailService.BUCKETS.map((b) => b.daysBefore),
    ).toEqual([5, 4, 3, 2, 1]);
  });

  it('no-ops when DISBURSED/PART-PAYMENT statuses are missing', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const result = await service.runBucket(
      RepaymentReminderEmailService.BUCKETS[0],
    );
    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
    expect(camRepository.find).not.toHaveBeenCalled();
  });

  it('excludes loans with a pending (unverified) collection entry', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const lead = { id: 1 };
    camRepository.find.mockResolvedValue([{ lead }]);
    collectionRepository.find.mockResolvedValue([{ lead }]);

    const result = await service.runBucket(
      RepaymentReminderEmailService.BUCKETS[4],
    );
    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
  });

  it('sends via /email/send for eligible borrowers in a bucket', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }, { id: 19 }]);
    camRepository.find.mockResolvedValue([
      {
        lead: { id: 1, email: 'a@example.com', firstName: 'A' },
        repaymentAmount: 5000,
        repaymentDate: '2026-07-20',
      },
      {
        lead: { id: 2, email: 'b@example.com', firstName: 'B' },
        repaymentAmount: 6000,
        repaymentDate: '2026-07-20',
      },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    loanRepository.find.mockResolvedValue([
      { lead: { id: 1 }, loanNumber: 'LN-1' },
      { lead: { id: 2 }, loanNumber: 'LN-2' },
    ]);

    const result = await service.runBucket(
      RepaymentReminderEmailService.BUCKETS[0],
    );

    expect(result).toEqual({ found: 2, notified: 2, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({
        leadId: 1,
        email: 'a@example.com',
        subject: expect.stringContaining('LN-1'),
      }),
    );
  });

  it('counts a failed send without stopping the rest of the batch', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    camRepository.find.mockResolvedValue([
      {
        lead: { id: 1, email: 'a@example.com', firstName: 'A' },
        repaymentAmount: 5000,
        repaymentDate: '2026-07-20',
      },
      {
        lead: { id: 2, email: 'b@example.com', firstName: 'B' },
        repaymentAmount: 6000,
        repaymentDate: '2026-07-20',
      },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    loanRepository.find.mockResolvedValue([
      { lead: { id: 1 }, loanNumber: 'LN-1' },
      { lead: { id: 2 }, loanNumber: 'LN-2' },
    ]);
    integrationsApiClient.post
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({});

    const result = await service.runBucket(
      RepaymentReminderEmailService.BUCKETS[0],
    );
    expect(result).toEqual({ found: 2, notified: 1, failed: 1 });
  });
});
