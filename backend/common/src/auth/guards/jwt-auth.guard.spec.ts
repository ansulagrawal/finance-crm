import { UnauthorizedException } from '@nestjs/common';
import { signInternalRequest } from '../internal-service-auth.util';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-shared-secret';

/** `getResponse`/`getNext` are needed by the real `AuthGuard('jwt')` base
 * implementation the fall-through test exercises — without them Passport
 * throws a bare `TypeError` from inside its own promise, which crashes the
 * jest worker instead of failing the assertion. */
function contextWith(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ setHeader: () => undefined, end: () => undefined }),
      getNext: () => undefined,
    }),
  } as never;
}

describe('JwtAuthGuard', () => {
  it('allows any request when @Public()', () => {
    const reflector = { getAllAndOverride: () => true } as never;
    const configService = { get: () => undefined } as never;
    const guard = new JwtAuthGuard(reflector, configService);

    expect(guard.canActivate(contextWith({}))).toBe(true);
  });

  it('authenticates a correctly-signed internal request and sets a synthetic system user', () => {
    const body = Buffer.from(JSON.stringify({ ok: true }));
    const { signature, timestamp } = signInternalRequest(
      'POST',
      '/api/v1/integrations/sms/send',
      body,
      SECRET,
    );
    const request = {
      method: 'POST',
      path: '/api/v1/integrations/sms/send',
      rawBody: body,
      headers: {
        'x-internal-signature': signature,
        'x-internal-timestamp': timestamp,
      },
    };
    const reflector = { getAllAndOverride: () => false } as never;
    const configService = { get: () => SECRET } as never;
    const guard = new JwtAuthGuard(reflector, configService);

    expect(guard.canActivate(contextWith(request))).toBe(true);
    expect(request).toHaveProperty('user', {
      sub: 0,
      email: 'system@internal',
      roles: ['SYSTEM'],
    });
  });

  it('rejects an internal request with an invalid signature', () => {
    const request = {
      method: 'POST',
      path: '/api/v1/integrations/sms/send',
      rawBody: Buffer.from('{}'),
      headers: {
        'x-internal-signature': 'not-a-real-signature',
        'x-internal-timestamp': String(Date.now()),
      },
    };
    const reflector = { getAllAndOverride: () => false } as never;
    const configService = { get: () => SECRET } as never;
    const guard = new JwtAuthGuard(reflector, configService);

    expect(() => guard.canActivate(contextWith(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an internal request when no secret is configured (fails closed, not a 500)', () => {
    const request = {
      method: 'POST',
      path: '/x',
      rawBody: Buffer.from('{}'),
      headers: {
        'x-internal-signature': 'whatever',
        'x-internal-timestamp': String(Date.now()),
      },
    };
    const reflector = { getAllAndOverride: () => false } as never;
    const configService = { get: () => undefined } as never;
    const guard = new JwtAuthGuard(reflector, configService);

    expect(() => guard.canActivate(contextWith(request))).toThrow(
      UnauthorizedException,
    );
  });

  it('falls through to the normal cookie-JWT check when no internal signature header is present', async () => {
    const request = { method: 'GET', path: '/x', headers: {} };
    const reflector = { getAllAndOverride: () => false } as never;
    const configService = { get: () => SECRET } as never;
    const guard = new JwtAuthGuard(reflector, configService);

    // No Passport strategy is wired up in this unit test, so the base
    // AuthGuard('jwt') implementation rejects when it can't authenticate -
    // that's expected here; the point is it does NOT take the internal
    // path, whose rejection carries an HMAC-specific message instead.
    await expect(
      Promise.resolve(guard.canActivate(contextWith(request))),
    ).rejects.not.toThrow(/internal service/i);
  });
});
