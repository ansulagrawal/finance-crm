import { ClosedLoanFeedbackEmailService } from './closed-loan-feedback-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('ClosedLoanFeedbackEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: ClosedLoanFeedbackEmailService;

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({}) };
    configService = { get: (_key: string, fallback?: string) => fallback };

    service = new ClosedLoanFeedbackEmailService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules the once-daily job on module init (replacing legacy time-of-day cutoff)', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'closed-loan-feedback-email',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when the CLOSED master_statuses row is missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
    expect(leadRepository.find).not.toHaveBeenCalled();
  });

  it('dedupes closed-loan customers by lowercased email and sends via /email/send', async () => {
    masterStatusRepository.findOne.mockResolvedValue({
      id: 16,
      name: 'CLOSED',
    });
    leadRepository.find.mockResolvedValue([
      { id: 1, email: 'a@example.com', firstName: 'A' },
      { id: 2, email: 'A@Example.com', firstName: 'A' },
      { id: 3, email: null, firstName: 'C' },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({ leadId: 1, email: 'a@example.com' }),
    );
  });

  it('no-ops when no closed leads have an email', async () => {
    masterStatusRepository.findOne.mockResolvedValue({
      id: 16,
      name: 'CLOSED',
    });
    leadRepository.find.mockResolvedValue([
      { id: 1, email: null, firstName: 'A' },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
  });

  it('counts a failed send without stopping the rest of the batch', async () => {
    masterStatusRepository.findOne.mockResolvedValue({
      id: 16,
      name: 'CLOSED',
    });
    leadRepository.find.mockResolvedValue([
      { id: 1, email: 'a@example.com', firstName: 'A' },
      { id: 2, email: 'b@example.com', firstName: 'B' },
    ]);
    integrationsApiClient.post
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({});

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 1 });
  });
});
