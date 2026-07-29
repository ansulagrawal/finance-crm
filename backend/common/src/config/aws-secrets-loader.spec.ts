import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test';

describe('awsSecretsLoader', () => {
  const originalEnv = { ...process.env };
  let sendMock: jest.Mock;

  beforeEach(() => {
    sendMock = jest.fn();
    mock.module('@aws-sdk/client-secrets-manager', () => ({
      SecretsManagerClient: class {
        send = sendMock;
      },
      GetSecretValueCommand: class {
        constructor(public input: unknown) {}
      },
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function load() {
    const { awsSecretsLoader } = await import('./aws-secrets-loader');
    return awsSecretsLoader();
  }

  it('returns an empty object when no secret name is configured', async () => {
    process.env.AWS_SECRETS_MANAGER_SECRET_NAME = '';

    const result = await load();

    expect(result).toEqual({});
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns the parsed key/value pairs when the secret fetch succeeds', async () => {
    process.env.AWS_SECRETS_MANAGER_SECRET_NAME = 'finance-crm/prod';
    sendMock.mockResolvedValue({
      SecretString: JSON.stringify({ DB_PASSWORD: 'secret', PORT: 3000 }),
    });

    const result = await load();

    expect(result).toEqual({ DB_PASSWORD: 'secret', PORT: '3000' });
  });

  it('falls through to an empty object when the fetch throws', async () => {
    process.env.AWS_SECRETS_MANAGER_SECRET_NAME = 'finance-crm/prod';
    sendMock.mockRejectedValue(new Error('no credentials'));

    const result = await load();

    expect(result).toEqual({});
  });

  it('falls through to an empty object when the secret is not a flat JSON object', async () => {
    process.env.AWS_SECRETS_MANAGER_SECRET_NAME = 'finance-crm/prod';
    sendMock.mockResolvedValue({ SecretString: JSON.stringify([1, 2, 3]) });

    const result = await load();

    expect(result).toEqual({});
  });
});
