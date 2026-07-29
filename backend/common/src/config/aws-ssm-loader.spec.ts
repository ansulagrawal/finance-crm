import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
  mock,
} from 'bun:test';

describe('awsSsmLoader', () => {
  const originalEnv = { ...process.env };
  let sendMock: jest.Mock;

  beforeEach(() => {
    sendMock = jest.fn();
    mock.module('@aws-sdk/client-ssm', () => ({
      SSMClient: class {
        send = sendMock;
      },
      GetParametersByPathCommand: class {
        constructor(public input: unknown) {}
      },
    }));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function load() {
    const { awsSsmLoader } = await import('./aws-ssm-loader');
    return awsSsmLoader();
  }

  it('returns an empty object when no parameter path is configured', async () => {
    process.env.AWS_SSM_PARAMETER_PATH = '';

    const result = await load();

    expect(result).toEqual({});
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('strips the path prefix from parameter names', async () => {
    process.env.AWS_SSM_PARAMETER_PATH = '/finance-crm/prod/';
    sendMock.mockResolvedValue({
      Parameters: [
        { Name: '/finance-crm/prod/DB_PASSWORD', Value: 'secret' },
        { Name: '/finance-crm/prod/PORT', Value: '3000' },
      ],
    });

    const result = await load();

    expect(result).toEqual({ DB_PASSWORD: 'secret', PORT: '3000' });
  });

  it('follows NextToken pagination across multiple pages', async () => {
    process.env.AWS_SSM_PARAMETER_PATH = '/finance-crm/prod/';
    sendMock
      .mockResolvedValueOnce({
        Parameters: [{ Name: '/finance-crm/prod/FOO', Value: 'a' }],
        NextToken: 'page-2',
      })
      .mockResolvedValueOnce({
        Parameters: [{ Name: '/finance-crm/prod/BAR', Value: 'b' }],
      });

    const result = await load();

    expect(result).toEqual({ FOO: 'a', BAR: 'b' });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('falls through to an empty object when the fetch throws', async () => {
    process.env.AWS_SSM_PARAMETER_PATH = '/finance-crm/prod/';
    sendMock.mockRejectedValue(new Error('no credentials'));

    const result = await load();

    expect(result).toEqual({});
  });
});
