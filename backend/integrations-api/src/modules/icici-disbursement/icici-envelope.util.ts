import {
  constants,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

/**
 * ICICI's API-Banking hybrid request envelope, ported from legacy's
 * `icici_request_encrypt()`/`icici_response_decrypt()`
 * (`helpers/integration/payday_disbursement_icici_helper.php`).
 *
 * Shape: a 16-byte AES session key is RSA-encrypted with ICICI's public
 * certificate, the JSON body is AES-128-CBC-encrypted under that key, and both
 * travel base64-encoded in
 * `{requestId, encryptedKey, iv, encryptedData, oaepHashingAlgorithm, ...}`.
 *
 * **Three defects in the legacy version are deliberately NOT reproduced.** This
 * guards a bank payment instruction, so "port it faithfully" would have meant
 * shipping known-broken crypto:
 *
 * 1. Legacy hardcodes `$sessionKey = 1234567890123456` — its real
 *    `hash('MD5', time(), true)` line is commented out — and uses the same
 *    constant for `$iv`. AES-CBC under a fixed key *and* fixed IV is
 *    deterministic: two disbursals of the same amount to the same account
 *    produce byte-identical ciphertext, so anyone observing traffic can
 *    correlate and replay payment instructions. Here both are
 *    `randomBytes(16)` per request.
 * 2. Legacy's decrypt passes `OPENSSL_PKCS1_PADDING` as `openssl_decrypt`'s
 *    options bitmask. That is an RSA padding mode and meaningless for AES; it
 *    only worked because the constant numerically equals `OPENSSL_RAW_DATA`
 *    (both 1). Node's API takes no such argument, so the bug cannot survive
 *    the port — noted because anyone comparing the two will look for it.
 * 3. Legacy's decrypt does `substr($encData, 16)`, discarding 16 bytes as
 *    though the IV were prepended to the ciphertext — but its own encrypt side
 *    never prepends one, and the IV travels in its own field. Since ICICI is
 *    the party that actually built the response, `decryptResponse` handles
 *    both: it uses the response's own `iv` field when present, and only falls
 *    back to treating the first block as the IV when that field is empty
 *    (which is what legacy's `substr` was really compensating for — real ICICI
 *    responses carry `"iv": ""`, visible in the sample response left in the
 *    legacy source).
 *
 * **Unverified against the real API.** No sandbox or credentials were
 * available, so this is written from the legacy source and the sample response
 * embedded in it. Item 3 in particular is the half most likely to need
 * adjusting against ICICI's actual spec — see `docs/TODO.md`.
 */

const AES_KEY_BYTES = 16; // AES-128
const AES_IV_BYTES = 16;

export interface IciciEnvelope {
  requestId: string;
  encryptedKey: string;
  iv: string;
  encryptedData: string;
  oaepHashingAlgorithm: 'NONE';
  service: string;
  clientInfo: string;
  optionalParam: string;
}

/**
 * `requestId` is the caller's transaction reference, which ICICI echoes back —
 * it must be the same `tranRefNo` inside the payload, because that is what
 * makes a retry idempotent on their side rather than a second payment.
 */
export function encryptRequest(
  payload: Record<string, string>,
  publicCertificatePem: string,
  requestId: string,
): { envelope: IciciEnvelope; body: string } {
  const sessionKey = randomBytes(AES_KEY_BYTES);
  const iv = randomBytes(AES_IV_BYTES);

  const encryptedKey = publicEncrypt(
    { key: publicCertificatePem, padding: constants.RSA_PKCS1_PADDING },
    sessionKey,
  );

  const cipher = createCipheriv('aes-128-cbc', sessionKey, iv);
  const encryptedData = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf-8'),
    cipher.final(),
  ]);

  const envelope: IciciEnvelope = {
    requestId,
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    encryptedData: encryptedData.toString('base64'),
    oaepHashingAlgorithm: 'NONE',
    service: '',
    clientInfo: '',
    optionalParam: '',
  };
  return { envelope, body: JSON.stringify(envelope) };
}

interface IciciEncryptedResponse {
  encryptedKey?: string;
  encryptedData?: string;
  iv?: string;
}

/**
 * Returns the decrypted JSON string, or throws. Callers must treat a throw as
 * "unknown outcome", never as "payment failed" — see
 * `IciciDisbursementService`.
 */
export function decryptResponse(
  responseBody: string,
  privateKeyPem: string,
): string {
  const parsed = JSON.parse(responseBody) as IciciEncryptedResponse;
  if (!parsed.encryptedKey || !parsed.encryptedData) {
    throw new Error('ICICI response is missing encryptedKey or encryptedData');
  }

  const sessionKey = privateDecrypt(
    { key: privateKeyPem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(parsed.encryptedKey, 'base64'),
  );

  let ciphertext = Buffer.from(parsed.encryptedData, 'base64');
  let iv: Buffer;
  if (parsed.iv) {
    iv = Buffer.from(parsed.iv, 'base64');
  } else {
    // Defect 3 above: no `iv` field, so the first block is the IV. This is the
    // case legacy's `substr($encData, 16)` was actually handling.
    if (ciphertext.length <= AES_IV_BYTES) {
      throw new Error(
        'ICICI response ciphertext is too short to contain an IV',
      );
    }
    iv = ciphertext.subarray(0, AES_IV_BYTES);
    ciphertext = ciphertext.subarray(AES_IV_BYTES);
  }

  const decipher = createDecipheriv('aes-128-cbc', sessionKey, iv);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf-8');
}
