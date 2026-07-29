import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Authenticates server-to-server calls between this monorepo's own services
 * (currently `core-api`/`automation-worker` calling `integrations-api`) —
 * these are plain axios requests with no session cookie, so the normal
 * cookie-based `JwtAuthGuard` path can never apply to them. Signs
 * `METHOD.PATHNAME.TIMESTAMP.` concatenated with the raw request body bytes,
 * HMAC-SHA256 with a secret shared across every internal caller/receiver
 * (`INTERNAL_SERVICE_SECRET`) — same primitives (`createHmac`,
 * `timingSafeEqual`) as `razorpay-webhook.util.ts`'s vendor-signature
 * verification, the closest existing precedent in this codebase.
 *
 * Binding method + pathname (not just timestamp + body) closes
 * cross-endpoint/cross-method replay for free. `pathname` must be exactly
 * what Express sees on `request.path` (no query string, no host/protocol) —
 * callers must derive it via `new URL(fullUrl).pathname`, not the relative
 * path string they were given, since `INTEGRATIONS_API_URL` differs in
 * shape per environment.
 */
export const INTERNAL_SIGNATURE_HEADER = 'x-internal-signature';
export const INTERNAL_TIMESTAMP_HEADER = 'x-internal-timestamp';

/** Reject a signed request whose timestamp is further than this from "now",
 * in either direction (tolerates clock skew symmetrically). Deliberately a
 * fixed constant, not configurable — this is a trusted-internal-network
 * replay window, not a public API rate limit. */
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function signaturePayload(
  method: string,
  pathname: string,
  timestamp: string,
  rawBody: Buffer,
): Buffer {
  const prefix = Buffer.from(
    `${method.toUpperCase()}.${pathname}.${timestamp}.`,
    'utf-8',
  );
  return Buffer.concat([prefix, rawBody]);
}

export function signInternalRequest(
  method: string,
  pathname: string,
  rawBody: Buffer,
  secret: string,
  timestamp: string = String(Date.now()),
): { signature: string; timestamp: string } {
  const signature = createHmac('sha256', secret)
    .update(signaturePayload(method, pathname, timestamp, rawBody))
    .digest('hex');
  return { signature, timestamp };
}

export function verifyInternalSignature(
  method: string,
  pathname: string,
  rawBody: Buffer,
  secret: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
): boolean {
  if (!signatureHeader || !timestampHeader) {
    return false;
  }
  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  if (Math.abs(Date.now() - timestamp) > REPLAY_WINDOW_MS) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(signaturePayload(method, pathname, timestampHeader, rawBody))
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(signatureHeader, 'hex');
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
