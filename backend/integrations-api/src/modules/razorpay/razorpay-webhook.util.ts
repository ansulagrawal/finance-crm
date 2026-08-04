import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay webhooks are authenticated via `X-Razorpay-Signature`: an
 * HMAC-SHA256 hex digest of the raw request body using the webhook secret
 * (configured separately from the API key/secret in the Razorpay dashboard).
 * Not present anywhere in the legacy app (legacy only creates payment links,
 * it never reconciles them) — this closes that gap rather than porting one.
 */
export function verifyRazorpaySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(signatureHeader, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
