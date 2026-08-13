import { BirthdayEmailService } from './birthday-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('BirthdayEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadCustomerRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: BirthdayEmailService;

  beforeEach(() => {
    leadCustomerRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({}) };
    configService = { get: (_key: string, fallback?: string) => fallback };
    service = new BirthdayEmailService(
      jobRunner as never,
      leadCustomerRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules the once-daily birthday job on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'birthday-email',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when no customer has a birthday today', async () => {
    const notToday = new Date();
    notToday.setDate(notToday.getDate() - 1);
    leadCustomerRepository.find.mockResolvedValue([
      {
        dob: notToday,
        lead: { id: 1, email: 'a@example.com', firstName: 'A' },
      },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
    expect(integrationsApiClient.post).not.toHaveBeenCalled();
  });

  it('sends via /email/send for customers whose dob matches today month/day', async () => {
    const today = new Date();
    const birthday = new Date(today);
    birthday.setFullYear(1990);

    leadCustomerRepository.find.mockResolvedValue([
      {
        dob: birthday,
        lead: { id: 5, email: 'Birthday@Example.com', firstName: 'Kim' },
      },
    ]);

    const result = await service.run();

    expect(result).toEqual({ notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({
        leadId: 5,
        email: 'birthday@example.com',
        subject: expect.stringContaining('Kim'),
      }),
    );
  });

  it('skips customers missing an email or first name', async () => {
    const today = new Date();
    leadCustomerRepository.find.mockResolvedValue([
      { dob: today, lead: { id: 1, email: null, firstName: 'Kim' } },
      { dob: today, lead: { id: 2, email: 'x@example.com', firstName: '' } },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
  });

  it('deduplicates by lead id', async () => {
    const today = new Date();
    leadCustomerRepository.find.mockResolvedValue([
      {
        dob: today,
        lead: { id: 9, email: 'dup@example.com', firstName: 'A' },
      },
      {
        dob: today,
        lead: { id: 9, email: 'dup@example.com', firstName: 'A' },
      },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 0 });
  });

  it('counts a failed send without stopping the rest of the batch', async () => {
    const today = new Date();
    leadCustomerRepository.find.mockResolvedValue([
      { dob: today, lead: { id: 1, email: 'a@example.com', firstName: 'A' } },
      { dob: today, lead: { id: 2, email: 'b@example.com', firstName: 'B' } },
    ]);
    integrationsApiClient.post
      .mockRejectedValueOnce(new Error('send failed'))
      .mockResolvedValueOnce({});

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 1 });
  });
});
