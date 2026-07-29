import type { ConfigService } from '@nestjs/config';

/**
 * Reads PEM key material (an RSA key or an X.509 certificate) out of config
 * **by value**, not by file path.
 *
 * Deliberate: key material must never sit on an EC2/ECS filesystem. It lives in
 * AWS Secrets Manager (or `.env` locally) alongside every other secret, and the
 * existing config chain already resolves that. Nothing to mount, nothing to
 * bake into an image, nothing left behind on a terminated instance — and
 * rotation is a secret update rather than a deploy.
 *
 * The awkward part is that a PEM is multi-line and `.env` is not, so this
 * accepts three encodings of the same thing and normalises them:
 *
 *  1. **Real newlines** — what a JSON secret naturally holds
 *     (`"-----BEGIN...\n..."` unescapes to real newlines). Preferred.
 *  2. **Literal `\n` two-character sequences** — what you get from pasting a
 *     PEM into a single-line `.env` entry. Converted to real newlines.
 *  3. **Base64 of the whole PEM** — the escape hatch when a pipeline mangles
 *     backslashes. Detected by "doesn't contain `-----BEGIN`", then decoded.
 *
 * OpenSSL rejects a PEM whose header/footer or line breaks are wrong, and the
 * error it gives ("error:0909006C" and friends) says nothing useful about
 * which variable was malformed — hence validating here and naming the key.
 */
export function readPemFromConfig(config: ConfigService, key: string): string {
  const raw = config.get<string>(key);
  if (!raw?.trim()) {
    throw new Error(
      `${key} is not set. PEM key material is read by value from config (Secrets Manager or .env), not from a file path.`,
    );
  }

  let pem = raw.trim();

  // Case 3: base64-wrapped. Decode before anything else, since the decoded
  // form then goes through the newline normalisation below.
  if (!pem.includes('-----BEGIN')) {
    try {
      pem = Buffer.from(pem, 'base64').toString('utf-8').trim();
    } catch {
      // fall through to the validation error below
    }
  }

  // Case 2: literal backslash-n. Also normalise CRLF, which survives a
  // copy-paste through Windows tooling and breaks strict PEM parsers.
  pem = pem
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  if (!pem.includes('-----BEGIN') || !pem.includes('-----END')) {
    throw new Error(
      `${key} does not look like PEM key material — expected a "-----BEGIN ...-----" block (optionally base64-wrapped, or with literal \\n line breaks).`,
    );
  }

  // A PEM without a trailing newline is accepted by Node but not by every
  // consumer, and costs nothing to normalise.
  return pem.endsWith('\n') ? pem : `${pem}\n`;
}
