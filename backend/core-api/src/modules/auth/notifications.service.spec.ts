import type { IntegrationsApiClient } from '@finance-crm/common';
import type { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

function build(config: Record<string, string> = {}) {
  const post = jest.fn().mockResolvedValue({});
  const configService = {
    get: (key: string, fallback?: unknown) => config[key] ?? fallback,
  } as unknown as ConfigService;
  const service = new NotificationsService(configService, {
    post,
  } as unknown as IntegrationsApiClient);
  return { service, post };
}

describe('NotificationsService.sendPasswordResetOtp', () => {
  it('dispatches to integrations-api with the OTP and request context', async () => {
    const { service, post } = build();

    await service.sendPasswordResetOtp('staff@financecrm.com', '123456', {
      name: 'Priya Sharma',
      ipAddress: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    });

    expect(post).toHaveBeenCalledWith('/email/password-reset-otp', {
      email: 'staff@financecrm.com',
      name: 'Priya Sharma',
      otp: '123456',
      ipAddress: '203.0.113.9',
      userAgent: 'Mozilla/5.0',
    });
  });

  it('omits ipAddress/userAgent rather than sending empty strings', async () => {
    // The DTO treats them as optional; sending '' would render an empty row in
    // the email instead of the "Not available" placeholder.
    const { service, post } = build();

    await service.sendPasswordResetOtp('a@b.com', '111111', { name: 'A' });

    expect(post.mock.calls[0][1]).not.toHaveProperty('ipAddress');
    expect(post.mock.calls[0][1]).not.toHaveProperty('userAgent');
  });

  it('falls back to the email as the display name when none is known', async () => {
    const { service, post } = build();

    await service.sendPasswordResetOtp('a@b.com', '111111', { name: '' });

    expect(post.mock.calls[0][1].name).toBe('a@b.com');
  });

  it('does NOT throw when delivery fails', async () => {
    // requestPasswordReset returns the same generic response whether or not the
    // address exists — surfacing a transport error would leak account
    // existence, and the OTP row is already committed either way.
    const { service } = build();
    const failing = new NotificationsService(
      { get: (_k: string, f?: unknown) => f } as unknown as ConfigService,
      {
        post: jest.fn().mockRejectedValue(new Error('smtp down')),
      } as unknown as IntegrationsApiClient,
    );

    await expect(
      failing.sendPasswordResetOtp('a@b.com', '111111', { name: 'A' }),
    ).resolves.toBeUndefined();
    // Sanity: the happy path also resolves void.
    await expect(
      service.sendPasswordResetOtp('a@b.com', '111111', { name: 'A' }),
    ).resolves.toBeUndefined();
  });

  it('never logs the OTP unless AUTH_OTP_DEBUG_LOG is explicitly on', async () => {
    // The OTP is the sole factor guarding a password reset, and logs reach far
    // more people than a staff mailbox does.
    const { service } = build();
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: (m: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await service.sendPasswordResetOtp('a@b.com', '654321', { name: 'A' });

    expect(warn).not.toHaveBeenCalled();
  });

  it('logs the OTP only when AUTH_OTP_DEBUG_LOG=true, and still sends', async () => {
    const { service, post } = build({ AUTH_OTP_DEBUG_LOG: 'true' });
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: (m: string) => void } })
          .logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    await service.sendPasswordResetOtp('a@b.com', '654321', { name: 'A' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('654321'));
    // Debug logging is additive — it must not replace delivery.
    expect(post).toHaveBeenCalled();
  });
});
