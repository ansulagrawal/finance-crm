import { of, throwError } from 'rxjs';
import { RunoClientService } from './runo-client.service';

describe('RunoClientService', () => {
  let post: jest.Mock;
  let client: RunoClientService;

  beforeEach(() => {
    post = jest.fn();
    const config = { getOrThrow: () => 'test-runo-key' };
    client = new RunoClientService({ post } as never, config as never);
  });

  it('posts JSON with an Auth-Key header', async () => {
    post.mockReturnValue(of({ data: { statusCode: 0 } }));

    const result = await client.post('https://api.runo.in/v1/crm/allocation', {
      priority: 3,
    });

    expect(post).toHaveBeenCalledWith(
      'https://api.runo.in/v1/crm/allocation',
      { priority: 3 },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Auth-Key': 'test-runo-key',
        },
      },
    );
    expect(result.errorMessage).toBeNull();
  });

  it('reports an error when the underlying call fails', async () => {
    post.mockReturnValue(throwError(() => new Error('connect ECONNREFUSED')));

    const result = await client.post(
      'https://api.runo.in/v1/crm/allocation',
      {},
    );

    expect(result.errorMessage).toContain('connect ECONNREFUSED');
  });
});
