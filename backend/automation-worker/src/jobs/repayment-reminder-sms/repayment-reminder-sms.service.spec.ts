import { RepaymentReminderSmsService } from './repayment-reminder-sms.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('RepaymentReminderSmsService', () => {
  const jobRunner = { schedule: jest.fn() };
  let masterStatusRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let service: RepaymentReminderSmsService;

  beforeEach(() => {
    masterStatusRepository = repo();
    camRepository = repo();
    loanRepository = repo();
    leadCustomerRepository = repo();
    collectionRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({ id: 1 }) };

    service = new RepaymentReminderSmsService(
      jobRunner as never,
      masterStatusRepository as never,
      camRepository as never,
      loanRepository as never,
      leadCustomerRepository as never,
      collectionRepository as never,
      integrationsApiClient as never,
    );
  });

  it('schedules all 5 day-offset buckets (5 down to 1, no day-0) on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledTimes(5);
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'repayment-reminder-sms-1-day',
      '30 9 * * *',
      expect.any(Function),
    );
  });

  it('buckets are exact day offsets 5..1, matching the real production crontab', () => {
    expect(
      RepaymentReminderSmsService.BUCKETS.map((b) => b.daysBefore),
    ).toEqual([5, 4, 3, 2, 1]);
  });

  it('no-ops when DISBURSED/PART-PAYMENT statuses are missing', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const result = await service.runBucket(
      RepaymentReminderSmsService.BUCKETS[0],
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
      RepaymentReminderSmsService.BUCKETS[4],
    );
    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
  });

  it('sends the real Waiver-discount SMS via /sms/send to the primary mobile only', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }, { id: 19 }]);
    camRepository.find.mockResolvedValue([
      {
        lead: { id: 1 },
        repaymentAmount: 5000,
        recommendedLoanAmount: 10000,
        repaymentDate: '2026-07-20',
      },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    loanRepository.find.mockResolvedValue([
      { lead: { id: 1 }, loanNumber: 'LN-1' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([
      {
        lead: { id: 1 },
        mobile: '9000000001',
        alternateMobile: '9000000002',
      },
    ]);

    const bucket = RepaymentReminderSmsService.BUCKETS[0]; // daysBefore = 5
    const result = await service.runBucket(bucket);

    expect(result).toEqual({ found: 1, notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledTimes(1);
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/sms/send',
      expect.objectContaining({
        leadId: 1,
        mobile: '9000000001',
        templateId: '1707177191819066667',
        message: expect.stringContaining('waiver'),
      }),
    );
    // discount = (10000 * 5) / 100 = 500
    const [, body] = integrationsApiClient.post.mock.calls[0];
    expect((body as { message: string }).message).toContain('500');
  });

  it('skips a lead with no LeadCustomer.mobile on file', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    camRepository.find.mockResolvedValue([
      {
        lead: { id: 1 },
        repaymentAmount: 5000,
        recommendedLoanAmount: 10000,
      },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    loanRepository.find.mockResolvedValue([
      { lead: { id: 1 }, loanNumber: 'LN-1' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead: { id: 1 }, mobile: null },
    ]);

    const result = await service.runBucket(
      RepaymentReminderSmsService.BUCKETS[0],
    );

    expect(result).toEqual({ found: 1, notified: 0, failed: 0 });
    expect(integrationsApiClient.post).not.toHaveBeenCalled();
  });

  it('counts a failed send without stopping the rest of the batch', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    camRepository.find.mockResolvedValue([
      {
        lead: { id: 1 },
        repaymentAmount: 5000,
        recommendedLoanAmount: 10000,
      },
      {
        lead: { id: 2 },
        repaymentAmount: 6000,
        recommendedLoanAmount: 12000,
      },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    loanRepository.find.mockResolvedValue([
      { lead: { id: 1 }, loanNumber: 'LN-1' },
      { lead: { id: 2 }, loanNumber: 'LN-2' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead: { id: 1 }, mobile: '9000000001' },
      { lead: { id: 2 }, mobile: '9000000002' },
    ]);
    integrationsApiClient.post
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({});

    const result = await service.runBucket(
      RepaymentReminderSmsService.BUCKETS[0],
    );
    expect(result).toEqual({ found: 2, notified: 1, failed: 1 });
  });
});
