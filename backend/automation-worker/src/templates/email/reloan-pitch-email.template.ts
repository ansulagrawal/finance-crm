import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronEmailerController::notificationSendMailAndWhatsapp()`.
 * The brand logo URL is real and currently hosted (the `sl-website`
 * S3 bucket — "salaryontime", this brand's actual domain, unlike the
 * LoanWalle-branded assets in `closed-loan-feedback-email.template.ts`),
 * so it's kept as-is rather than dropped/placeholdered.
 */
export const RELOAN_PITCH_SUBJECT =
  'Ready for Another Loan? Get It in Just 10 Minutes! \u{1F60A}';

const BRAND_LOGO_URL =
  'https://sl-website.s3.ap-south-1.amazonaws.com/upload/company_logo.png';

export function renderReloanPitchHtml(
  firstName: string,
  applyNowUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Quick Loan Offer</title></head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f9; color: #333;">
  <div style="width: 100%; max-width: 600px; margin: 50px auto; padding: 20px; background-color: #fff; border-radius: 8px;">
    <div style="text-align: center; padding: 20px; background-color: #007bff; color: #fff; border-radius: 8px 8px 0 0;">
      <img src="${BRAND_LOGO_URL}" alt="Brand Logo" style="max-width: 150px; height: auto;">
      <h1 style="font-size: 24px; margin: 0;">Dear ${escapeHtml(firstName)},</h1>
      <p style="margin: 5px;">Looking for a quick and hassle-free loan? We're here to help! \u{1F60A}</p>
    </div>
    <div style="padding: 20px; font-size: 16px; line-height: 1.5;">
      <p>With your trusted loan partner, getting a loan is easier than ever. Apply now and have the amount directly in your bank account in just 10 minutes!</p>
      <h3 style="color: #007bff; font-size: 20px;">Why choose us?</h3>
      <ul>
        <li>100% Online Process - Apply anytime, anywhere.</li>
        <li>Quick Loan Disbursal - Get funds in your account in just 10 minutes.</li>
        <li>Direct Bank Transfer - No hassle, no delays.</li>
        <li>No Collateral Required - Borrow with ease.</li>
      </ul>
      <div style="text-align: center; margin-top: 30px;">
        <a href="${applyNowUrl}" style="padding: 12px 25px; background-color: #28a745; color: #fff; font-size: 18px; text-decoration: none; border-radius: 5px; display: inline-block;">Apply Now</a>
      </div>
    </div>
    <div style="text-align: center; font-size: 12px; color: #777; margin-top: 30px;">
      <p>Your financial emergency is our priority.</p>
    </div>
  </div>
</body>
</html>`;
}
