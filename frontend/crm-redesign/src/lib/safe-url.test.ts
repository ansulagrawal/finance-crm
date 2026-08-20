import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from './safe-url';

/**
 * This is a security control, not a formatting helper. Several lead-detail
 * links render a URL that originated in a third-party vendor response and was
 * stored verbatim — an eSign `returnUrl`, a video-KYC session link, a Razorpay
 * link parsed out of stored vendor JSON. React does not block a `javascript:`
 * href (it warns in dev and renders it anyway), so without this guard one
 * poisoned vendor response plus one staff click is script execution inside an
 * authenticated CRM session.
 */
describe('safeExternalUrl', () => {
  describe('blocks dangerous schemes', () => {
    it.each([
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'JAVASCRIPT:alert(1)',
      // Whitespace/control chars before the scheme are stripped by browsers,
      // and `new URL` tolerates leading whitespace too.
      '  javascript:alert(1)',
      '\tjavascript:alert(1)',
      '\njavascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:http://localhost/abc',
      'about:blank',
    ])('rejects %j', (value) => {
      expect(safeExternalUrl(value)).toBeNull();
    });
  });

  describe('allows real links', () => {
    it.each([
      'https://signzy.example.com/sign/abc123',
      'http://localhost:3000/api/v1/leads/1/sanction-letter',
      'https://tinyurl.com/abc',
    ])('accepts %j unchanged', (value) => {
      expect(safeExternalUrl(value)).toBe(value);
    });

    it('accepts a relative URL, resolved against the current origin', () => {
      // Same-origin links (e.g. an API download path) must keep working.
      expect(safeExternalUrl('/api/v1/leads/1/sanction-letter')).toBe(
        '/api/v1/leads/1/sanction-letter',
      );
    });

    it('accepts a protocol-relative URL, which inherits http(s)', () => {
      expect(safeExternalUrl('//example.com/x')).toBe('//example.com/x');
    });

    it('returns the original string, not a normalised one', () => {
      // Callers render this as both the href and the visible text, so
      // returning URL.toString() would silently rewrite what staff see.
      const messy = 'https://example.com/a%20b?q=1&r=2';
      expect(safeExternalUrl(messy)).toBe(messy);
    });
  });

  describe('empty and malformed input', () => {
    it.each([null, undefined, ''])('returns null for %j', (value) => {
      expect(safeExternalUrl(value)).toBeNull();
    });

    it('allows a junk string, because it resolves to a harmless same-origin path', () => {
      // '::::' has no scheme, so `new URL` treats it as relative and it
      // becomes http://<origin>/:::: — exactly what the browser would do with
      // `<a href="::::">`. The guard's job is to block dangerous *schemes*,
      // not to validate that a path is meaningful.
      expect(safeExternalUrl('::::')).toBe('::::');
    });
  });
});
