import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Logger } from '@nestjs/common';

const logger = new Logger('AwsSecretsLoader');

/**
 * Stage 1 of the AWS Secrets Manager -> .env -> crm_settings config chain
 * (see CLAUDE.md's architecture-decisions entry). Passed as a `ConfigModule
 * .forRoot({ load: [awsSecretsLoader] })` factory in every service's
 * AppModule.
 *
 * `ConfigModule.forRoot` parses `.env` into `process.env` BEFORE running
 * `load` factories, and `ConfigService.get()` checks values returned here
 * (the "internal config") before falling back to `process.env` - so a key
 * present in both sources only needs the AWS copy to win, no extra
 * precedence logic required here.
 *
 * Uses the SDK's default credential provider chain with NO explicit
 * accessKeyId/secretAccessKey - same pattern as `S3StorageAdapter` -
 * resolving to the EC2 instance profile in production via IAM role. Every
 * failure path (secret name unset, no credentials, secret not found,
 * malformed JSON) is NOT an error: it's the expected "no AWS in this
 * environment" case (e.g. local dev), so this always resolves to an object
 * rather than throwing, and boot falls through to `.env`.
 */
export async function awsSecretsLoader(): Promise<Record<string, string>> {
  const secretName = process.env.AWS_SECRETS_MANAGER_SECRET_NAME;
  if (!secretName) {
    return {};
  }

  try {
    const client = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'ap-south-1',
    });
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName }),
    );
    if (!response.SecretString) {
      return {};
    }

    const parsed: unknown = JSON.parse(response.SecretString);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger.warn(`Secret "${secretName}" is not a flat JSON object, ignoring`);
      return {};
    }

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      result[key] = String(value);
    }
    logger.log(
      `Loaded ${Object.keys(result).length} settings from AWS Secrets Manager ("${secretName}")`,
    );
    return result;
  } catch (error) {
    logger.warn(
      `Falling back to .env - AWS Secrets Manager fetch failed for "${secretName}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {};
  }
}
