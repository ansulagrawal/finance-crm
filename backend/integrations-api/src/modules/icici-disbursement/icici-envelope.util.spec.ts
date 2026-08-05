import {
  constants,
  createCipheriv,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { decryptResponse, encryptRequest } from './icici-envelope.util';

// Stands in for ICICI's certificate/our key. 2048-bit is enough for a
// 16-byte session key under PKCS#1 v1.5.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const PAYLOAD = {
  localTxnDtTime: '20260807010203',
  beneAccNo: '20279774002',
  beneIFSC: 'SBIN0016732',
  amount: '9000',
  tranRefNo: 'SLPRD20260807010203123',
  paymentRef: 'IMPS/ICICI/LN-1/Priya Sharma/9000',
  senderName: 'Acme',
  mobile: '9999999780',
  retailerCode: 'rcode',
  passCode: 'pass',
  bcID: 'bc',
};

/** Mimics ICICI encrypting a response back to us. */
function buildIciciResponse(
  plaintext: string,
  opts: { includeIvField: boolean },
): string {
  const sessionKey = randomBytes(16);
  const iv = randomBytes(16);
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    sessionKey,
  );
  const cipher = createCipheriv('aes-128-cbc', sessionKey, iv);
  const body = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
  ]);
  return JSON.stringify({
    encryptedKey: encryptedKey.toString('base64'),
    // When ICICI omits the iv field, the IV is prepended to the ciphertext.
    iv: opts.includeIvField ? iv.toString('base64') : '',
    encryptedData: opts.includeIvField
      ? body.toString('base64')
      : Buffer.concat([iv, body]).toString('base64'),
  });
}

describe('ICICI envelope', () => {
  describe('encryptRequest', () => {
    it('produces different ciphertext for identical payloads', () => {
      // The whole point of defect #1. Legacy hardcoded both the AES session
      // key and the IV, so two disbursals of the same amount to the same
      // account were byte-identical on the wire — correlatable and replayable.
      const a = encryptRequest(PAYLOAD, publicKey, PAYLOAD.tranRefNo);
      const b = encryptRequest(PAYLOAD, publicKey, PAYLOAD.tranRefNo);

      expect(a.envelope.encryptedData).not.toBe(b.envelope.encryptedData);
      expect(a.envelope.encryptedKey).not.toBe(b.envelope.encryptedKey);
      expect(a.envelope.iv).not.toBe(b.envelope.iv);
    });

    it('never emits the legacy hardcoded key/IV constant', () => {
      const legacyConstant = Buffer.from('1234567890123456').toString('base64');
      const { envelope } = encryptRequest(PAYLOAD, publicKey, 'ref');

      expect(envelope.iv).not.toBe(legacyConstant);
    });

    it('RSA-encrypts a 16-byte session key our private key can recover', () => {
      const { envelope } = encryptRequest(PAYLOAD, publicKey, 'ref');

      const sessionKey = privateDecrypt(
        { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(envelope.encryptedKey, 'base64'),
      );
      expect(sessionKey).toHaveLength(16);
    });

    it('carries requestId and the fixed envelope fields ICICI expects', () => {
      const { envelope } = encryptRequest(PAYLOAD, publicKey, 'REF-1');

      expect(envelope.requestId).toBe('REF-1');
      expect(envelope.oaepHashingAlgorithm).toBe('NONE');
      expect(envelope).toMatchObject({
        service: '',
        clientInfo: '',
        optionalParam: '',
      });
    });

    it('round-trips: what we encrypt is what a holder of the private key reads', () => {
      const { envelope } = encryptRequest(PAYLOAD, publicKey, 'ref');
      // Re-wrap as an ICICI-shaped response so decryptResponse can read it.
      const asResponse = JSON.stringify({
        encryptedKey: envelope.encryptedKey,
        iv: envelope.iv,
        encryptedData: envelope.encryptedData,
      });

      expect(JSON.parse(decryptResponse(asResponse, privateKey))).toEqual(
        PAYLOAD,
      );
    });
  });

  describe('decryptResponse', () => {
    const success =
      '{"ActCode":"0","Response":"Transaction Successful","BankRRN":"200701023783","success":true}';

    it('decrypts a response that carries its own iv field', () => {
      const body = buildIciciResponse(success, { includeIvField: true });

      expect(decryptResponse(body, privateKey)).toBe(success);
    });

    it('decrypts a response with an empty iv field, where the IV is prepended', () => {
      // Real ICICI responses show `"iv": ""` in the sample left in the legacy
      // source — this is the case legacy's substr($encData, 16) handled.
      const body = buildIciciResponse(success, { includeIvField: false });

      expect(decryptResponse(body, privateKey)).toBe(success);
    });

    it('throws when the envelope is missing its encrypted fields', () => {
      expect(() => decryptResponse('{"requestId":"x"}', privateKey)).toThrow(
        /missing encryptedKey or encryptedData/,
      );
    });

    it('throws rather than returning garbage when ciphertext is too short for a prepended IV', () => {
      const body = JSON.stringify({
        encryptedKey: publicEncrypt(
          { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
          randomBytes(16),
        ).toString('base64'),
        iv: '',
        encryptedData: randomBytes(8).toString('base64'),
      });

      expect(() => decryptResponse(body, privateKey)).toThrow(/too short/);
    });
  });
});
