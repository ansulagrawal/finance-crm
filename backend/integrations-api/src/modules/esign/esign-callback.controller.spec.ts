import { ApiCallStatus } from '@finance-crm/database';
import { EsignCallbackController } from './esign-callback.controller';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: unknown) => x),
    ...overrides,
  };
}

describe('EsignCallbackController', () => {
  it('ignores a callback with no leadId', async () => {
    const esignLogRepository = repo();
    const controller = new EsignCallbackController(esignLogRepository as never);

    const result = await controller.handleCallback({});

    expect(result.status).toContain('ignored');
    expect(esignLogRepository.save).not.toHaveBeenCalled();
  });

  it('ignores a callback when no matching log exists for the lead', async () => {
    const esignLogRepository = repo({
      findOne: jest.fn().mockResolvedValue(null),
    });
    const controller = new EsignCallbackController(esignLogRepository as never);

    const result = await controller.handleCallback({ leadId: 404 });

    expect(result.status).toContain('ignored');
  });

  it('marks the latest log SUCCESS and stores the signed contract URL', async () => {
    const log = { id: 1, status: ApiCallStatus.PENDING, returnUrl: null };
    const esignLogRepository = repo({
      findOne: jest.fn().mockResolvedValue(log),
    });
    const controller = new EsignCallbackController(esignLogRepository as never);

    await controller.handleCallback({
      leadId: 1,
      finalSignedContract: 'https://example.com/signed.pdf',
    });

    expect(log.status).toBe(ApiCallStatus.SUCCESS);
    expect(log.returnUrl).toBe('https://example.com/signed.pdf');
    expect(esignLogRepository.save).toHaveBeenCalledWith(log);
  });
});
