import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronEmailerController::feedbackForCloseLoanEmailer()`.
 * Legacy's images, phone number, social links, and app-store badges are
 * all hosted/branded under "Loanwalle.com" (a different, predecessor
 * brand) — not ported, since sending a different company's contact
 * details to Finance CRM's own customers would be actively wrong, not just
 * a cosmetic gap. Customer Care contact reuses the real values already
 * established in `sanction-letter.template.ts`'s `GRIEVANCE_ESCALATIONS`
 * first-escalation row.
 */
const CUSTOMER_CARE_PHONE = '+91 7733866663';
const CUSTOMER_CARE_EMAIL = 'care@financecrm.com';

export function renderClosedLoanFeedbackSubject(brandName: string): string {
  return `${brandName} | FEEDBACK FORM`;
}

export function renderClosedLoanFeedbackHtml(
  customerName: string,
  brandName: string,
  feedbackUrl: string,
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Customer Feedback</title></head>
<body style="font-family: Arial, Helvetica, sans-serif;">
  <table width="550" border="0" align="center" cellpadding="0" cellspacing="0" style="padding: 10px; border: solid 2px #0363a3; border-radius: 3px;">
    <tr><td><strong style="color:#0463A3;">Dear ${escapeHtml(customerName)},</strong></td></tr>
    <tr><td>Greetings from <span style="color:#0463A3; font-size:16px;"><strong>${escapeHtml(brandName)}</strong></span></td></tr>
    <tr><td><p style="margin:0px; color:#000; line-height:25px;">Please take a few minutes to give us feedback about our service by filling in this short Customer Feedback Form.</p></td></tr>
    <tr><td><p style="margin:0px; color:#000; line-height:25px;">We are interested in your honest opinion. Your survey responses will remain confidential and will only be viewed in aggregate with answers from other respondents.</p></td></tr>
    <tr><td align="center" style="text-align:center;"><a href="${feedbackUrl}" target="_blank" style="background:#0463a3; border-radius:3px; padding:8px 30px; color:#fff; text-decoration:none; font-weight:bold;">Click Here</a></td></tr>
    <tr><td align="left"><strong style="color:#0463A3; font-size:18px;">Thank you.</strong></td></tr>
    <tr><td align="left"><strong style="color:#000; font-size:15px;">Customer Experience Team</strong></td></tr>
    <tr><td align="left"><strong style="color:#0463A3; font-size:18px;">${escapeHtml(brandName)}</strong></td></tr>
    <tr><td align="left" style="color:#000; line-height:25px;">If you are unable to click on the above button, please <a href="${feedbackUrl}" target="_blank" style="color:#0463a3; text-decoration:underline;">click here</a></td></tr>
    <tr><td colspan="3" align="center" bgcolor="#0463A3" style="padding:7px 0; color:#fff; font-size:16px; border-radius:3px;">
      <a href="tel:${CUSTOMER_CARE_PHONE}" style="color:#fff; text-decoration:none;">${CUSTOMER_CARE_PHONE}</a>
      &nbsp;|&nbsp;
      <a href="mailto:${CUSTOMER_CARE_EMAIL}" style="color:#fff; text-decoration:none;">${CUSTOMER_CARE_EMAIL}</a>
    </td></tr>
  </table>
</body>
</html>`;
}
