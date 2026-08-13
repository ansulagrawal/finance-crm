import { ReloanPitchEmailService } from './reloan-pitch-email.service';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('ReloanPitchEmailService', () => {
  const jobRunner = { schedule: jest.fn() };
  let leadRepository: ReturnType<typeof repo>;
  let masterStatusRepository: ReturnType<typeof repo>;
  let collectionRepository: ReturnType<typeof repo>;
  let customerBlacklistRepository: ReturnType<typeof repo>;
  let integrationsApiClient: { post: jest.Mock };
  let configService: { get: jest.Mock };
  let service: ReloanPitchEmailService;

  const closedStatus = { id: 16, name: 'CLOSED' };
  const terminalStatuses = [
    { id: 8, name: 'SYSTEM-REJECT' },
    { id: 9, name: 'REJECT' },
    closedStatus,
  ];

  beforeEach(() => {
    leadRepository = repo();
    masterStatusRepository = repo();
    collectionRepository = repo();
    customerBlacklistRepository = repo();
    integrationsApiClient = { post: jest.fn().mockResolvedValue({}) };
    configService = { get: (_key: string, fallback?: string) => fallback };

    service = new ReloanPitchEmailService(
      jobRunner as never,
      leadRepository as never,
      masterStatusRepository as never,
      collectionRepository as never,
      customerBlacklistRepository as never,
      integrationsApiClient as never,
      configService as never,
    );
  });

  it('schedules the once-daily job on module init', () => {
    service.onModuleInit();
    expect(jobRunner.schedule).toHaveBeenCalledWith(
      'reloan-pitch-email',
      'disabled',
      expect.any(Function),
    );
  });

  it('no-ops when required master_statuses rows are missing', async () => {
    masterStatusRepository.findOne.mockResolvedValue(null);
    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
    expect(collectionRepository.find).not.toHaveBeenCalled();
  });

  it('excludes a closing lead with another non-terminal lead under the same PAN', async () => {
    masterStatusRepository.findOne.mockResolvedValue(closedStatus);
    masterStatusRepository.find.mockResolvedValue(terminalStatuses);
    const closingLead = {
      id: 1,
      pancard: 'ABCDE1234F',
      mobile: '9000000001',
      email: 'a@example.com',
      firstName: 'A',
    };
    collectionRepository.find.mockResolvedValue([{ lead: closingLead }]);
    leadRepository.find.mockResolvedValue([
      { pancard: 'ABCDE1234F', leadStatus: { id: 2 } }, // LEAD-INPROCESS - still active
    ]);
    customerBlacklistRepository.find.mockResolvedValue([]);

    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
  });

  it('pitches to a closing lead whose other same-PAN leads are all terminal and not blacklisted', async () => {
    masterStatusRepository.findOne.mockResolvedValue(closedStatus);
    masterStatusRepository.find.mockResolvedValue(terminalStatuses);
    const closingLead = {
      id: 1,
      pancard: 'ABCDE1234F',
      mobile: '9000000001',
      email: 'a@example.com',
      firstName: 'A',
    };
    collectionRepository.find.mockResolvedValue([{ lead: closingLead }]);
    leadRepository.find.mockResolvedValue([
      { pancard: 'ABCDE1234F', leadStatus: closedStatus },
    ]);
    customerBlacklistRepository.find.mockResolvedValue([]);

    const result = await service.run();
    expect(result).toEqual({ notified: 1, failed: 0 });
    expect(integrationsApiClient.post).toHaveBeenCalledWith(
      '/email/send',
      expect.objectContaining({ leadId: 1, email: 'a@example.com' }),
    );
  });

  it('excludes leads whose PAN has an active CustomerBlacklist entry', async () => {
    masterStatusRepository.findOne.mockResolvedValue(closedStatus);
    masterStatusRepository.find.mockResolvedValue(terminalStatuses);
    const closingLead = {
      id: 1,
      pancard: 'ABCDE1234F',
      mobile: '9000000001',
      email: 'a@example.com',
      firstName: 'A',
    };
    collectionRepository.find.mockResolvedValue([{ lead: closingLead }]);
    leadRepository.find.mockResolvedValue([
      { pancard: 'ABCDE1234F', leadStatus: closedStatus },
    ]);
    customerBlacklistRepository.find.mockResolvedValue([
      { pancard: 'ABCDE1234F' },
    ]);

    const result = await service.run();
    expect(result).toEqual({ notified: 0, failed: 0 });
  });
});
