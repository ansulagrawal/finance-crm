/**
 * Ported from `application/views/CAM/esign-consent-form.php` — the legacy
 * app's pre-esign "Key Fact Statement" consent screen shown to the borrower
 * before they e-sign the sanction letter.
 *
 * NAMING NOTE: the plan calls for an "AA (Account Aggregator) consent form"
 * template. The legacy codebase has NO such document — the only AA-related
 * legacy view (`application/views/Support/accountAggregator.php`) is an
 * internal ops/support screen for inspecting AA connection logs, not a
 * customer-facing consent PDF. This template (the real KFS consent screen)
 * is the closest legacy equivalent and is exposed as
 * `renderAccountAggregatorConsentHtml` for now — **flag this naming gap to
 * business/legal**: if a distinct RBI Account-Aggregator-flow consent
 * document is actually required (separate from the loan KFS), it needs to
 * be authored fresh, not ported, since no legacy source exists for it.
 */

import { escapeHtml } from '../../html/escape-html';

export interface ConsentFormData {
  borrowerFullName: string;
  loanAmount: number;
  roiPerDay: number;
  tenureDays: number;
  adminFee: number;
  netDisbursalAmount: number;
  repaymentAmount: number;
  nodalGrievanceOfficerName: string;
  nodalGrievanceOfficerMobile: string;
  nodalGrievanceOfficerAddress: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function renderAccountAggregatorConsentHtml(
  data: ConsentFormData,
): string {
  const totalInterest =
    (data.loanAmount * data.roiPerDay * data.tenureDays) / 100;
  const apr = Math.round(data.roiPerDay * 365 * 100) / 100;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Key Fact Statement — Consent</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #f2f2f2; }
  h1 { text-align: center; color: #274683; font-size: 22px; }
</style>
</head>
<body>
  <h1>Key Fact Statement</h1>
  <table>
    <tr><th>S.No.</th><th>Parameters</th><th>Details</th></tr>
    <tr><td>(I)</td><td>Name</td><td>${escapeHtml(data.borrowerFullName)}</td></tr>
    <tr><td>(II)</td><td>Loan Amount</td><td>&#8377; ${formatCurrency(data.loanAmount)}</td></tr>
    <tr><td>(III)</td><td>ROI (in % per day)</td><td>${data.roiPerDay.toFixed(2)}</td></tr>
    <tr><td>(IV)</td><td>Total interest charge during the entire Tenure of the loan</td><td>&#8377; ${formatCurrency(totalInterest)}</td></tr>
    <tr><td>(V)</td><td>Processing Fee (Including 18% GST)</td><td>&#8377; ${formatCurrency(data.adminFee)}</td></tr>
    <tr><td>(VI)</td><td>Insurance charges, if any (in &#8377;)</td><td>Nil</td></tr>
    <tr><td>(VII)</td><td>Others (if any) (in &#8377;)</td><td>Nil</td></tr>
    <tr><td>(VIII)</td><td>Net disbursed amount</td><td>&#8377; ${formatCurrency(data.netDisbursalAmount)}</td></tr>
    <tr><td>(IX)</td><td>Total Repayment Amount</td><td>&#8377; ${formatCurrency(data.repaymentAmount)}</td></tr>
    <tr><td>(X)</td><td>Annual Percentage Rate (considering the ROI of ${data.roiPerDay.toFixed(2)}% per day)</td><td>${apr}%</td></tr>
    <tr><td>(XI)</td><td>Tenure of the Loan (days)</td><td>${data.tenureDays} Days</td></tr>
    <tr><td>(XII)</td><td>Repayment frequency by the borrower</td><td>One Time Only</td></tr>
    <tr><td>(XIII)</td><td>Number of installments of repayment</td><td>1</td></tr>
    <tr><td>(XIV)</td><td>Amount of each installment of repayment (in &#8377;)</td><td>Same as (IX)</td></tr>
    <tr><td colspan="3"><strong>Details about Contingent Charges</strong></td></tr>
    <tr><td>(XV)</td><td>Rate of annualized penal charges in case of delayed payments (if any)</td><td>Double the rate at (III)</td></tr>
    <tr><td colspan="3"><strong>Other Disclosures</strong></td></tr>
    <tr><td>(XVI)</td><td>Cooling off/look-up period during which borrower shall not be charged any penalty on prepayment of loan</td><td>3 Days</td></tr>
    <tr><td>(XVII)</td><td>Name, designation, address and phone number of nodal grievance redressal officer designated to deal with digital lending related complaints/issues</td>
        <td>${escapeHtml(data.nodalGrievanceOfficerName)}<br/>Mobile: ${escapeHtml(data.nodalGrievanceOfficerMobile)}<br/>Address: ${escapeHtml(data.nodalGrievanceOfficerAddress)}</td></tr>
  </table>
  <p>I have read and agree to the Key Fact Statement.</p>
</body>
</html>`;
}
