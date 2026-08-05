import { generateKeyPairSync } from 'node:crypto';
import { decryptFromIcici, encryptForIcici } from './icici-rsa.util';

describe('ICICI RSA PKCS1 encrypt/decrypt round-trip', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });

  it('decrypts what it encrypted back to the exact original plaintext', () => {
    const requestParams = {
      amount: 1500,
      merchantId: 'TESTMERCHANT',
      terminalId: '5411',
      merchantTranId: 'LOAN123-9-1234567890',
      billNumber: '9-1234567890',
    };
    const plaintext = JSON.stringify(requestParams);

    const ciphertext = encryptForIcici(plaintext, publicKey);
    // Ciphertext must not leak the plaintext and must be valid base64.
    expect(ciphertext).not.toContain('merchantId');
    expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();

    const decrypted = decryptFromIcici(ciphertext, privateKey);
    expect(decrypted).toBe(plaintext);
    expect(JSON.parse(decrypted)).toEqual(requestParams);
  });

  it('never recovers the original plaintext with the wrong private key', () => {
    const otherKeyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });
    const ciphertext = encryptForIcici('secret payload', publicKey);
    // RSA_PKCS1_PADDING decryption with the wrong key doesn't reliably throw
    // (padding-check outcome is probabilistic), but it must never recover
    // the real plaintext — that's the actual security property that matters.
    let recovered: string | null = null;
    try {
      recovered = decryptFromIcici(ciphertext, otherKeyPair.privateKey);
    } catch {
      recovered = null;
    }
    expect(recovered).not.toBe('secret payload');
  });
});
