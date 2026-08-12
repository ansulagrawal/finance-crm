import { LegalNoticeEmailService } from './legal-notice-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (x: unknown) => x),
    create: jest.fn((x: unknown) => x),
    ...overrides,
  };
}

describe('LegalNoticeEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let camRepository: ReturnType<typeof repo>;
  let loanRepository: ReturnType<typeof repo>;
  let leadCustomerRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let legalEmailLogRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: LegalNoticeEmailService;

  beforeEach(() => {
    camRepository = repo();
    loanRepository = repo();
    leadCustomerRepository = repo();
    collectionRepository = repo();
    masterStatusRepository = repo();
    legalEmailLogRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({ id: 1 }) };
    configService = { get: (_key: string, fallback?: string) => fallback };

    service = new LegalNoticeEmailService(
      jobRunner as never,
      camRepository as never,
      loanRepository as never,
      leadCustomerRepository as never,
      collectionRepository as never,
      masterStatusRepository as never,
      legalEmailLogRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules the 60-90 DPD bucket on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'legal-notice-email-60-90-dpd',
      '45 9 * * *',
      expect.any(Function),
    );
  });

  it('no-ops when DISBURSED/PART-PAYMENT statuses are missing', async () => {
    masterStatusRepository.find.mockResolvedValue([]);
    const result = await service.run();
    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
    expect(camRepository.find).not.toHaveBeenCalled();
  });

  it('returns all-zero when no CAMs fall in the bucket window', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    camRepository.find.mockResolvedValue([]);

    const result = await service.run();

    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
    expect(loanRepository.find).not.toHaveBeenCalled();
  });

  it('sends a real demand notice, nets verified collections, and logs a dedup row', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }, { id: 19 }]);
    const lead = { id: 1, email: 'a@example.com', firstName: 'Ramesh' };
    camRepository.find.mockResolvedValue([{ lead, repaymentAmount: 10000 }]);
    loanRepository.find.mockResolvedValue([{ lead, loanNumber: 'LN-1' }]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead, firstName: 'Ramesh', middleName: null, surName: 'Kumar' },
    ]);
    collectionRepository.find.mockResolvedValue([
      { lead, receivedAmount: 2000 },
    ]);
    legalEmailLogRepository.find.mockResolvedValue([]);

    const result = await service.run();

    expect(result).toEqual({ found: 1, notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({
        leadId: 1,
        email: 'a@example.com',
        cc: 'legal@financecrm.com',
        subject: expect.stringContaining('LN-1'),
        html: expect.stringContaining('8,000'), // 10000 - 2000
      }),
    );
    expect(legalEmailLogRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ loanNumber: 'LN-1', typeId: 1 }),
    );
  });

  it('skips a lead that already has a legal_email_logs row for this notice type', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const lead = { id: 1, email: 'a@example.com', firstName: 'Ramesh' };
    camRepository.find.mockResolvedValue([{ lead, repaymentAmount: 10000 }]);
    loanRepository.find.mockResolvedValue([{ lead, loanNumber: 'LN-1' }]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead, firstName: 'Ramesh' },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    legalEmailLogRepository.find.mockResolvedValue([{ lead }]);

    const result = await service.run();

    expect(result).toEqual({ found: 0, notified: 0, failed: 0 });
    expect(integrationsApiClient.post).not.toHaveBeenCalled();
  });

  it('counts a failed send without stopping the rest of the batch', async () => {
    masterStatusRepository.find.mockResolvedValue([{ id: 14 }]);
    const leadA = { id: 1, email: 'a@example.com', firstName: 'A' };
    const leadB = { id: 2, email: 'b@example.com', firstName: 'B' };
    camRepository.find.mockResolvedValue([
      { lead: leadA, repaymentAmount: 10000 },
      { lead: leadB, repaymentAmount: 20000 },
    ]);
    loanRepository.find.mockResolvedValue([
      { lead: leadA, loanNumber: 'LN-1' },
      { lead: leadB, loanNumber: 'LN-2' },
    ]);
    leadCustomerRepository.find.mockResolvedValue([
      { lead: leadA, firstName: 'A' },
      { lead: leadB, firstName: 'B' },
    ]);
    collectionRepository.find.mockResolvedValue([]);
    legalEmailLogRepository.find.mockResolvedValue([]);
    integrationsApiClient.post
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({ id: 2 });

    const result = await service.run();
    expect(result).toEqual({ found: 2, notified: 1, failed: 1 });
  });
});
