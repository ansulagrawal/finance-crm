import { constants, privateDecrypt, publicEncrypt } from 'node:crypto';

/**
 * ICICI Bank's EazyPay UPI API encrypts both the request (with ICICI's
 * public key) and the response/callback (readable only with our private
 * key) using RSA PKCS1 padding — ported from
 * `old-php-files/components/includes/integration/call_upi_api.php`
 * (`openssl_public_encrypt(..., OPENSSL_PKCS1_PADDING)`) and
 * `IciciCallbackController::deposit_callback()`
 * (`openssl_private_decrypt(..., OPENSSL_PKCS1_PADDING)`). Node's
 * `RSA_PKCS1_PADDING` constant is the equivalent padding scheme.
 */
export function encryptForIcici(
  plaintext: string,
  publicKeyPem: string,
): string {
  const encrypted = publicEncrypt(
    { key: publicKeyPem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(plaintext, 'utf-8'),
  );
  return encrypted.toString('base64');
}

/** Minimum non-zero padding bytes PKCS#1 v1.5 block type 2 requires between
 * the `00 02` header and the `00` separator. */
const MIN_PADDING_BYTES = 8;

/**
 * Node disallows `RSA_PKCS1_PADDING` for `privateDecrypt` outright (throws
 * "RSA_PKCS1_PADDING is no longer supported for private decryption", added
 * as a Bleichenbacher/Marvin-attack mitigation) — there is no padding
 * option left that does PKCS#1 v1.5 unpadding for us, so this decrypts raw
 * (`RSA_NO_PADDING`) and strips the `00 02 <random padding, no zero bytes>
 * 00 <data>` block-type-2 envelope by hand.
 *
 * An earlier version of this comment claimed the endpoint feeding it was
 * "not a public oracle taking attacker-supplied ciphertexts". That was
 * wrong: `UpiCallbackController.handleDepositCallback` is `@Public()` and
 * passes the raw request body straight in. So the mitigation has to be
 * real, and it is twofold — one **single** failure mode here, so a
 * malformed block is indistinguishable from a well-formed one carrying
 * unusable content (previously each rejection reason threw its own
 * message), and the caller echoing nothing back (see that controller).
 * `ERROR` is deliberately one shared, contentless message.
 *
 * Also validates the padding length, which the previous version skipped: a
 * separator found before `MIN_PADDING_BYTES` is a malformed block, and
 * accepting it widens what an attacker can get treated as valid.
 */
const PADDING_ERROR = 'Invalid PKCS#1 v1.5 padding';

function stripPkcs1v15Padding(block: Buffer): Buffer {
  const separatorIndex = block.indexOf(0x00, 2);
  if (
    block[0] !== 0x00 ||
    block[1] !== 0x02 ||
    separatorIndex === -1 ||
    separatorIndex < 2 + MIN_PADDING_BYTES
  ) {
    throw new Error(PADDING_ERROR);
  }
  return block.subarray(separatorIndex + 1);
}

export function decryptFromIcici(
  base64Ciphertext: string,
  privateKeyPem: string,
): string {
  const decrypted = privateDecrypt(
    { key: privateKeyPem, padding: constants.RSA_NO_PADDING },
    Buffer.from(base64Ciphertext, 'base64'),
  );
  return stripPkcs1v15Padding(decrypted).toString('utf-8');
}
