import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  VENDOR_CALLBACK_TOKEN_HEADER,
  VendorCallbackTokenGuard,
} from './vendor-callback-token.guard';

const TOKEN = 'a'.repeat(48);

function context(request: {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, query: {}, ...request }),
    }),
  } as never;
}

function guard(configured: string | undefined) {
  const configService = {
    get: jest.fn().mockReturnValue(configured),
  } as unknown as ConfigService;
  return new VendorCallbackTokenGuard(configService);
}

describe('VendorCallbackTokenGuard', () => {
  it('fails closed when no token is configured', () => {
    expect(() => guard(undefined).canActivate(context({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the token from the header', () => {
    expect(
      guard(TOKEN).canActivate(
        context({ headers: { [VENDOR_CALLBACK_TOKEN_HEADER]: TOKEN } }),
      ),
    ).toBe(true);
  });

  it('accepts the token from the query string', () => {
    expect(guard(TOKEN).canActivate(context({ query: { token: TOKEN } }))).toBe(
      true,
    );
  });

  it('rejects a wrong token', () => {
    expect(() =>
      guard(TOKEN).canActivate(
        context({
          headers: { [VENDOR_CALLBACK_TOKEN_HEADER]: 'b'.repeat(48) },
        }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a token of a different length without throwing from timingSafeEqual', () => {
    expect(() =>
      guard(TOKEN).canActivate(
        context({ headers: { [VENDOR_CALLBACK_TOKEN_HEADER]: 'short' } }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a request with no token at all', () => {
    expect(() => guard(TOKEN).canActivate(context({}))).toThrow(
      UnauthorizedException,
    );
  });
});
