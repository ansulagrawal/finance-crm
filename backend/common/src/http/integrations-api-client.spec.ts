import { of } from 'rxjs';
import { verifyInternalSignature } from '../auth/internal-service-auth.util';
import { IntegrationsApiClient } from './integrations-api-client';

const SECRET = 'test-shared-secret';

describe('IntegrationsApiClient', () => {
  let httpPost: jest.Mock;
  let httpGet: jest.Mock;
  let client: IntegrationsApiClient;

  beforeEach(() => {
    httpPost = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    httpGet = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    const http = { post: httpPost, get: httpGet } as never;
    const config = {
      get: (_key: string, fallback?: string) => fallback,
      getOrThrow: () => SECRET,
    } as never;
    client = new IntegrationsApiClient(http, config);
  });

  it('signs a POST request with a verifiable signature over the exact bytes sent', async () => {
    await client.post('/sms/send', { leadId: 42 });

    const [url, sentBody, options] = httpPost.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/v1/integrations/sms/send');
    expect(typeof sentBody).toBe('string'); // pre-serialized, not re-serialized by axios
    const signature = options.headers['x-internal-signature'];
    const timestamp = options.headers['x-internal-timestamp'];

    expect(
      verifyInternalSignature(
        'POST',
        '/api/v1/integrations/sms/send',
        Buffer.from(sentBody, 'utf-8'),
        SECRET,
        signature,
        timestamp,
      ),
    ).toBe(true);
  });

  it('signs a GET request with an empty body', async () => {
    await client.get('/sms/logs');

    const [url, options] = httpGet.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/v1/integrations/sms/logs');
    const signature = options.headers['x-internal-signature'];
    const timestamp = options.headers['x-internal-timestamp'];

    expect(
      verifyInternalSignature(
        'GET',
        '/api/v1/integrations/sms/logs',
        Buffer.alloc(0),
        SECRET,
        signature,
        timestamp,
      ),
    ).toBe(true);
  });
});

describe('IntegrationsApiClient URL building', () => {
  const build = (baseUrl: string, path: string) => {
    const client = new IntegrationsApiClient(
      { post: () => undefined, get: () => undefined } as never,
      {
        get: () => baseUrl,
        getOrThrow: () => 'a'.repeat(32),
      } as never,
    );
    return (client as unknown as { buildUrl(p: string): string }).buildUrl(
      path,
    );
  };

  // The bug this covers: integrations-api mounts everything under
  // /api/v1/integrations, so a bare base 404s every call — and every caller
  // logs-and-swallows, so it presents as "no email arrived".
  it('adds the service prefix to a bare base url', () => {
    expect(build('http://integrations-api:3001', '/email/send')).toBe(
      'http://integrations-api:3001/api/v1/integrations/email/send',
    );
  });

  it('does not double the prefix when the base already carries it', () => {
    expect(
      build('http://alb.internal/api/v1/integrations', '/email/send'),
    ).toBe('http://alb.internal/api/v1/integrations/email/send');
  });

  it('tolerates a trailing slash on the base url', () => {
    expect(build('http://integrations-api:3001/', '/email/send')).toBe(
      'http://integrations-api:3001/api/v1/integrations/email/send',
    );
  });
});
