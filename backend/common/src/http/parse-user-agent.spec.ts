import { parseUserAgent } from './parse-user-agent';

describe('parseUserAgent', () => {
  // The two shapes that dominate the existing legacy rows, so new rows group
  // with them rather than forming a parallel set.
  it('matches the legacy value for Chrome on Windows 10', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
      ),
    ).toEqual({ platform: 'Windows 10', browser: 'Chrome 148.0.0.0' });
  });

  it('matches the legacy value for Chrome on macOS', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
      ),
    ).toEqual({ platform: 'Mac OS X', browser: 'Chrome 150.0.0.0' });
  });

  it('reports Firefox with its own version, not the Gecko one', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0',
      ),
    ).toEqual({ platform: 'Windows 10', browser: 'Firefox 151.0' });
  });

  // Order matters: every one of these also carries a Chrome token, and a
  // naive check would label them all Chrome.
  it('prefers Edge over the Chrome token it also sends', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
      ).browser,
    ).toBe('Edge 151.0.0.0');
  });

  it('prefers Opera over the Chrome token it also sends', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 OPR/120.0.0.0',
      ).browser,
    ).toBe('Opera 120.0.0.0');
  });

  it('reports Safari with its Version/ number, not the WebKit build', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      ),
    ).toEqual({ platform: 'Mac OS X', browser: 'Safari 18.0' });
  });

  // Brave sends a plain Chrome UA — this is what the deployed CRM is being
  // used from, so it is worth pinning that it lands as Chrome, not unknown.
  it('treats a Brave user agent as Chrome, since Brave sends no token', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
      ),
    ).toEqual({ platform: 'Mac OS X', browser: 'Chrome 151.0.0.0' });
  });

  it('handles mobile platforms', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ).platform,
    ).toBe('iOS');
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Mobile Safari/537.36',
      ).platform,
    ).toBe('Android');
  });

  it.each([undefined, null, ''])('returns nulls for %p', (value) => {
    expect(parseUserAgent(value)).toEqual({ platform: null, browser: null });
  });

  it('returns nulls rather than guessing on an unrecognised agent', () => {
    expect(parseUserAgent('some-internal-healthcheck/1.0')).toEqual({
      platform: null,
      browser: null,
    });
  });
});
