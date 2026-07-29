import type { ConfigService } from '@nestjs/config';
import { assertStrongSecrets } from './assert-secrets';

function config(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const STRONG = 'f'.repeat(64);

describe('assertStrongSecrets', () => {
  it('passes a strong secret', () => {
    expect(() =>
      assertStrongSecrets(config({ JWT_ACCESS_SECRET: STRONG }), [
        'JWT_ACCESS_SECRET',
      ]),
    ).not.toThrow();
  });

  it('refuses to start on the .env.example placeholder', () => {
    expect(() =>
      assertStrongSecrets(config({ JWT_ACCESS_SECRET: 'changeme' }), [
        'JWT_ACCESS_SECRET',
      ]),
    ).toThrow(/placeholder/);
  });

  it('refuses a secret that is present but too short', () => {
    expect(() =>
      assertStrongSecrets(config({ JWT_ACCESS_SECRET: 'abc123' }), [
        'JWT_ACCESS_SECRET',
      ]),
    ).toThrow(/at least 32/);
  });

  it('refuses a missing secret', () => {
    expect(() =>
      assertStrongSecrets(config({}), ['JWT_ACCESS_SECRET']),
    ).toThrow(/is not set/);
  });

  it('reports every problem at once rather than one per restart', () => {
    expect(() =>
      assertStrongSecrets(
        config({ JWT_ACCESS_SECRET: 'changeme', INTERNAL_SERVICE_SECRET: '' }),
        ['JWT_ACCESS_SECRET', 'INTERNAL_SERVICE_SECRET'],
      ),
    ).toThrow(/JWT_ACCESS_SECRET.*INTERNAL_SERVICE_SECRET/s);
  });

  it('only warns in development, so local work against .env.example runs', () => {
    expect(() =>
      assertStrongSecrets(
        config({ JWT_ACCESS_SECRET: 'changeme', NODE_ENV: 'development' }),
        ['JWT_ACCESS_SECRET'],
      ),
    ).not.toThrow();
  });

  it('checks only the names it is given', () => {
    // reporting-api is never an internal-request receiver and legitimately
    // has no INTERNAL_SERVICE_SECRET.
    expect(() =>
      assertStrongSecrets(config({ JWT_ACCESS_SECRET: STRONG }), [
        'JWT_ACCESS_SECRET',
      ]),
    ).not.toThrow();
  });
});
