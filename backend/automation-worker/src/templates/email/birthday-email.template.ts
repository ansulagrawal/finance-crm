import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronEmailerController::birthdayemailer()`. Legacy's footer
 * social-media icon row is dropped — those icon URLs come from PHP
 * constants with no equivalent env var/config anywhere in this backend,
 * and are decoration, not core message content.
 */
export function renderBirthdaySubject(firstName: string): string {
  return `Happy Birthday, ${firstName}! \u{1F389} A Special Day Just for You!`;
}

export function renderBirthdayHtml(
  firstName: string,
  brandName: string,
  applyNowUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Birthday Wishes</title></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #00274d, #4da8da); color: #333; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #00274d, #4da8da); padding: 20px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden;">
        <tr><td style="padding: 20px; text-align: center; color: #555;">
          <p style="font-size: 16px; margin: 10px 0;">
            Dear ${escapeHtml(firstName)}, cheers to another year of growth, happiness, and achieving your financial goals! Wishing you a fantastic birthday filled with joy and memorable moments &ndash; from all of us at
            <a href="${applyNowUrl}" target="_blank"><strong>${escapeHtml(brandName)}</strong></a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
