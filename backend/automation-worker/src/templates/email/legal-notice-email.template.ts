import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronLegalEmailerController::legalNoticeEmailer()`
 * (`CronJobs/CronLegalEmailerController.php`) — confirmed live and
 * correctly branded for the current entity (Acme Financial Services
 * Pvt Ltd / Finance CRM), unlike the differently-scoped, wrong-entity
 * `CronEmailerController::legalNoticeEmailer()` this session earlier
 * (correctly) excluded. Only the `'dn'` (Demand Notice) type is built —
 * the only type this backend's real crontab schedules
 * (`legalNoticeEmailer dn 60 90`); `'fn'`/`'lrn'` share the same function
 * but aren't scheduled anywhere, so their day-count/subject-prefix
 * variants aren't ported.
 *
 * **Deliberate deviation**: legacy's body says "Please find attached a
 * Demand Notice..." implying a PDF attachment — this backend's generic
 * email-send endpoint has no attachment support, and the only existing
 * legal-notice PDF template (`core-api`'s `LegalNoticeService`) is a
 * watermarked "NOT REVIEWED BY LEGAL COUNSEL" placeholder that must not
 * go out attached to a real, live notice email. The wording below states
 * the notice inline instead of claiming an attachment that doesn't
 * exist — a real communication to a real borrower must not misrepresent
 * what was sent.
 */
export function renderLegalNoticeEmailSubject(
  loanNo: string,
  custFullName: string,
): string {
  return `Demand Notice Loan ID: ${loanNo} - Name : ${custFullName}`;
}

export function renderLegalNoticeEmailHtml(params: {
  custFullName: string;
  companyName: string;
  loanNo: string;
  outstandingAmount: string;
  daysToRespond: number;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Demand Notice ${escapeHtml(params.companyName)}</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;">
  <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin: 20px auto; border: 1px solid #000000; background: #ffffff;">
    <tr>
      <td style="padding: 20px;">
        <table style="width: 100%;">
          <tr><td>Dear <b>${escapeHtml(params.custFullName)}</b>,</td></tr>
          <tr><td>&nbsp;</td></tr>
          <tr>
            <td>
              This is a Demand Notice issued on behalf of our client,
              <b>${escapeHtml(params.companyName)}</b>, in relation to the loan availed by you
              under Loan Agreement bearing Loan ID: <b>${escapeHtml(params.loanNo)}</b> bearing
              total outstanding dues of Rs. <b>${params.outstandingAmount} till date</b>.
            </td>
          </tr>
          <tr><td>&nbsp;</td></tr>
          <tr>
            <td>
              As per the terms of the agreement, there is an outstanding amount, which remains
              unpaid despite multiple reminders. You are hereby requested to clear the dues
              within <b>${params.daysToRespond} days</b> from the date of receipt of this notice
              to avoid legal action.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
