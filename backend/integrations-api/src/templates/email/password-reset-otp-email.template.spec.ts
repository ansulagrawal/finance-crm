import { renderPasswordResetOtpEmailHtml } from './password-reset-otp-email.template';

const BASE = {
  name: 'Priya Sharma',
  email: 'priya@financecrm.com',
  otp: '123456',
  crmUrl: 'https://crm.example.com',
  supportEmail: 'tech@financecrm.com',
  ipAddress: '203.0.113.9',
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  requestedAt: '2026-08-07T00:00:00.000Z',
  logoUrl: 'https://api.example.com/api/v1/integrations/assets/logo-email.png',
};

describe('renderPasswordResetOtpEmailHtml', () => {
  it('includes the OTP and the request context a recipient needs to spot a takeover attempt', () => {
    const html = renderPasswordResetOtpEmailHtml(BASE);

    expect(html).toContain('123456');
    expect(html).toContain('Priya Sharma');
    expect(html).toContain('priya@financecrm.com');
    expect(html).toContain('203.0.113.9');
    expect(html).toContain('tech@financecrm.com');
    // The device is shown parsed, not as the raw header: the reader is being
    // asked "was this you?", and "Chrome on Mac OS X" answers that where a
    // 120-character UA string does not.
    expect(html).toContain('Chrome 151.0.0.0 on Mac OS X');
    expect(html).not.toContain('AppleWebKit/537.36');
  });

  it('shows the logo when a URL is configured', () => {
    const html = renderPasswordResetOtpEmailHtml(BASE);

    expect(html).toContain(`src="${BASE.logoUrl}"`);
    expect(html).toContain('alt="Finance CRM"');
  });

  // PUBLIC_API_URL unset. A broken-image icon in a security email reads as a
  // phishing attempt, so it degrades to a wordmark instead.
  it('falls back to a text wordmark when no logo URL is configured', () => {
    const html = renderPasswordResetOtpEmailHtml({ ...BASE, logoUrl: '' });

    expect(html).not.toContain('<img');
    expect(html).toContain('Finance CRM');
  });

  it('escapes the User-Agent, which is a verbatim attacker-controlled header', () => {
    const html = renderPasswordResetOtpEmailHtml({
      ...BASE,
      userAgent: '<img src=x onerror="alert(1)">',
    });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes an injected display name too', () => {
    const html = renderPasswordResetOtpEmailHtml({
      ...BASE,
      name: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders a placeholder rather than "null" when IP/UA are unavailable', () => {
    const html = renderPasswordResetOtpEmailHtml({
      ...BASE,
      ipAddress: null,
      userAgent: null,
    });

    expect(html).toContain('Not available');
    expect(html).toContain('Unknown device');
    expect(html).not.toContain('>null<');
  });
});
