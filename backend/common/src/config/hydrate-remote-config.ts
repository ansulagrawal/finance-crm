import { Logger } from '@nestjs/common';
import { awsSecretsLoader } from './aws-secrets-loader';
import { awsSsmLoader } from './aws-ssm-loader';

const logger = new Logger('RemoteConfig');

/**
 * Copies every SSM/Secrets-Manager value into `process.env` BEFORE
 * `NestFactory.create` runs. Call it as the first statement of each service's
 * `bootstrap()`.
 *
 * Why this exists, rather than relying on `ConfigModule.forRoot({ load })`
 * alone: Nest resolves providers module by module, and a module whose
 * `useFactory` injects `ConfigService` can be instantiated BEFORE
 * ConfigModule's own async `load` factories have resolved. That never shows
 * up locally, because `.env` is parsed synchronously inside `forRoot()` — so
 * every key is already in `process.env` by the time any factory runs. It
 * shows up the moment a key exists ONLY in AWS: on the EC2 dev box,
 * `SharedAuthModule`'s factory ran first and `getOrThrow('JWT_ACCESS_SECRET')`
 * threw `Configuration key "JWT_ACCESS_SECRET" does not exist`, with
 * ConfigModule reporting initialization in +1ms — proof the remote fetch had
 * not happened yet.
 *
 * Hydrating `process.env` up front makes the ordering irrelevant: whenever a
 * factory asks, the value is already there.
 *
 * Precedence is preserved. dotenv does not overwrite variables that already
 * exist in `process.env`, so a value written here still beats the `.env`
 * file parsed later, and SSM still loses to Secrets Manager because it is
 * applied first. `ConfigModule.forRoot({ load: [...] })` is deliberately left
 * in place in every service — it re-reads the same two sources into Nest's
 * internal config, which is redundant but harmless, and keeps the documented
 * resolution chain true if this call is ever removed.
 *
 * Both loaders swallow their own failures and resolve to `{}`, so a box with
 * no AWS access falls straight through to `.env` exactly as before.
 */
export async function hydrateRemoteConfig(): Promise<void> {
  const [ssm, secrets] = await Promise.all([
    awsSsmLoader(),
    awsSecretsLoader(),
  ]);
  const merged = { ...ssm, ...secrets };
  const keys = Object.keys(merged);
  if (keys.length === 0) {
    return;
  }
  for (const key of keys) {
    process.env[key] = merged[key];
  }
  logger.log(`Hydrated ${keys.length} config keys into process.env`);
}
