import { generateKeyPairSync } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { readPemFromConfig } from './read-pem-from-config';

const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function config(value: string | undefined): ConfigService {
  return { get: () => value } as unknown as ConfigService;
}

describe('readPemFromConfig', () => {
  it('accepts a PEM with real newlines (the JSON-secret shape)', () => {
    expect(readPemFromConfig(config(privateKey), 'K')).toBe(privateKey);
  });

  it('accepts a PEM flattened to literal \\n (the single-line .env shape)', () => {
    const flattened = privateKey.replace(/\n/g, '\\n');

    expect(readPemFromConfig(config(flattened), 'K')).toBe(privateKey);
  });

  it('accepts a base64-wrapped PEM (the escape hatch)', () => {
    const wrapped = Buffer.from(privateKey, 'utf-8').toString('base64');

    expect(readPemFromConfig(config(wrapped), 'K')).toBe(privateKey);
  });

  it('normalises CRLF, which survives a copy-paste through Windows tooling', () => {
    const crlf = privateKey.replace(/\n/g, '\r\n');

    expect(readPemFromConfig(config(crlf), 'K')).toBe(privateKey);
  });

  it('adds a trailing newline when one is missing', () => {
    const trimmed = privateKey.trimEnd();

    expect(readPemFromConfig(config(trimmed), 'K')).toBe(privateKey);
  });

  it('produces a key OpenSSL actually accepts', () => {
    // The point of the whole helper: the output has to be loadable, not just
    // look like a PEM.
    const { createPrivateKey } = require('node:crypto');
    const flattened = privateKey.replace(/\n/g, '\\n');

    expect(() =>
      createPrivateKey(readPemFromConfig(config(flattened), 'K')),
    ).not.toThrow();
  });

  it.each([undefined, '', '   '])(
    'throws a message naming the key when the value is %j',
    (value) => {
      expect(() =>
        readPemFromConfig(config(value), 'ICICI_UPI_PRIVATE_KEY'),
      ).toThrow(/ICICI_UPI_PRIVATE_KEY is not set/);
    },
  );

  it('throws when the value is not PEM at all, rather than passing garbage to OpenSSL', () => {
    // OpenSSL's own error for this names no variable, so a bad secret would be
    // untraceable without this check.
    expect(() => readPemFromConfig(config('just-a-token'), 'MY_KEY')).toThrow(
      /MY_KEY does not look like PEM/,
    );
  });

  it('rejects a value that decodes from base64 into non-PEM', () => {
    const notPem = Buffer.from('hello world', 'utf-8').toString('base64');

    expect(() => readPemFromConfig(config(notPem), 'MY_KEY')).toThrow(
      /does not look like PEM/,
    );
  });
});
