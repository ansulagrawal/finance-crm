/**
 * Structurally inspired by the legacy `application/views/cibil_pdf.php`
 * (titled "Consumer Base Report" — actually a CRIF High Mark bureau report,
 * "PERFORM CONSUMER 2.0" score model, not literally CIBIL/TransUnion — the
 * legacy filename is historical/generic naming, not accurate to the vendor).
 *
 * IMPORTANT: the legacy view file was NOT used as a content source beyond
 * section names and column headers (Score, "Personal Information -
 * Variations", "Account Summary", "Reported On", etc). It appears to
 * contain a real individual's actual bureau data hardcoded directly into
 * the file (a name, DOB, phone numbers, a voter ID) rather than templated
 * placeholders — this looks like a real PII exposure in the legacy
 * codebase and should be flagged for a security/data-handling review
 * separately from this migration. None of those values were copied here;
 * this template only reproduces the generic report *structure*, driven
 * entirely by the data object below.
 */

import { escapeHtml } from '../../html/escape-html';

export interface CibilReportData {
  reportDate: string;
  applicantName: string;
  panNumber: string;
  score: number;
  scoreRangeLabel: string;
  scoreModelName: string;
  accountSummary: {
    totalAccounts: number;
    activeAccounts: number;
    closedAccounts: number;
    overdueAccounts: number;
    totalOutstandingBalance: number;
    totalSanctionedAmount: number;
  };
  accounts: Array<{
    lenderName: string;
    accountType: string;
    accountNumberMasked: string;
    dateOpened: string;
    sanctionedAmount: number;
    currentBalance: number;
    overdueAmount: number;
    accountStatus: string;
    paymentHistory: string;
  }>;
  enquiries: Array<{
    enquiryDate: string;
    lenderName: string;
    enquiryPurpose: string;
    amount: number;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    amount,
  );
}

export function renderCibilReportHtml(data: CibilReportData): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Consumer Credit Bureau Report</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
  th { background: #0f3f6b; color: #fff; }
  .section-header { background: #0f3f6b; color: #fff; font-weight: bold; padding: 8px; }
  .score-box { text-align: center; padding: 16px; border: 2px solid #0f3f6b; width: 220px; }
  .score-value { font-size: 36px; font-weight: bold; color: #0f3f6b; }
</style>
</head>
<body>
  <h2>Consumer Credit Bureau Report</h2>
  <p>Report Date: ${escapeHtml(data.reportDate)} &nbsp;|&nbsp; Applicant: ${escapeHtml(data.applicantName)} &nbsp;|&nbsp; PAN: ${escapeHtml(data.panNumber)}</p>

  <div class="section-header">Credit Score</div>
  <div class="score-box">
    <div class="score-value">${escapeHtml(data.score)}</div>
    <div>${escapeHtml(data.scoreModelName)}</div>
    <div>Score Range: ${escapeHtml(data.scoreRangeLabel)}</div>
  </div>

  <div class="section-header">Account Summary</div>
  <table>
    <tr><th>Total Accounts</th><th>Active</th><th>Closed</th><th>Overdue</th><th>Total Outstanding</th><th>Total Sanctioned</th></tr>
    <tr>
      <td>${data.accountSummary.totalAccounts}</td>
      <td>${data.accountSummary.activeAccounts}</td>
      <td>${data.accountSummary.closedAccounts}</td>
      <td>${data.accountSummary.overdueAccounts}</td>
      <td>&#8377; ${formatCurrency(data.accountSummary.totalOutstandingBalance)}</td>
      <td>&#8377; ${formatCurrency(data.accountSummary.totalSanctionedAmount)}</td>
    </tr>
  </table>

  <div class="section-header">Accounts</div>
  <table>
    <tr>
      <th>Lender</th><th>Type</th><th>Account No.</th><th>Opened</th>
      <th>Sanctioned</th><th>Balance</th><th>Overdue</th><th>Status</th><th>Payment History</th>
    </tr>
    ${data.accounts
      .map(
        (a) => `<tr>
      <td>${escapeHtml(a.lenderName)}</td><td>${escapeHtml(a.accountType)}</td><td>${escapeHtml(a.accountNumberMasked)}</td><td>${escapeHtml(a.dateOpened)}</td>
      <td>&#8377; ${formatCurrency(a.sanctionedAmount)}</td><td>&#8377; ${formatCurrency(a.currentBalance)}</td>
      <td>&#8377; ${formatCurrency(a.overdueAmount)}</td><td>${escapeHtml(a.accountStatus)}</td><td>${escapeHtml(a.paymentHistory)}</td>
    </tr>`,
      )
      .join('\n    ')}
  </table>

  <div class="section-header">Enquiries</div>
  <table>
    <tr><th>Date</th><th>Lender</th><th>Purpose</th><th>Amount</th></tr>
    ${data.enquiries
      .map(
        (e) =>
          `<tr><td>${escapeHtml(e.enquiryDate)}</td><td>${escapeHtml(e.lenderName)}</td><td>${escapeHtml(e.enquiryPurpose)}</td><td>&#8377; ${formatCurrency(e.amount)}</td></tr>`,
      )
      .join('\n    ')}
  </table>
</body>
</html>`;
}
