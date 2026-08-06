import { AccountAggregatorProvider, ApiCallStatus } from '@finance-crm/database';
import { AccountAggregatorCallbackController } from './account-aggregator-callback.controller';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    ...overrides,
  };
}

describe('AccountAggregatorCallbackController', () => {
  it('ignores a callback with no requestId', async () => {
    const logRepository = repo();
    const accountAggregatorService = { downloadNpReport: jest.fn() };
    const controller = new AccountAggregatorCallbackController(
      logRepository as never,
      accountAggregatorService as never,
    );

    const result = await controller.handleNpCallback({});

    expect(result.status).toContain('ignored');
    expect(logRepository.save).not.toHaveBeenCalled();
  });

  it('ignores a callback when no matching consent request log exists', async () => {
    const logRepository = repo({ findOne: jest.fn().mockResolvedValue(null) });
    const accountAggregatorService = { downloadNpReport: jest.fn() };
    const controller = new AccountAggregatorCallbackController(
      logRepository as never,
      accountAggregatorService as never,
    );

    const result = await controller.handleNpCallback({
      requestId: 'req-1',
    });

    expect(result.status).toContain('ignored');
  });

  it('writes a CONSENT_STATUS log row chained off the matching consent request, without downloading if not processed', async () => {
    const lead = { id: 1 };
    const logRepository = repo({
      findOne: jest.fn().mockResolvedValue({ lead, consentHandleId: 'req-1' }),
    });
    const accountAggregatorService = { downloadNpReport: jest.fn() };
    const controller = new AccountAggregatorCallbackController(
      logRepository as never,
      accountAggregatorService as never,
    );

    await controller.handleNpCallback({
      requestId: 'req-1',
      docId: 'DOC1',
      status: 'Pending',
    });

    expect(logRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lead,
        provider: AccountAggregatorProvider.NOVEL_PATTERN,
        docId: 'DOC1',
        status: ApiCallStatus.SUCCESS,
      }),
    );
    expect(accountAggregatorService.downloadNpReport).not.toHaveBeenCalled();
  });

  it('downloads the report when status is Processed', async () => {
    const lead = { id: 1 };
    const logRepository = repo({
      findOne: jest.fn().mockResolvedValue({ lead, consentHandleId: 'req-1' }),
    });
    const accountAggregatorService = { downloadNpReport: jest.fn() };
    const controller = new AccountAggregatorCallbackController(
      logRepository as never,
      accountAggregatorService as never,
    );

    await controller.handleNpCallback({
      requestId: 'req-1',
      docId: 'DOC1',
      status: 'Processed',
      reportFileName: 'report.json',
    });

    expect(accountAggregatorService.downloadNpReport).toHaveBeenCalledWith(
      lead,
      'DOC1',
      'report.json',
    );
  });
});
