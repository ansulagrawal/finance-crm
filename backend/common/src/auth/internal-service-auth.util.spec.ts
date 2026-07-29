import {
  signInternalRequest,
  verifyInternalSignature,
} from './internal-service-auth.util';

const SECRET = 'test-shared-secret';

describe('internal-service-auth.util', () => {
  it('accepts a correctly-signed request round-trip', () => {
    const body = Buffer.from(JSON.stringify({ leadId: 42 }));
    const { signature, timestamp } = signInternalRequest(
      'post',
      '/api/v1/integrations/sms/send',
      body,
      SECRET,
    );

    expect(
      verifyInternalSignature(
        'POST',
        '/api/v1/integrations/sms/send',
        body,
        SECRET,
        signature,
        timestamp,
      ),
    ).toBe(true);
  });

  it('rejects a tampered body', () => {
    const body = Buffer.from(JSON.stringify({ leadId: 42 }));
    const { signature, timestamp } = signInternalRequest(
      'post',
      '/api/v1/integrations/sms/send',
      body,
      SECRET,
    );
    const tamperedBody = Buffer.from(JSON.stringify({ leadId: 99 }));

    expect(
      verifyInternalSignature(
        'POST',
        '/api/v1/integrations/sms/send',
        tamperedBody,
        SECRET,
        signature,
        timestamp,
      ),
    ).toBe(false);
  });

  it('rejects a tampered path', () => {
    const body = Buffer.from('{}');
    const { signature, timestamp } = signInternalRequest(
      'post',
      '/api/v1/integrations/sms/send',
      body,
      SECRET,
    );

    expect(
      verifyInternalSignature(
        'POST',
        '/api/v1/integrations/email/send',
        body,
        SECRET,
        signature,
        timestamp,
      ),
    ).toBe(false);
  });

  it('rejects a tampered method', () => {
    const body = Buffer.from('{}');
    const { signature, timestamp } = signInternalRequest(
      'post',
      '/api/v1/integrations/sms/send',
      body,
      SECRET,
    );

    expect(
      verifyInternalSignature(
        'GET',
        '/api/v1/integrations/sms/send',
        body,
        SECRET,
        signature,
        timestamp,
      ),
    ).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const body = Buffer.from('{}');
    const { signature, timestamp } = signInternalRequest(
      'post',
      '/api/v1/integrations/sms/send',
      body,
      SECRET,
    );

    expect(
      verifyInternalSignature(
        'POST',
        '/api/v1/integrations/sms/send',
        body,
        'wrong-secret',
        signature,
        timestamp,
      ),
    ).toBe(false);
  });

  it('rejects missing signature or timestamp headers', () => {
    const body = Buffer.from('{}');
    expect(
      verifyInternalSignature(
        'POST',
        '/x',
        body,
        SECRET,
        undefined,
        String(Date.now()),
      ),
    ).toBe(false);
    expect(
      verifyInternalSignature('POST', '/x', body, SECRET, 'abc', undefined),
    ).toBe(false);
  });

  it('rejects a malformed (non-numeric) timestamp', () => {
    const body = Buffer.from('{}');
    expect(
      verifyInternalSignature(
        'POST',
        '/x',
        body,
        SECRET,
        'abc',
        'not-a-number',
      ),
    ).toBe(false);
  });

  it('rejects a timestamp older than the replay window', () => {
    const body = Buffer.from('{}');
    const staleTimestamp = String(Date.now() - 6 * 60 * 1000);
    const { signature } = signInternalRequest(
      'post',
      '/x',
      body,
      SECRET,
      staleTimestamp,
    );

    expect(
      verifyInternalSignature(
        'POST',
        '/x',
        body,
        SECRET,
        signature,
        staleTimestamp,
      ),
    ).toBe(false);
  });

  it('rejects a timestamp too far in the future (clock skew)', () => {
    const body = Buffer.from('{}');
    const futureTimestamp = String(Date.now() + 6 * 60 * 1000);
    const { signature } = signInternalRequest(
      'post',
      '/x',
      body,
      SECRET,
      futureTimestamp,
    );

    expect(
      verifyInternalSignature(
        'POST',
        '/x',
        body,
        SECRET,
        signature,
        futureTimestamp,
      ),
    ).toBe(false);
  });
});
