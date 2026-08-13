import { escapeHtml } from '@finance-crm/common';
/**
 * Ported from `CronEmailerController::loanOutstandingCustomer1To60DaysEmailer()`.
 * Legacy's actual HTML is an elaborate customer-styled notice (background
 * banners, 8 social/app-store icons, the literal text "LOANWALLE" baked
 * into the message body) — but every one of these emails is hardcoded to
 * go to `CTO_EMAIL`, not the customer (see the job's doc comment). Since
 * the real audience is internal ops, not a borrower, this port sends a
 * plain internal summary instead of reproducing customer-facing styling
 * (and a different, predecessor brand's name) for an audience of one
 * internal recipient.
 */
export function renderOutstandingLoanDigestSubject(
  brandName: string,
  loanNo: string,
  dpd: number,
): string {
  return `${brandName} | Loan Outstanding Delay ${dpd} days | ${loanNo}`;
}

export function renderOutstandingLoanDigestHtml(params: {
  custFullName: string;
  loanNo: string;
  loanAmount: string;
  finalAmount: string;
  dpd: number;
}): string {
  return `<p>Loan <b>${escapeHtml(params.loanNo)}</b> (borrower: ${escapeHtml(params.custFullName)}) is <b>${params.dpd} day(s)</b> past its repayment date.</p>
<p>Loan amount: &#8377;${params.loanAmount}<br/>Total due (incl. late interest, net of verified collections): &#8377;${params.finalAmount}</p>`;
}
