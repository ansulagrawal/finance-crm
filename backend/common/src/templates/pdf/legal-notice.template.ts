/**
 * NO LEGACY SOURCE FOUND. A repo-wide search of `old-php-files/` (views,
 * controllers, email templates) turned up no legal-notice document at all
 * — not even a generic one. This is a clearly-labeled placeholder only.
 *
 * DO NOT USE IN PRODUCTION without legal review — the wording below is
 * generic boilerplate for a pre-legal-action demand notice, not vetted
 * legal language, and does not reflect any real reviewed policy of B4
 * Salary / Acme Leasing Finance Private Limited.
 */

import { escapeHtml } from '../../html/escape-html';

export interface LegalNoticeData {
  noticeDate: string;
  borrowerFullName: string;
  borrowerAddressHtml: string;
  loanNo: string;
  outstandingAmount: number;
  dueDate: string;
  daysToRespond: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function renderLegalNoticeHtml(data: LegalNoticeData): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Legal Notice — PLACEHOLDER, NOT LEGAL-REVIEWED</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6; }
  .watermark { color: #b00; text-align: center; font-weight: bold; border: 2px solid #b00; padding: 8px; margin-bottom: 24px; }
  .signature { margin-top: 60px; }
</style>
</head>
<body>
  <div class="watermark">PLACEHOLDER TEMPLATE — NOT REVIEWED BY LEGAL COUNSEL. DO NOT SEND AS-IS.</div>

  <p>Date: ${escapeHtml(data.noticeDate)}</p>
  <p>To,<br/>${escapeHtml(data.borrowerFullName)}<br/>${escapeHtml(data.borrowerAddressHtml)}</p>

  <p><strong>Subject: Legal Notice for Recovery of Outstanding Loan Amount — Loan No. ${escapeHtml(data.loanNo)}</strong></p>

  <p>Dear ${escapeHtml(data.borrowerFullName)},</p>

  <p>This notice is issued on behalf of the Lender in respect of Loan No. <strong>${escapeHtml(data.loanNo)}</strong>
  availed by you, under which an amount of <strong>&#8377; ${formatCurrency(data.outstandingAmount)}</strong>
  fell due for repayment on <strong>${escapeHtml(data.dueDate)}</strong> and remains unpaid as of the date of this notice.</p>

  <p>You are hereby called upon to pay the aforesaid outstanding amount, together with any applicable
  interest and charges accrued thereon, within <strong>${data.daysToRespond} days</strong> of receipt of this
  notice, failing which the Lender shall be constrained to initiate such legal proceedings and other
  remedies as may be available under applicable law, entirely at your risk as to costs and consequences,
  without any further notice to you.</p>

  <p>This notice is issued without prejudice to any other rights and remedies available to the Lender
  under the loan agreement and applicable law, all of which are expressly reserved.</p>

  <div class="signature">
    <p>For and on behalf of the Lender</p>
  </div>
</body>
</html>`;
}
