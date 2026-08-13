import { OutstandingLoanDigestEmailService } from './outstanding-loan-digest-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('OutstandingLoanDigestEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let masterStatusRepository: ReturnType<typeof repo>;
  let camRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: OutstandingLoanDigestEmailService;

  beforeEach(() => {
    masterStatusRepository = repo();
    camRepository = repo();
    loanRepository = repo();
    collectionRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({}) };
    configService = {
      get: (key: string, fallback?: string) =>
        key === 'CTO_EMAIL' ? 'cto@example.com' : fallback,
    };

    service = new OutstandingLoanDigestEmailService(
      jobRunner as never,
      masterStatusRepository as never,
      camRepository as never,
      loanRepository as never,
      collectionRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules the once-daily job on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'outstanding-loan-digest-email',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when DISBURSED/PART-PAYMENT statuses are missing', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const result = await service.run();
    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
  });

  it('computes the late-penal-interest due amount and notifies CTO_EMAIL', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const lead = { id: 1, firstName: 'A' };
    const tenDaysAgo = new Date();
    tenDaysAgo.setHours(0, 0, 0, 0);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    camRepository.find.mockResolvedValue([
      {
        lead,
        recommendedLoanAmount: 10000,
        roi: 2,
        repaymentAmount: 10500,
        repaymentDate: tenDaysAgo,
      },
    ]);
    collectionRepository.find
      .mockResolvedValueOnce([]) // pending
      .mockResolvedValueOnce([{ lead, receivedAmount: 1000 }]); // verified
    loanRepository.find.mockResolvedValue([{ lead, loanNumber: 'LN-1' }]);

    const result = await service.run();

    // dpd=10, lateInterest = 10000*(2*2)*10/100 = 4000, totalDue=14500, final=13500
    expect(result).toEqual({ found: 1, notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({ leadId: 1, email: 'cto@example.com' }),
    );
  });

  it('excludes loans with a pending (unverified) collection entry', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const lead = { id: 1, firstName: 'A' };
    camRepository.find.mockResolvedValue([
      {
        lead,
        recommendedLoanAmount: 10000,
        roi: 2,
        repaymentAmount: 10500,
        repaymentDate: new Date(),
      },
    ]);
    collectionRepository.find.mockResolvedValueOnce([{ lead }]);

    const result = await service.run();
    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
  });

  it('skips sending (but still computes) when CTO_EMAIL is not configured', async () => {
    configService.get = (_key: string, fallback?: string) => fallback;
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const lead = { id: 1, firstName: 'A' };
    camRepository.find.mockResolvedValue([
      {
        lead,
        recommendedLoanAmount: 10000,
        roi: 2,
        repaymentAmount: 10500,
        repaymentDate: new Date(),
      },
    ]);
    collectionRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    loanRepository.find.mockResolvedValue([{ lead, loanNumber: 'LN-1' }]);

    const result = await service.run();
    expect(result).toEqual({ found: 1, notified: 0, failed: 0 });
    expect(integrationsApiClient.post).not.toHaveBeenCalled();
  });
});
