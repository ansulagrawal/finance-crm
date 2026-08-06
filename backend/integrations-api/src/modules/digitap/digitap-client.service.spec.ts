import { of, throwError } from 'rxjs';
import { DigitapClientService } from './digitap-client.service';

describe('DigitapClientService', () => {
  let get: jest.Mock;
  let post: jest.Mock;
  let client: DigitapClientService;

  beforeEach(() => {
    get = jest.fn();
    post = jest.fn();
    const config = { getOrThrow: () => 'test-digitap-token' };
    client = new DigitapClientService({ get, post } as never, config as never);
  });

  it('downloads the document then posts it as multipart with a bare Authorization header', async () => {
    get.mockReturnValue(of({ data: new ArrayBuffer(4) }));
    post.mockReturnValue(
      of({ data: { statusCode: '200', result: [{ details: {} }] } }),
    );

    const result = await client.postMultipart(
      'https://api.digitap.ai/ocr/v1/pan',
      'https://example.com/pan.jpg',
      { clientRefId: '42' },
    );

    expect(get).toHaveBeenCalledWith('https://example.com/pan.jpg', {
      responseType: 'arraybuffer',
    });
    expect(post).toHaveBeenCalledTimes(1);
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://api.digitap.ai/ocr/v1/pan');
    expect(body).toBeInstanceOf(FormData);
    expect(config).toEqual({
      headers: { Authorization: 'test-digitap-token' },
    });
    expect(result.errorMessage).toBeNull();
  });

  it('reports an error when the underlying call fails', async () => {
    get.mockReturnValue(of({ data: new ArrayBuffer(4) }));
    post.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

    const result = await client.postMultipart(
      'https://api.digitap.ai/ocr/v1/pan',
      'https://example.com/pan.jpg',
      {},
    );

    expect(result.errorMessage).toContain('connect ECONNREFUSED');
  });

  describe('postJson', () => {
    it('posts a JSON body with a bare Authorization header', async () => {
      post.mockReturnValue(of({ data: { code: '200' } }));

      const result = await client.postJson(
        'https://api.digitap.ai/ent/v1/kyc/generate-url',
        {
          uid: '42',
        },
      );

      expect(post).toHaveBeenCalledWith(
        'https://api.digitap.ai/ent/v1/kyc/generate-url',
        { uid: '42' },
        {
          headers: {
            Authorization: 'test-digitap-token',
            'Content-Type': 'application/json',
          },
        },
      );
      expect(result.errorMessage).toBeNull();
    });

    it('reports an error when the underlying call fails', async () => {
      post.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

      const result = await client.postJson(
        'https://api.digitap.ai/ent/v1/kyc/generate-url',
        {},
      );

      expect(result.errorMessage).toContain('connect ECONNREFUSED');
    });
  });
});
