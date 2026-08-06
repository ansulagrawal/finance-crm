import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { SignzyClientService } from './signzy-client.service';

describe('SignzyClientService', () => {
  let service: SignzyClientService;
  let httpServicePost: jest.Mock;
  let httpServiceGet: jest.Mock;
  let configGet: jest.Mock;
  let configGetOrThrow: jest.Mock;

  beforeEach(async () => {
    httpServicePost = jest.fn();
    httpServiceGet = jest.fn();
    configGet = jest.fn((_key: string, fallback?: string) => fallback);
    configGetOrThrow = jest.fn((key: string) => {
      if (key === 'SIGNZY_TOKEN') return 'test-signzy-token';
      throw new Error(`Unexpected config key: ${key}`);
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        SignzyClientService,
        {
          provide: HttpService,
          useValue: { post: httpServicePost, get: httpServiceGet },
        },
        {
          provide: ConfigService,
          useValue: { get: configGet, getOrThrow: configGetOrThrow },
        },
      ],
    }).compile();

    service = moduleRef.get(SignzyClientService);
  });

  describe('post', () => {
    it('posts to the default preproduction base URL with a bare (non-Bearer) Authorization header', async () => {
      httpServicePost.mockReturnValue(
        of({ status: 200, data: { result: { ok: true } } }),
      );

      const result = await service.post('v3/face/match', {
        firstImage: 'a',
        secondImage: 'b',
      });

      expect(httpServicePost).toHaveBeenCalledWith(
        'https://api-preproduction.signzy.app/api/v3/face/match',
        { firstImage: 'a', secondImage: 'b' },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'test-signzy-token',
          },
        },
      );
      expect(result.statusCode).toBe(200);
      expect(result.data).toEqual({ result: { ok: true } });
      expect(result.requestJson).toBe(
        JSON.stringify({ firstImage: 'a', secondImage: 'b' }),
      );
      expect(result.errorMessage).toBeNull();
    });

    it('merges extra headers on top of the default Content-Type/Authorization', async () => {
      httpServicePost.mockReturnValue(of({ status: 200, data: {} }));

      await service.post(
        'v3/geocoding/reverse-geocode',
        { latitude: '1', longitude: '2' },
        { 'x-client-unique-id': 'it@financecrm.com' },
      );

      expect(httpServicePost).toHaveBeenCalledWith(
        'https://api-preproduction.signzy.app/api/v3/geocoding/reverse-geocode',
        { latitude: '1', longitude: '2' },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'test-signzy-token',
            'x-client-unique-id': 'it@financecrm.com',
          },
        },
      );
    });

    it('uses the path as-is when it is already an absolute URL', async () => {
      httpServicePost.mockReturnValue(of({ status: 200, data: {} }));

      await service.post('https://other-host.example/path', {});

      expect(httpServicePost).toHaveBeenCalledWith(
        'https://other-host.example/path',
        {},
        expect.anything(),
      );
    });

    it('captures an API error response (non-2xx) without throwing', async () => {
      httpServicePost.mockReturnValue(
        throwError(() => ({
          response: { status: 400, data: { error: 'bad request' } },
          message: 'Request failed with status code 400',
        })),
      );

      const result = await service.post('v3/pan/fetchV2', { number: 'X' });

      expect(result.statusCode).toBe(400);
      expect(result.data).toEqual({ error: 'bad request' });
      expect(result.responseJson).toBe(
        JSON.stringify({ error: 'bad request' }),
      );
      expect(result.errorMessage).toBe('Request failed with status code 400');
    });

    it('captures a network error (no response at all) without throwing', async () => {
      httpServicePost.mockReturnValue(
        throwError(() => new Error('connect ECONNREFUSED')),
      );

      const result = await service.post('v3/pan/fetchV2', { number: 'X' });

      expect(result.statusCode).toBeNull();
      expect(result.data).toBeNull();
      expect(result.responseJson).toBe('');
      expect(result.errorMessage).toBe('connect ECONNREFUSED');
    });
  });

  describe('get', () => {
    it('sends the Authorization header and query params to the resolved URL', async () => {
      httpServiceGet.mockReturnValue(
        of({ status: 200, data: { result: 'ok' } }),
      );

      const result = await service.get('v3/some/path', { foo: 'bar' });

      expect(httpServiceGet).toHaveBeenCalledWith(
        'https://api-preproduction.signzy.app/api/v3/some/path',
        {
          params: { foo: 'bar' },
          headers: { Authorization: 'test-signzy-token' },
        },
      );
      expect(result.statusCode).toBe(200);
      expect(result.requestJson).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('falls back to a generic error message when the thrown error has none', async () => {
      httpServiceGet.mockReturnValue(throwError(() => ({})));

      const result = await service.get('v3/some/path');

      expect(result.errorMessage).toBe('Signzy API call failed');
      expect(result.statusCode).toBeNull();
    });
  });

  it('reads a custom SIGNZY_BASE_URL when configured', async () => {
    configGet = jest.fn((key: string, fallback?: string) =>
      key === 'SIGNZY_BASE_URL' ? 'https://api.signzy.app/api/' : fallback,
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        SignzyClientService,
        {
          provide: HttpService,
          useValue: { post: httpServicePost, get: httpServiceGet },
        },
        {
          provide: ConfigService,
          useValue: { get: configGet, getOrThrow: configGetOrThrow },
        },
      ],
    }).compile();
    service = moduleRef.get(SignzyClientService);
    httpServicePost.mockReturnValue(of({ status: 200, data: {} }));

    await service.post('v3/x', {});

    expect(httpServicePost).toHaveBeenCalledWith(
      'https://api.signzy.app/api/v3/x',
      {},
      expect.anything(),
    );
  });
});
