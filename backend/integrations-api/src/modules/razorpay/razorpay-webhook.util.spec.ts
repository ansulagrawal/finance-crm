import { createHmac } from 'node:crypto';
import { verifyRazorpaySignature } from './razorpay-webhook.util';

describe('verifyRazorpaySignature', () => {
  const secret = 'test-webhook-secret';
  const body = Buffer.from(
    JSON.stringify({ event: 'payment_link.paid', payload: {} }),
  );

  it('accepts a correctly-signed payload', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(true);
  });

  it('rejects a tampered payload (signature computed over different body)', () => {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    const tamperedBody = Buffer.from(
      JSON.stringify({ event: 'payment_link.paid', payload: { hacked: true } }),
    );
    expect(verifyRazorpaySignature(tamperedBody, signature, secret)).toBe(
      false,
    );
  });

  it('rejects a signature computed with the wrong secret', () => {
    const signature = createHmac('sha256', 'wrong-secret')
      .update(body)
      .digest('hex');
    expect(verifyRazorpaySignature(body, signature, secret)).toBe(false);
  });

  it('rejects when the signature header is missing', () => {
    expect(verifyRazorpaySignature(body, undefined, secret)).toBe(false);
  });
});
