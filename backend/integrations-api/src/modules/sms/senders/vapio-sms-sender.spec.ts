import { of, throwError } from 'rxjs';
import { VapioSmsSender } from './vapio-sms-sender';

describe('VapioSmsSender', () => {
  let post: jest.Mock;
  let sender: VapioSmsSender;

  beforeEach(() => {
    post = jest.fn();
    const configValues: Record<string, string> = {
      VAPIO_USERNAME: 'test-user',
      VAPIO_API_KEY: 'test-key',
      VAPIO_SENDER_ID: 'TESTID',
      VAPIO_PE_ID: '1234567890',
    };
    const config = {
      get: (_key: string, fallback?: string) => fallback,
      getOrThrow: (key: string) => {
        if (key in configValues) return configValues[key];
        throw new Error(`Unexpected config key: ${key}`);
      },
    };
    sender = new VapioSmsSender({ post } as never, config as never);
  });

  it('posts the real Vapio request shape to the real endpoint', async () => {
    post.mockReturnValue(of({ data: { status: 'OK' } }));

    const result = await sender.send({
      mobile: '9999999999',
      message: '123456 is your OTP.',
      templateId: '1107176535879044251',
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://vapio.in/api.php?');
    expect(config).toEqual({
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const params = new URLSearchParams(body);
    expect(params.get('username')).toBe('test-user');
    expect(params.get('apikey')).toBe('test-key');
    expect(params.get('senderid')).toBe('TESTID');
    expect(params.get('route')).toBe('TRANS');
    expect(params.get('mobile')).toBe('9999999999');
    expect(params.get('TID')).toBe('1107176535879044251');
    expect(params.get('PEID')).toBe('1234567890');
    expect(params.get('format')).toBe('json');

    expect(result.success).toBe(true);
  });

  it('reports a non-network failure when Vapio does not return status=OK', async () => {
    post.mockReturnValue(of({ data: { status: 'FAIL' } }));

    const result = await sender.send({
      mobile: '9999999999',
      message: 'test',
      templateId: 'TID',
    });

    expect(result.success).toBe(false);
    expect(result.isNetworkError).toBe(false);
  });

  it('reports a network failure when the HTTP call itself fails', async () => {
    post.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

    const result = await sender.send({
      mobile: '9999999999',
      message: 'test',
      templateId: 'TID',
    });

    expect(result.success).toBe(false);
    expect(result.isNetworkError).toBe(true);
    expect(result.errorMessage).toContain('connect ECONNREFUSED');
  });
});
