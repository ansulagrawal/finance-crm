import { VideoKycCallbackController } from './video-kyc-callback.controller';

function repo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: unknown) => x),
    ...overrides,
  };
}

describe('VideoKycCallbackController', () => {
  function build(
    overrides: {
      callbackLogRepository?: ReturnType<typeof repo>;
      videoKycLogRepository?: ReturnType<typeof repo>;
      leadCustomerRepository?: ReturnType<typeof repo>;
      leadFollowupRepository?: ReturnType<typeof repo>;
    } = {},
  ) {
    const callbackLogRepository = overrides.callbackLogRepository ?? repo();
    const videoKycLogRepository = overrides.videoKycLogRepository ?? repo();
    const leadCustomerRepository = overrides.leadCustomerRepository ?? repo();
    const leadFollowupRepository = overrides.leadFollowupRepository ?? repo();
    const controller = new VideoKycCallbackController(
      callbackLogRepository as never,
      videoKycLogRepository as never,
      leadCustomerRepository as never,
      leadFollowupRepository as never,
    );
    return {
      controller,
      callbackLogRepository,
      videoKycLogRepository,
      leadCustomerRepository,
      leadFollowupRepository,
    };
  }

  it('ignores a callback missing requestId or status', async () => {
    const { controller, callbackLogRepository } = build();

    const result = await controller.handleCallback({});

    expect(result.status).toContain('ignored');
    expect(callbackLogRepository.save).not.toHaveBeenCalled();
  });

  it('logs the callback even when no matching lead exists', async () => {
    const { controller, callbackLogRepository, leadCustomerRepository } =
      build();

    const result = await controller.handleCallback({
      requestId: 'req-1',
      status: 'COMPLETED',
    });

    expect(callbackLogRepository.save).toHaveBeenCalledTimes(1);
    expect(leadCustomerRepository.save).not.toHaveBeenCalled();
    expect(result.status).toContain('logged without a matching lead');
  });

  it('flips vkyc flags on LeadCustomer and writes a followup on a matching lead', async () => {
    const lead = { id: 42, leadStatus: { id: 5 } };
    const customer = { id: 1, vkycFlag: false, vkycCompletedOn: null };
    const {
      controller,
      callbackLogRepository,
      leadCustomerRepository,
      leadFollowupRepository,
    } = build({
      videoKycLogRepository: repo({
        findOne: jest.fn().mockResolvedValue({ id: 7, lead }),
      }),
      leadCustomerRepository: repo({
        findOne: jest.fn().mockResolvedValue(customer),
      }),
    });

    const result = await controller.handleCallback({
      requestId: 'req-2',
      status: 'COMPLETED',
    });

    expect(callbackLogRepository.save).toHaveBeenCalledTimes(1);
    expect(customer.vkycFlag).toBe(true);
    expect(customer.vkycCompletedOn).toBeInstanceOf(Date);
    expect(leadCustomerRepository.save).toHaveBeenCalledWith(customer);
    expect(leadFollowupRepository.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ok');
  });

  it('resolves the lead from the originating session, never from the payload', async () => {
    // A payload-supplied leadId must not be able to select a lead: that was
    // the forged-KYC path. Only `requestId` -> VideoKycLog decides.
    const videoKycLogRepository = repo();
    const { controller, leadCustomerRepository } = build({
      videoKycLogRepository,
    });

    const result = await controller.handleCallback({
      leadId: 999,
      requestId: 'unknown-request',
      status: 'COMPLETED',
    } as never);

    expect(videoKycLogRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { requestId: 'unknown-request' } }),
    );
    expect(leadCustomerRepository.save).not.toHaveBeenCalled();
    expect(result.status).toContain('logged without a matching lead');
  });
});
