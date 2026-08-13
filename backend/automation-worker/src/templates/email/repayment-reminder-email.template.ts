import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronEmailerController::repaymentReminder5Day()`..`repaymentReminder0Day()`
 * (`RepaymentReminderEmailService`). Legacy's brand logo image, "{N}Days.png"
 * illustration, and 5 social-media icons all come from PHP constants with
 * no equivalent config anywhere in this backend — dropped rather than
 * fabricated, same as `birthday-email.template.ts`. The phone/collection-
 * email contact line is also dropped rather than invented — unlike a
 * decorative image, a fabricated phone number a customer might actually
 * call is a real risk, not just a cosmetic gap.
 */
export function renderRepaymentReminderSubject(
  daysBefore: number,
  loanNo: string,
): string {
  const dayLabel = daysBefore === 0 ? 'Today' : `${daysBefore} Days Left`;
  return `Reminder: ${dayLabel} for Loan Repayment - Application No: ${loanNo}`;
}

export function renderRepaymentReminderHtml(params: {
  custFullName: string;
  loanNo: string;
  repaymentAmount: string;
  repaymentDate: string;
  daysBefore: number;
  brandName: string;
  repaymentLinkUrl: string;
}): string {
  const dueClause =
    params.daysBefore === 0
      ? `is due today, ${params.repaymentDate}`
      : `is due on ${params.repaymentDate}. This is a friendly reminder that you have ${params.daysBefore} day(s) left to make the payment`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Repayment Reminder | ${escapeHtml(params.brandName)}</title></head>
<body style="font-family: Arial, Helvetica, sans-serif; color: #383535;">
  <table width="100%" border="0" style="padding: 20px; background: #fff;">
    <tr><td>
      <h3>Dear ${escapeHtml(params.custFullName)},</h3>
      <p style="line-height: 25px; margin: 0px; text-align: justify;">
        Your loan payment of <b>&#8377;${params.repaymentAmount}</b> against Application No: <b>${escapeHtml(params.loanNo)}</b> ${dueClause}.
        Kindly ensure the payment is made on or before the due date to avoid any late fees or penalties.
        Please visit <a href="${params.repaymentLinkUrl}" target="_blank" style="color:#0463a3">${params.repaymentLinkUrl}</a>.
        <br>If you have already made the payment, please ignore this message.
      </p>
    </td></tr>
    <tr><td>
      <p style="line-height: 25px; margin: 0px;">
        <b>Thank you,<br /><br />${escapeHtml(params.brandName)} Collection Department</b>
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}
