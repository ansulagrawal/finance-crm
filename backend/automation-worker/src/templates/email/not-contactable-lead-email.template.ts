import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronEmailerController::freshNotContactableCustomerEmailer()`.
 * Legacy sources every image (banner, rupee icon, apply button, app-store/
 * play-store badges, 6 social-media icons) from PHP constants with no
 * equivalent config anywhere in this backend — `PLACEHOLDER_IMAGE_BASE`
 * below stands in for all of them until real asset URLs are configured.
 */
const PLACEHOLDER_IMAGE_BASE = 'https://placeholder.financecrm.co.in/marketing';

export function renderNotContactableSubject(websiteName: string): string {
  return `${websiteName} Offers - Instant Personal Loan In Just 30 Minutes*`;
}

export function renderNotContactableHtml(
  websiteName: string,
  applyNowUrl: string,
  websiteUrl: string,
  infoEmail: string,
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${escapeHtml(websiteName)} Offers - Instant Personal Loan In Just 30 Minutes*</title></head>
<body style="font-family: Arial, Helvetica, sans-serif;">
  <table width="667" border="0" align="center" cellpadding="0" cellspacing="0" style="border: 1px solid #f8f9fa; border-radius: 10px; margin-top: 10px;">
    <tr><td valign="top"><a href="${applyNowUrl}"><img src="${PLACEHOLDER_IMAGE_BASE}/banner.png" alt="loan-offer-banner" width="678" height="520" /></a></td></tr>
    <tr><td align="center">
      <a href="${applyNowUrl}" style="text-transform: capitalize; color: #000; font-size: 33px; text-decoration: none;">
        Get Cash in your bank account faster than a bullet train &ndash; Quick and Easy Personal Loan from ${escapeHtml(websiteName)}
      </a>
    </td></tr>
    <tr><td align="center" style="font-size: 40px;">
      Starting from <img src="${PLACEHOLDER_IMAGE_BASE}/rupee-icon.png" alt="" style="vertical-align: middle;" /> 5000*
      <p><a href="${applyNowUrl}"><img src="${PLACEHOLDER_IMAGE_BASE}/apply-button.png" alt="Apply Now" /></a></p>
    </td></tr>
    <tr><td align="center" style="font-size:14px; font-weight:600;">
      <a href="${websiteUrl}" target="_blank" style="color:#000;">${escapeHtml(websiteUrl)}</a>
      &nbsp;|&nbsp;
      <a href="mailto:${infoEmail}" style="color:#000;">${escapeHtml(infoEmail)}</a>
    </td></tr>
  </table>
</body>
</html>`;
}
