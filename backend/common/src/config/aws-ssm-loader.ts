import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { Logger } from '@nestjs/common';

const logger = new Logger('AwsSsmLoader');

/**
 * Parallel `ConfigModule` `load` stage alongside `awsSecretsLoader`: reads
 * flat key/value config from AWS Systems Manager Parameter Store, for
 * deployments that keep settings there instead of (or as well as) Secrets
 * Manager. Combine both via `ConfigModule.forRoot({ load: [awsSsmLoader,
 * awsSecretsLoader] })` - later entries in the `load` array win on a key
 * clash (see `awsSecretsLoader`'s doc comment for why), so Secrets Manager
 * (more likely to hold actual secrets) is listed last.
 *
 * `AWS_SSM_PARAMETER_PATH` (e.g. `/finance-crm/prod/`) selects the path read
 * recursively; each parameter name has that prefix stripped to produce the
 * config key (e.g. `/finance-crm/prod/DB_PASSWORD` -> `DB_PASSWORD`), so parameters
 * must already be stored using the same SCREAMING_SNAKE_CASE as `.env`
 * keys. `WithDecryption: true` so `SecureString` parameters resolve
 * transparently - the calling role's IAM policy needs `kms:Decrypt` for the
 * backing key in addition to `ssm:GetParametersByPath`.
 *
 * Same default-credential-provider-chain / never-throw contract as
 * `awsSecretsLoader`: unset path, missing credentials, or any fetch error
 * all resolve to `{}` rather than blocking boot.
 */
export async function awsSsmLoader(): Promise<Record<string, string>> {
  const path = process.env.AWS_SSM_PARAMETER_PATH;
  if (!path) {
    return {};
  }

  try {
    const client = new SSMClient({
      region: process.env.AWS_REGION || 'ap-south-1',
    });

    const result: Record<string, string> = {};
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new GetParametersByPathCommand({
          Path: path,
          Recursive: true,
          WithDecryption: true,
          NextToken: nextToken,
        }),
      );
      for (const param of response.Parameters ?? []) {
        if (!param.Name || param.Value === undefined) {
          continue;
        }
        const key = param.Name.startsWith(path)
          ? param.Name.slice(path.length)
          : param.Name;
        result[key] = param.Value;
      }
      nextToken = response.NextToken;
    } while (nextToken);

    logger.log(
      `Loaded ${Object.keys(result).length} settings from AWS SSM Parameter Store ("${path}")`,
    );
    return result;
  } catch (error) {
    logger.warn(
      `Falling back to .env - AWS SSM Parameter Store fetch failed for "${path}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {};
  }
}
