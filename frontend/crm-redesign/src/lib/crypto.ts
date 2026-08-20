// Client-side-only obfuscation: the key below ships in the JS bundle, so this
// only hides cached data from casual devtools/localStorage inspection. It is
// not a defense against an attacker who can already run JS on the page (XSS).
const APP_KEY = 'finance-crm-crm-local-cache-v1';
const SALT = 'finance-crm-crm-static-salt';

async function getCryptoKey(): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_KEY),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(SALT),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

export async function encryptJson(value: unknown): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  return `${bufferToBase64(iv)}.${bufferToBase64(ciphertext)}`;
}

export async function decryptJson<T>(payload: string): Promise<T | null> {
  try {
    const [ivPart, dataPart] = payload.split('.');
    if (!ivPart || !dataPart) return null;
    const key = await getCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBuffer(ivPart) },
      key,
      base64ToBuffer(dataPart),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch {
    return null;
  }
}
