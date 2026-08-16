/**
 * Guards a URL that came from the backend before it is used as an `href`.
 *
 * Several vendor-log fields are rendered as clickable links on the lead
 * detail page — an eSign log's `returnUrl`, a video-KYC session URL, a
 * Razorpay payment link parsed out of a stored vendor JSON response. Every
 * one of those originates in a third party's API response and is stored
 * verbatim, so none of them is trustworthy by the time it reaches us.
 *
 * React does not block a `javascript:` URL in an `href` — it warns in dev
 * and renders it anyway — so `<a href={log.returnUrl}>` is a stored-XSS
 * sink: one poisoned vendor response (or one bad row) and a staff click
 * runs script in an authenticated CRM session. `data:` and `vbscript:` are
 * the same problem wearing a different hat.
 *
 * Returns the URL only if it parses and uses http/https, and `null`
 * otherwise, so callers render plain text instead of a link. Protocol-
 * relative (`//host/x`) and relative URLs resolve against the current
 * origin, which is why the second argument to `URL` is `location.href`
 * rather than being omitted (omitting it would throw on a relative URL and
 * we'd lose legitimate same-origin links).
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/** Falls back to an http base when there is no `window` (tests, or any
 * non-browser context). Without this the `new URL` call would throw, be
 * swallowed by the catch below, and make *every* URL look unsafe — a guard
 * that silently rejects everything is as broken as one that accepts
 * everything, just harder to notice. */
function currentBase(): string {
  return typeof window === 'undefined'
    ? 'http://localhost/'
    : window.location.href;
}

export function safeExternalUrl(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value, currentBase());
    return SAFE_PROTOCOLS.has(parsed.protocol) ? value : null;
  } catch {
    return null;
  }
}
