import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

/**
 * `.env.example` ships `JWT_ACCESS_SECRET=changeme` and
 * `INTERNAL_SERVICE_SECRET=changeme`, and every consumer reads them via
 * `getOrThrow`, which only checks that a value is *present* — a deployment
 * that copied the example file verbatim boots perfectly happily on a secret
 * an attacker can guess in one try. For `JWT_ACCESS_SECRET` that is total
 * auth bypass (mint a token with `roles: ['SA']` for any `sub`); for
 * `INTERNAL_SERVICE_SECRET` it is SYSTEM identity on `integrations-api`,
 * which the gateway proxies publicly.
 *
 * So refuse to start. A service that will not boot on a placeholder secret
 * is a loud, immediate failure at deploy time; one that boots is a silent
 * hole nobody notices. `NODE_ENV=development` downgrades this to a warning
 * so local work against the example file keeps running.
 */

const MIN_SECRET_LENGTH = 32;

/** Values that are obviously not real secrets, regardless of length. */
const PLACEHOLDERS = new Set([
  'changeme',
  'change-me',
  'secret',
  'password',
  'test',
  'placeholder',
  'your-secret-here',
  'todo',
]);

function problemWith(name: string, value: string | undefined): string | null {
  if (!value) {
    return `${name} is not set`;
  }
  if (PLACEHOLDERS.has(value.trim().toLowerCase())) {
    return `${name} is still set to the placeholder value from .env.example`;
  }
  if (value.length < MIN_SECRET_LENGTH) {
    return `${name} is ${value.length} characters; at least ${MIN_SECRET_LENGTH} are required`;
  }
  return null;
}

/**
 * Call from every service's `bootstrap()` before `app.listen()`. `names` is
 * the set of secrets that service actually consumes — `reporting-api`, for
 * instance, is never an internal-request receiver and legitimately has no
 * `INTERNAL_SERVICE_SECRET`.
 */
export function assertStrongSecrets(
  config: ConfigService,
  names: string[],
): void {
  const logger = new Logger('AssertStrongSecrets');
  const problems = names
    .map((name) => problemWith(name, config.get<string>(name)))
    .filter((problem): problem is string => problem !== null);

  if (problems.length === 0) {
    return;
  }

  const message = `Refusing to start — insecure secret configuration: ${problems.join('; ')}. Generate one with \`openssl rand -hex 32\`.`;
  if (config.get<string>('NODE_ENV') === 'development') {
    logger.warn(
      message.replace('Refusing to start', 'Insecure for production'),
    );
    return;
  }
  throw new Error(message);
}
