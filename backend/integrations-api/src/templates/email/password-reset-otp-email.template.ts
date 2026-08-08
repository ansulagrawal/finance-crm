import { escapeHtml, parseUserAgent } from '@finance-crm/common';

/**
 * Password-reset OTP email.
 *
 * Content is inherited from `ForgetPasswordController::verifyUser()`'s (dead)
 * legacy HTML — that method short-circuits on line 38 with
 * `set_flashdata('err', "Work in progress for the same.")` and redirects
 * before rendering, so legacy's forgot-password flow never actually ran. Its
 * markup was nonetheless a real decision about *what to say*: greeting, the
 * CRM URL, which login the OTP is for, the OTP, the request's
 * IP/platform/browser, a timestamp, and an IT-support contact. All of that is
 * kept.
 *
 * The presentation is not: legacy rendered one `border="1"` grid with the OTP
 * as an ordinary table row, indistinguishable from the metadata around it.
 * Here the OTP is the single focal point and the request context is demoted to
 * a footnote — while staying present, because it is the point of the design.
 * A recipient who did NOT ask for this reset needs to see where the request
 * came from; that is the only signal a staff user gets that someone is trying
 * to take over their account.
 *
 * HTML-email constraints this obeys, all deliberate:
 *  - **Tables, not divs**, for layout. Outlook's Word rendering engine has no
 *    usable flex/grid.
 *  - **Inline styles only.** Gmail strips `<style>` blocks in several clients,
 *    so anything that matters is on the element.
 *  - **Readable with images off**, which is the default in many clients: the
 *    logo has alt text, and no information lives only inside it.
 *  - **No web fonts** — they silently fall back, so the stack is system fonts.
 *
 * Everything interpolated is escaped. `userAgent` in particular is a verbatim
 * client-supplied header, so it is attacker-controlled by definition.
 */
export interface PasswordResetOtpEmailParams {
  name: string;
  email: string;
  otp: string;
  crmUrl: string;
  supportEmail: string;
  /** Request IP, as resolved by Express behind `trust proxy`. */
  ipAddress: string | null;
  /** Raw `User-Agent` header, split for display via `parseUserAgent`. */
  userAgent: string | null;
  /** Pre-formatted for display — the caller owns timezone handling. */
  requestedAt: string;
  /**
   * Absolute URL of the logo. Served by `integrations-api` itself, not by the
   * CRM: this email is produced by the backend, so hanging it off a frontend
   * deploy would break it whenever the frontend moves. Blank renders the
   * wordmark fallback rather than a broken image.
   */
  logoUrl: string;
}

/** Brand palette, matching the CRM's own tokens in `index.css`. */
const NAVY = '#011f41';
const ORANGE = '#ff7b0e';
const PAPER = '#f7f6f3';
const INK = '#16212e';
const MUTED_INK = '#5b6672';
const BORDER = '#e3e0d9';

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** One line of request context. Kept small and quiet — it is evidence, not content. */
function detail(label: string, value: string): string {
  return `<tr>
        <td style="padding:2px 0;font:400 12px/18px ${FONT};color:${MUTED_INK};white-space:nowrap;" valign="top">${escapeHtml(label)}&nbsp;&nbsp;</td>
        <td style="padding:2px 0;font:400 12px/18px ${FONT};color:${INK};word-break:break-word;" valign="top">${escapeHtml(value)}</td>
      </tr>`;
}

export function renderPasswordResetOtpEmailHtml(
  params: PasswordResetOtpEmailParams,
): string {
  // Legacy showed platform and browser as their own rows; `parseUserAgent`
  // restores that instead of dumping the raw header at the reader. The raw
  // string is dropped rather than shown alongside — it is noise to the person
  // being asked "was this you?", and the parsed form answers that better.
  const { platform, browser } = parseUserAgent(params.userAgent);
  const device =
    [browser, platform].filter(Boolean).join(' on ') ||
    params.userAgent ||
    'Unknown device';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Your password reset code</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<!-- Preheader: what the inbox list shows next to the subject. Hidden in the
     body itself, otherwise the first visible text (the logo alt) leaks in. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your one-time password expires in 10 minutes.</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:${PAPER};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">

        <tr>
          <td align="center" style="background:${NAVY};padding:28px 24px;">
            ${
              params.logoUrl
                ? `<img src="${escapeHtml(params.logoUrl)}" width="160" alt="Finance CRM" style="display:block;width:160px;max-width:60%;height:auto;border:0;" />`
                : `<div style="font:700 22px/28px ${FONT};color:#ffffff;letter-spacing:.02em;">Finance CRM</div>`
            }
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 8px 32px;">
            <p style="margin:0 0 4px 0;font:600 20px/28px ${FONT};color:${INK};">Password reset</p>
            <p style="margin:0;font:400 15px/23px ${FONT};color:${MUTED_INK};">Hi ${escapeHtml(params.name)}, use the one-time password below to set a new password for <span style="color:${INK};">${escapeHtml(params.email)}</span>.</p>
          </td>
        </tr>

        <!-- The OTP. Letter-spaced and monospace so 0/O and 1/l cannot be
             misread, and sized to survive being squinted at on a phone. -->
        <tr>
          <td align="center" style="padding:24px 32px 8px 32px;">
            <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="background:${PAPER};border:1px solid ${BORDER};border-radius:10px;">
              <tr>
                <td align="center" style="padding:18px 32px;">
                  <div style="font:600 12px/16px ${FONT};color:${MUTED_INK};text-transform:uppercase;letter-spacing:.08em;">One-time password</div>
                  <div style="padding-top:8px;font:700 34px/42px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:${NAVY};letter-spacing:.28em;">${escapeHtml(params.otp)}</div>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0 0;font:400 13px/20px ${FONT};color:${MUTED_INK};">Expires in <strong style="color:${INK};">10 minutes</strong> and can only be used once.</p>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:16px 32px 4px 32px;">
            <a href="${escapeHtml(params.crmUrl)}" style="display:inline-block;background:${ORANGE};color:#ffffff;font:600 15px/20px ${FONT};text-decoration:none;padding:13px 30px;border-radius:8px;">Open Finance CRM</a>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0 32px;">
            <div style="border-top:1px solid ${BORDER};"></div>
          </td>
        </tr>

        <!-- Request context. Small on purpose, but never removed: it is how a
             recipient who did not request this spots an account takeover. -->
        <tr>
          <td style="padding:16px 32px 0 32px;">
            <p style="margin:0 0 8px 0;font:600 12px/16px ${FONT};color:${MUTED_INK};text-transform:uppercase;letter-spacing:.06em;">Request details</p>
            <table role="presentation" border="0" cellspacing="0" cellpadding="0">
${detail('When', params.requestedAt)}
${detail('IP address', params.ipAddress ?? 'Not available')}
${detail('Device', device)}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 32px 32px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#fff8f1;border-left:3px solid ${ORANGE};border-radius:6px;">
              <tr>
                <td style="padding:12px 14px;font:400 13px/20px ${FONT};color:${INK};">
                  <strong>Didn't request this?</strong> Do not share this code with anyone. Contact
                  <a href="mailto:${escapeHtml(params.supportEmail)}" style="color:${NAVY};">${escapeHtml(params.supportEmail)}</a> (IT Support) straight away.
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

      <p style="margin:16px 0 0 0;font:400 12px/18px ${FONT};color:${MUTED_INK};">This is an automated message — please do not reply.</p>

    </td>
  </tr>
</table>
</body>
</html>`;
}
