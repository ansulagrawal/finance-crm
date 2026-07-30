/**
 * Ported (content preserved verbatim, markup modernized) from the legacy
 * app's `components/includes/emailer/sanction_latter.php`
 * (`prepare_kfs_latter_call`), which renders one combined PDF containing
 * the Key Fact Statement (RBI digital-lending KFS format) AND the full
 * 26-clause Loan Agreement in a single document — the legacy app does not
 * produce these as two separate PDFs, so this library exposes one
 * template and the plan's "sanction letter" / "loan agreement" outputs are
 * both this same document (see `renderLoanAgreement` alias at the bottom).
 *
 * The lender entity name, CIN, and grievance-officer contact details below
 * are real values found in the legacy source (Acme Leasing Finance
 * Private Limited, the NBFC Finance CRM operates under) — do not treat them
 * as placeholders. Business/legal should still review this before
 * production use, since the legacy source itself may be stale.
 *
 * Lender identity (name/CIN/registered office/logo) is DB-backed via the
 * `Company` entity — see `SanctionLetterService`, which resolves the
 * lead's `Company` row and falls back to these legacy-source defaults
 * when a lead has no company assigned (`Lead.company` is nullable).
 */

import { escapeHtml } from '../../html/escape-html';

export interface SanctionLetterData {
  loanNo: string;
  applicationNo: string;
  loanAmount: number;
  tenureDays: number;
  repaymentAmount: number;
  repaymentDate: string;
  netDisbursalAmount: number;
  disbursalDate: string;
  bankAccountNumber: string;
  ifscCode: string;
  roiPerDay: number;
  agreementDate: string;
  adminFee: number;
  borrowerTitle: 'Mr.' | 'Ms.';
  borrowerFullName: string;
  fatherName: string;
  panNumber: string;
  residenceAddressHtml: string;
  lenderName: string;
  lenderCin: string;
  lenderRegisteredOffice: string;
  /** Data URI of the company logo, omitted if the company has none on file. */
  logoDataUri?: string;
}

export const DEFAULT_LENDER_NAME = 'Acme Leasing Finance Private Limited';
export const DEFAULT_LENDER_CIN = 'U74899DL1993PTC053939';
export const DEFAULT_LENDER_REGISTERED_OFFICE =
  'B-7, New Multan Nagar, Paschim Vihar, New Delhi- 110056';

const GRIEVANCE_ESCALATIONS = [
  {
    level: 'First Escalation',
    role: 'Customer Care',
    name: null,
    phone: '+91 7733866663',
    email: 'care@financecrm.com',
    note: 'If the issue is not resolved within 7 days of raising the issue, the customer shall raise the issue with the Grievance Officer.',
  },
  {
    level: 'Second Escalation',
    role: 'Grievance Officer',
    name: 'Vicky Gupta',
    phone: '+91 7733866660',
    email: 'grievance@financecrm.com',
    note: 'If the issue is not resolved within 7 days of raising the issue, the customer shall raise the further issue with the Nodal Officer.',
  },
  {
    level: 'Third Escalation',
    role: 'Nodal Officer',
    name: 'Swati',
    phone: '+91 7733866661',
    email: 'nodalofficer@acmefinance.com',
    note: 'Final escalation level for unresolved grievances.',
  },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

const STYLE = `
  body { font-family: Arial, Helvetica, sans-serif; font-size: 14px; margin: 0; padding: 0; }
  table { border-collapse: collapse; width: 100%; }
  .main-table { width: 800px; margin: 0 auto; background: #ffffff; border: 1px solid #cccccc; }
  .main-table td, .main-table th, .inner-table td, .inner-table th {
    border: 1px solid #cccccc; padding: 8px; vertical-align: top;
  }
  .title { text-align: center; font-size: 30px; font-weight: bold; }
  .center { text-align: center; }
  .sno { width: 8%; text-align: center; }
  ol { margin: 10px 0 0 20px; padding: 0; }
  li { margin-bottom: 6px; }
  h2 { font-size: 16px; margin: 16px 0 8px; }
`;

export function renderSanctionLetterAndLoanAgreementHtml(
  data: SanctionLetterData,
): string {
  const aprPercentage = Math.round(data.roiPerDay * 365 * 100) / 100;
  const penalInterestPerDay = Math.round(data.roiPerDay * 2 * 100) / 100;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Key Fact Statement &amp; Loan Agreement</title>
<style>${STYLE}</style>
</head>
<body>
<table class="main-table">
  ${data.logoDataUri ? `<tr><td class="center"><img src="${escapeHtml(data.logoDataUri)}" alt="${escapeHtml(data.lenderName)}" style="max-height: 60px;" /></td></tr>` : ''}
  <tr><td class="title">Key Fact Statement</td></tr>
  <tr><td class="center"><strong>Aadhaar Part &ndash; 1 (Interest rate and fees/charges)</strong></td></tr>
  <tr><td>
    <table class="inner-table">
      <tr><th>S. No.</th><th>Particulars</th><th>Details</th></tr>
      <tr><td>1</td><td><strong>Loan proposal / account No.</strong><br/>Type of Loan</td>
          <td><strong>${escapeHtml(data.loanNo)}</strong><br/>Unsecured Short Term Personal Loan</td></tr>
      <tr><td>2</td><td><strong>Sanctioned Loan amount (in Rupees)</strong></td>
          <td><strong>INR ${formatCurrency(data.loanAmount)}/-</strong></td></tr>
      <tr><td>3</td><td><strong>Disbursal schedule</strong></td>
          <td>100% upfront. Stage-wise disbursement is not applicable.</td></tr>
      <tr><td>4</td><td><strong>Loan term</strong></td><td><strong>${data.tenureDays} (days)</strong></td></tr>
      <tr><td>5</td><td><strong>Instalment details</strong></td><td>Not Applicable</td></tr>
      <tr><td>6</td><td><strong>Interest rate (%) and type</strong></td>
          <td>${data.roiPerDay.toFixed(2)}% per day (Fixed)</td></tr>
      <tr><td>7</td><td><strong>Additional information in case of floating rate</strong></td><td>Not Applicable</td></tr>
      <tr><td rowspan="2">8</td><td rowspan="2"><strong>Fee / Charges</strong></td>
          <td>Processing fees (Excluding GST): INR ${formatCurrency(data.adminFee)} (10% of the Principal Amount)</td></tr>
      <tr><td>Insurance charges: NA. Any other charges: NA.<br/>*GST on processing fees is applicable @ 18%. The above-mentioned charges are payable to Regulated Entity ("RE") only. RE shall deduct the processing fees from the sanctioned Loan Amount. No charges are payable to a third party through Regulated Entity.</td></tr>
      <tr><td>9</td><td><strong>Annual Percentage Rate (APR %)</strong></td><td><strong>${aprPercentage}%</strong></td></tr>
      <tr><td>10</td><td><strong>Repayment amount</strong></td><td><strong>INR ${formatCurrency(data.repaymentAmount)}</strong></td></tr>
      <tr><td>11</td><td><strong>Repayment Date</strong></td><td><strong>${escapeHtml(data.repaymentDate)}</strong></td></tr>
      <tr><td>12</td><td><strong>Details of Contingent Charges</strong></td><td>&nbsp;</td></tr>
      <tr><td>13</td><td><strong>Penal Interest (%) per day</strong></td><td><strong>${penalInterestPerDay}</strong></td></tr>
    </table>
  </td></tr>
  <tr><td class="center">Part &ndash; 2 (Other qualitative information)</td></tr>
  <tr><td>
    <table class="inner-table">
      <tr><td>1</td><td>Clause of Loan Agreement relating to engagement of recovery agents</td><td class="center">Clause 12 of the Loan Agreement</td></tr>
      <tr><td>2</td><td>Clause relating to grievance redressal mechanism</td><td class="center">Clause 15 of the Loan Agreement</td></tr>
      <tr><td>3</td><td>Whether the loan is, or in future may be, subject to securitisation to other REs (Yes/No)</td><td class="center">No</td></tr>
      <tr><td>4</td><td>Cooling off/look-up period during which borrower shall not be charged any penalty on prepayment of loan</td><td class="center">3 days</td></tr>
    </table>
  </td></tr>

  <tr><td><p><strong>Privileged and Confidential</strong><br/><strong>Loan Application Number: ${escapeHtml(data.applicationNo)}</strong></p></td></tr>
  <tr><td><p><strong>This Loan Agreement</strong> is made and executed at Delhi on <strong>${escapeHtml(data.agreementDate)}</strong> bearing the Loan Application Number <strong>${escapeHtml(data.applicationNo)}</strong></p></td></tr>
  <tr><td class="center"><strong>BETWEEN</strong></td></tr>
  <tr><td>M/s ${escapeHtml(data.lenderName)} (<strong>&ldquo;${escapeHtml(data.lenderName.split(' ')[0])}&rdquo;</strong>), a company incorporated under the provisions of the Companies Act, 1956 and registered under the provisions of RBI Act, 1934 (as amended up to date) bearing CIN-${escapeHtml(data.lenderCin)}, having its registered office situated at ${escapeHtml(data.lenderRegisteredOffice)}, hereinafter referred to as <strong>&ldquo;Lender&rdquo;</strong> (which expression unless it be repugnant to the context or meaning thereof be deemed to mean and include its legal representative, assignee and administrator) of the First Part</td></tr>
  <tr><td><p><strong>${escapeHtml(data.borrowerTitle)} ${escapeHtml(data.borrowerFullName)}</strong> s/o <strong>Mr. ${escapeHtml(data.fatherName)}</strong> residing at <strong>${escapeHtml(data.residenceAddressHtml)}</strong> having PAN Number <strong>${escapeHtml(data.panNumber)},</strong> hereinafter referred to as <strong>&ldquo;Borrower&rdquo;</strong> (which expression unless it be repugnant to the context or meaning thereof be deemed to mean and include his/her legal representative, assignee and administrator) of the Other Part</p></td></tr>
  <tr><td>The Lender and Borrower, wherever the context so requires, hereinafter collectively referred to as <strong>&ldquo;Parties&rdquo;</strong> and individually referred to as <strong>&ldquo;Party&rdquo;</strong>.</td></tr>

  <tr><td><strong>WHEREAS</strong></td></tr>
  <tr><td>a) The Lender is an RBI approved Non-Banking Financial company engaged in the business of providing Short Term Loans to salaried individuals.</td></tr>
  <tr><td>b) The Borrower has approached the Lender for the purpose of availing an unsecured loan on <strong>${escapeHtml(data.disbursalDate)}</strong> through the online lending platform provided.</td></tr>
  <tr><td>c) The Borrower has requested the Lender for a grant of loan, for an aggregate amount of <strong>INR ${formatCurrency(data.loanAmount)}/-</strong> (&ldquo;Loan Amount&rdquo;) from the Lender, subject to the terms and conditions contained and agreed hereinunder.</td></tr>
  <tr><td>d) The Lender has made due diligence and KYC checks to meet its standard policy of loan approval and disbursement.</td></tr>
  <tr><td>e) The Lender hereby agrees to grant the Borrower the loan amount for the term as specified in the KFS annexed herein with the Loan Agreement and the Borrower accepts the loan and agrees to repay the loan amount in accordance with the terms hereunder.</td></tr>
  <tr><td>f) The Parties agree that the Lender shall disburse the Loan Amount after deduction of the applicable processing fee, and the Borrower shall receive the net disbursal amount as INR ${formatCurrency(data.netDisbursalAmount)}/- accordingly.</td></tr>
  <tr><td>g) The Borrower hereby agrees to repay the loan amount as INR ${formatCurrency(data.loanAmount)}/- on the repayment date - ${escapeHtml(data.repaymentDate)}.</td></tr>

  <tr><td><p><strong>NOW THEREFORE, IN CONSIDERATION OF THE MUTUAL PROMISES, COVENANTS AND CONDITIONS HEREIN AFTER SET FORTH, THE RECEIPT AND SUFFICIENCY OF WHICH IS HEREBY ACKNOWLEDGED, THE PARTIES HERETO AGREE AS FOLLOWS:</strong></p></td></tr>

  <tr><td><h2>1. FACILITY</h2>The Lender at the request of the Borrower, has agreed to lend to the Borrower and the Borrower agreed to borrow from the Lender, the Facility as mentioned in the Terms annexed to this Agreement, on the basis of, and subject to the terms and conditions herein set forth.</td></tr>

  <tr><td><h2>2. COMMENCEMENT</h2>This agreement shall come into effect from the date of this agreement as recorded in the KFS and Terms appended to this agreement and shall remain valid till the Final Repayment Date, as applicable, or until the entire outstanding amount and dues are paid in full unless terminated before the Repayment Date or any other date.</td></tr>

  <tr><td><h2>3. BORROWER ACKNOWLEDGEMENTS AND CONFIRMATION</h2>Borrower hereby acknowledges and confirms the following:
    <ol>
      <li>I have personally applied for the Loan on the website or web application after understanding the terms and conditions of use and Privacy Policies listed on the website or web application and I confirm acceptance of the same.</li>
      <li>I acknowledge that my Name, details of Permanent Account Number (PAN), Aadhaar Card or any other Address and Identity proof are obtained by the Lender from the materials I have submitted on the website or web application as part of my profile and loan application for review with my consent.</li>
      <li>I understand the terms and conditions of the loan to be granted by the Lender are approved as per the internal policies of the Lender.</li>
      <li>I further acknowledge, understand and agree that Lender has adopted risk-based pricing, arrived at by taking into account broad parameters like the customer's financial and credit profile and information and data obtained from various permissions/information granted/provided by me.</li>
      <li>I understand all the terms listed above and hereby make a drawdown request of the Loan from the Lender and instruct the Lender to transfer the Loan amount to my bank account after deducting all such applicable charges and fees as specified in the KFS.</li>
      <li>The Lender shall assign a unique Loan ID in relation to the transaction on disbursement of the Disbursal Amount.</li>
      <li>I further affirm that the information and details provided by me for registration and in the loan application and the documents submitted by me are true, correct, and that I have not withheld any information.</li>
      <li>I have read and understood the fees and charges applicable to the Loan that I may avail.</li>
      <li>The Borrower expressly acknowledges and agrees that the interest rate applicable to the Loan has been determined by the Lender in accordance with its Board-approved Interest Rate Policy, based on a risk-based pricing model, and confirms that the applicable interest rate, repayment obligation, and total cost of the Loan were clearly disclosed prior to disbursement and voluntarily accepted without coercion, inducement, or misrepresentation.</li>
      <li>I confirm that no insolvency proceedings or suits for recovery of outstanding dues have been initiated and/or are pending against me.</li>
      <li>I hereby confirm that I contacted the Lender for my requirement of a personal loan through the website or web application directly and no representative of the Lender emphasized me directly/indirectly to make this application.</li>
      <li>The Borrower expressly confirms that the Annual Percentage Rate (APR), the total repayment obligation, fees and charges, have been clearly disclosed in the Key Fact Statement prior to disbursement and fully understood and voluntarily accepted.</li>
      <li>The Borrower acknowledges that the Processing Fee has been disclosed upfront in the Key Fact Statement and agreed as part of the total cost of credit.</li>
    </ol>
  </td></tr>

  <tr><td><h2>4. BORROWER AUTHORISATIONS</h2>
    <ol>
      <li>I hereby authorize the Lender to exchange or share information and details relating to this Application Form with its associate companies or any third party, as required, for processing this loan application and/or related offerings.</li>
      <li>I hereby give my consent to authorize the Lender to increase or decrease the credit limit assigned to me based on the Lender's internal credit policy.</li>
      <li>By submitting this Application Form, I hereby expressly authorize the Lender to send me communications regarding various financial products through calls/SMS/email/post, including promotional communications, and confirm I shall not challenge receipt of such communications as unsolicited communication under TRAI regulations on the Do Not Call Registry.</li>
      <li>The Lender shall have the absolute right, at any time, to disclose, share, report, or submit any information relating to the Borrower to the Credit Information Bureau of India (CIBIL) and/or any other credit information company, credit bureau, or governmental/regulatory/statutory/judicial authority, as permitted under the Digital Personal Data Protection Act, 2023 and other applicable law.</li>
      <li>The Borrower hereby expressly consents to such disclosure and further authorises the Lender to use such information for KYC verification, credit appraisal, credit risk assessment, reporting, compliance, recovery, or any other lawful purpose, and consents to the Lender obtaining credit information and reports relating to the Borrower from CIBIL and/or any other credit information company from time to time.</li>
      <li>The Borrower agrees and acknowledges that the Lender is entitled to deduct all applicable charges, as detailed in the KFS and Terms, from the Principal Amount.</li>
      <li>The Borrower shall not raise any objection or claim in relation to the process, method, storage, or means of authentication of execution of this Agreement or any related documents.</li>
      <li>The Borrower declares that the Loan has been availed at the Borrower's sole request and commercial discretion, after fully understanding the terms and conditions, including interest rate, charges, penal charges, repayment structure, and consequences of default, and confirms sufficient time and opportunity were provided to review the Loan Documents and exercise the cooling-off/look-up period.</li>
      <li>The funds shall be used for the Purpose specified in the Key Fact Statement and will not be used for speculative or anti-social purposes.</li>
      <li>I have understood and accepted the late payment and other default charges listed in the Key Fact Statement.</li>
    </ol>
  </td></tr>

  <tr><td><h2>5. REPRESENTATIONS AND WARRANTIES OF PARTIES</h2>Each party makes the following representations and warranties with respect to itself, and confirms they are true, correct and valid:
    <ol>
      <li>Each Party has full power and authority to enter, deliver and perform the terms and provisions of this agreement.</li>
      <li>Each Party's obligations under this agreement are legal, valid, binding and enforceable in accordance with the terms hereof.</li>
      <li>The Borrower represents and warrants that: (i) the Borrower is at least 18 years of age and competent to contract under the Indian Contract Act, 1872; (ii) the Borrower is a citizen of India and resident in India for taxation and foreign exchange purposes; (iii) no litigation, claim, dispute or proceeding is pending against the Borrower that would adversely affect this Agreement; (iv) the Borrower has not entered into any agreement preventing fulfilment of obligations hereunder; (v) no event has occurred which would prejudicially affect the Lender's interest or the Borrower's ability to perform its obligations; (vi) the Borrower is not in default of payment of any taxes or Government dues; (vii) the Borrower shall do all acts required to give effect to this Agreement; (viii) the Borrower has reviewed the Fair Practices Code of the Lender and agrees the Loan shall be governed accordingly.</li>
      <li>The Borrower covenants that: (i) it shall perform all obligations under this Agreement; (ii) it shall promptly deliver all documents required by the Lender; (iii) it shall not close its bank account without prior intimation to the Lender; (iv) it authorises the Lender to communicate via email, WhatsApp, SMS or calls to reference numbers if unreachable; (v) it shall promptly notify the Lender of any litigation; (vi) it shall notify the Lender in writing within 7 days of any change of address; (vii) it shall not leave India for employment, long-term study, business or stay abroad without fully repaying amounts payable and obtaining an NOC; (viii) it has read all terms, conditions and the privacy policy of the Lender and understands its obligations; (ix) it unconditionally agrees to abide by such terms; (x) the information and financial details submitted are true and correct; (xi) the amount disbursed shall be used for lawful purposes only.</li>
    </ol>
  </td></tr>

  <tr><td><h2>6. OTHER COVENANTS AND CONSENTS OF THE BORROWER</h2>
    <ol>
      <li>The Lender shall be entitled to outsource any of its functions to any third party in line with RBI guidelines, including sending notices to the Borrower to the extent prescribed under applicable law.</li>
      <li>The Borrower declares that they can read and understand the terms in English and agree to receive all documents/correspondence in English, and if not, confirms having taken assistance to have the terms explained in their vernacular language.</li>
    </ol>
  </td></tr>

  <tr><td><h2>7. RIGHTS AND REMEDIES OF THE LENDER</h2>The Lender shall have the discretion not to disburse any amount under the loan unless the following conditions are complied with, in the sole discretion of the Lender:
    <ol>
      <li>The Borrower shall have provided such information as may be called by the Lender to verify creditworthiness.</li>
      <li>The Borrower submits, to the Lender's satisfaction, all documents required for verification under the Lender's policies.</li>
      <li>The Borrower submits an eNACH mandate towards repayment of all instalments. The Borrower must provide at least two reference mobile numbers for communication regarding timely repayment; in the event of failure to repay in the stipulated time, the Lender shall intimate the Borrower and, absent a response, may contact the reference numbers during permitted hours as prescribed under applicable RBI guidelines.</li>
      <li>In case of failed payments, the Lender holds the right to apply direct debit on the Borrower's bank account as and when required until the outstanding amount is recovered; the Borrower agrees to be responsible for any charges levied by their bank or incurred by the Lender during direct debits.</li>
      <li>The Borrower agrees and provides permission to the Lender to use all digital methods (SMS, Email, WhatsApp, regular post) to get in touch as required if the Borrower fails to pay on the repayment date.</li>
    </ol>
  </td></tr>

  <tr><td><h2>8. DISBURSEMENT OF THE LOAN</h2>The Loan shall be disbursed using Automated Funds Transfer after deducting all charges and fees specified in the Key Fact Statement into the bank account of the Borrower specified in the loan application, after acceptance of this agreement, within 2 working days.</td></tr>

  <tr><td><h2>9. REPAYMENT OF THE LOAN</h2>
    <ol>
      <li>The Borrower shall repay the full repayment amount mentioned in the Key Fact Statement on or before the repayment date without failure, into the bank account of the Lender.</li>
      <li>The Borrower undertakes that the eMandate/eNACH will be applicable to all loans taken during its validity period or until cancelled/stopped by the Borrower, irrespective of the number of loans taken.</li>
      <li>The Borrower undertakes to maintain sufficient balance in the account for payment of the eNACH on the day the payment becomes due.</li>
      <li>The Loan is not renewable or extendable and is required to be paid in full including accrued interest, processing and other fees as recorded in the Key Fact Statement.</li>
      <li>The Borrower gives consent to the Lender to send reminder emails and SMSs to the Borrower's registered mobile number and email ID before the repayment date.</li>
      <li>The Borrower cannot apply for a fresh loan until the previous loan is closed.</li>
    </ol>
  </td></tr>

  <tr><td><h2>10. FORECLOSURE OF THE LOAN</h2>It is hereby acknowledged by the parties that, in case of foreclosure, there are no additional charges to be levied by the Lender. In case of foreclosure before the repayment date, the Borrower shall be liable to pay proportionate interest up to the date of repayment.</td></tr>

  <tr><td><h2>11. EVENT OF DEFAULT</h2>The following events shall constitute &ldquo;Events of Default&rdquo;:
    <ol>
      <li>The Borrower failing to repay the loan or any fee, charge, or cost, or any other amount due hereunder, remaining unpaid after the date on which it is due.</li>
      <li>Death of the Borrower or the Borrower becoming insolvent or bankrupt.</li>
      <li>The Borrower committing an act of fraud, gross negligence or wilful misconduct.</li>
      <li>Any eMandate/eNACH/Post Dated Cheque delivered by the Borrower not being realized for any reason on presentation.</li>
      <li>Any instruction given by the Borrower for stop payment of any Mandate/eNACH/Post Dated Cheque for any reason whatsoever.</li>
      <li>The decision of the Lender as to whether an Event of Default has occurred shall be final and binding on the Borrower.</li>
    </ol>
  </td></tr>

  <tr><td><h2>12. CONSEQUENCES OF DEFAULT</h2>
    <ol>
      <li>The Lender shall charge penal charges as stated in the Key Fact Statement.</li>
      <li>The Lender shall take such necessary steps as permitted by law against the Borrower to realize the amounts due, including engaging collection agents and appointment of attorneys/consultants as it thinks fit.</li>
      <li>The Lender shall send payment reminders through SMS, App Notifications, WhatsApp, Emails and calls (manual and automated).</li>
      <li>The Lender shall attempt to collect the money through ECS/eNACH on and after the repayment date, with multiple attempts within its capacity in the event of failure.</li>
      <li>The Lender and/or its authorised representatives/collection agents will attempt to reach the Borrower via email and reference numbers regarding repayment, in a lawful, dignified and non-coercive manner in accordance with the RBI Fair Practices Code and applicable laws.</li>
      <li>In case of delay with two or more false promises of payment, representatives of the Lender will attempt to collect the money and contact the Borrower's references to discuss the situation.</li>
      <li>The Borrower may be visited in person by a collection agent/authorised representative appointed by the Lender at the Borrower's residence or another mutually decided place, in a lawful, dignified and non-coercive manner in accordance with the RBI Fair Practices Code and applicable laws.</li>
      <li>If the Borrower fails to make payment on the repayment date, their payment history will be reported to relevant credit reporting agencies.</li>
      <li>If the Borrower defaults on all loan repayments, this will result in serious legal consequences, including legal action.</li>
      <li>The Borrower may issue notices and other communications to the Lender pursuant to this Agreement by email.</li>
    </ol>
  </td></tr>

  <tr><td><h2>13. INDEMNITY</h2>The Borrower shall indemnify, defend and hold harmless the Lender, its directors, officials, employees, affiliates, agents, contractors, advisors, partners and every attorney, manager, agent or other person appointed by the Lender (each an "Indemnified Party") from and against all direct or indirect losses, liabilities, obligations, claims, demands, actions, suits, judgments, awards, fines, penalties, taxes, fees, settlements, proceedings, expenses, deficiencies, damages, charges, costs, interests, and reasonable attorneys'/accountants' fees incurred as a result of, arising from, or relating to (a) a Default; or (b) any fraud, gross negligence or wilful misconduct attributable to the Borrower.</td></tr>

  <tr><td><h2>14. ASSIGNMENT OF LOAN</h2>The Lender may at any time assign, transfer, or otherwise deal with this Agreement and/or the Loan, in whole or in part, to any bank, financial institution, NBFC, ARC, or other permitted entity in accordance with applicable law. The Borrower agrees and consents to such transfer, understanding it will not change the Borrower's obligations. The Borrower shall be notified in writing within a reasonable time of such assignment, per applicable RBI guidelines.</td></tr>

  <tr><td><h2>15. GRIEVANCE</h2>The customer can raise concerns pertaining to the platform, Loan, Processing Fees and/or any other charges to the authorized representatives of the Company as below:
    <table class="inner-table">
      <tr><th>Level</th><th>Contact</th><th>Escalation note</th></tr>
      ${GRIEVANCE_ESCALATIONS.map(
        (e) =>
          `<tr><td>${e.level}</td><td><strong>${e.role}</strong>${e.name ? `<br/>Name: ${e.name}` : ''}<br/>Phone: ${e.phone}<br/>Email: ${e.email}</td><td>${e.note}</td></tr>`,
      ).join('\n      ')}
    </table>
  </td></tr>

  <tr><td><h2>16. NOTICES</h2>All correspondence shall be addressed to the address mentioned in the description of parties in the preamble to this agreement and their registered email addresses. The Lender shall also send any notice to the Borrower on any additional address(es) that come to its knowledge.</td></tr>

  <tr><td><h2>17. FAIR PRACTICES CODE</h2>The Lender represents and undertakes that it shall adhere to the principles of fair practices prescribed by RBI guidelines, directions, circulars and notifications, as amended from time to time and adopted in its Fair Practices Code, including:
    <ol>
      <li>Clear and adequate information relating to the loan, including terms, conditions, interest rate, fees and charges, provided transparently.</li>
      <li>Courteous, professional, non-discriminatory communications; no coercive or unethical recovery practices.</li>
      <li>Advance communication of any change in loan terms/conditions in accordance with applicable laws and RBI guidelines.</li>
      <li>Confidentiality of the Borrower's information, disclosed only as required by law, regulatory authorities, credit information companies, or with the Borrower's consent.</li>
      <li>A grievance redressal mechanism in place, communicated to the Borrower, who may approach the Lender's grievance redressal officer.</li>
      <li>Compliance with all applicable laws, regulations and RBI guidelines relating to loan sanction, disbursement, servicing and recovery.</li>
      <li>All communications, follow-ups, recovery actions, field visits, and contact undertaken lawfully, professionally, and non-coercively, during permitted hours.</li>
    </ol>
    The Borrower acknowledges having read and understood the Fair Practices Code and agrees the loan shall be governed by it.
  </td></tr>

  <tr><td><h2>18. FORCE MAJEURE</h2>Neither Party shall be liable for any failure or delay in performance of its obligations (other than payment obligations) caused by events beyond its reasonable control ("Force Majeure Event"), including acts of God, natural disasters, pandemics, war, terrorism, riots, strikes, governmental action, or failure of utilities. The affected Party shall promptly notify the other in writing and use reasonable efforts to mitigate effects. Notwithstanding a Force Majeure Event, the Borrower's obligation to repay the loan amount with interest, fees and charges shall not be waived, suspended or excused, unless expressly agreed in writing by the Lender.</td></tr>

  <tr><td><h2>19. COOLING OFF / LOOK UP PERIOD</h2>The Borrower is entitled to a cooling-off/look-up period of 3 days from the date of disbursement, during which the Borrower may exit the Loan by repaying the principal disbursed together with applicable proportionate interest and any statutory charges, without pre-payment penalty or foreclosure charges. The Borrower shall intimate the Lender in writing within this period and complete repayment as specified. Third-party charges, statutory levies, taxes, or insurance premium already paid are not refundable. Upon successful repayment under this clause, the Loan Agreement stands terminated and any security or charge is released, subject to applicable law. Failure to exercise this option within the period is deemed unconditional acceptance of the Loan and its terms.</td></tr>

  <tr><td><h2>20. SEVERABILITY</h2>If any provision of this agreement is found invalid or unenforceable, it shall be deemed superseded by a valid enforceable provision most closely matching the original intent, and the remainder of the agreement shall continue in effect.</td></tr>

  <tr><td><h2>21. GOVERNING LAW, DISPUTE RESOLUTION AND ARBITRATION</h2>
    <ol>
      <li>Any dispute arising out of or in connection with this agreement not settled amicably shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996, as amended.</li>
      <li>The seat and venue of arbitration shall be Delhi, India, conducted in the English language.</li>
      <li>The arbitration shall be conducted by a sole arbitrator mutually appointed by the Parties; failing agreement, appointed per the Arbitration and Conciliation Act, 1996.</li>
      <li>The arbitral award shall be final and binding, subject to rights available under applicable law.</li>
      <li>Each Party shall bear its own legal and other costs relating to arbitration unless otherwise determined by the arbitrator.</li>
      <li>This Agreement is governed by and construed in accordance with the laws of India.</li>
      <li>Subject to arbitration provisions and where recourse to courts is permissible, the courts and tribunals at Delhi, India shall have exclusive jurisdiction.</li>
    </ol>
  </td></tr>

  <tr><td><h2>22. BINDING EFFECT</h2>All warranties, undertakings and agreements given by the parties shall be binding upon them and their legal representatives and estates. This agreement (together with amendments) supersedes all prior discussions and agreements between the parties with respect to the transaction.</td></tr>

  <tr><td><h2>23. TERMINATION</h2>This Agreement may be terminated:
    <ol>
      <li>At the option of the Lender, at any time and without notice, upon an Event of Default, entailing payment of applicable damages by the Borrower.</li>
      <li>By mutual agreement of the Parties recorded in writing, at any time prior to the Term.</li>
      <li>On the date the Borrower has repaid the Amounts Payable and fulfilled all other obligations to the Lender's satisfaction.</li>
      <li>On the date the Borrower has repaid the amount in full during the Cooling-off/Look-up period.</li>
      <li>In case of termination, the Borrower shall repay the entire Outstanding Amount within two Business Days from the date of termination.</li>
    </ol>
  </td></tr>

  <tr><td><h2>24. VALIDITY OF ELECTRONIC EXECUTION AND E-SIGN</h2>The Parties agree this Agreement may be executed electronically, including via electronic signatures/e-signs, in accordance with the Information Technology Act, 2000 and rules framed thereunder. The Parties expressly consent to the use of electronic records and signatures, acknowledging such execution is valid, legally binding and enforceable with the same effect as physical signature, and constitutes an "electronic record" admissible in evidence without production of a physical original, per applicable law. The Borrower confirms having reviewed, understood and accepted the terms prior to affixing an electronic signature and shall not object to the mode of execution, validity, enforceability or admissibility solely on account of electronic execution. The place and date of execution shall be deemed to be the registered office of the Lender unless otherwise specified.</td></tr>

  <tr><td><h2>25. CHANGES IN REGULATIONS PRESCRIBED FOR NBFC</h2>In the event of any amendment, modification, or change in applicable laws, rules, regulations, circulars, directions, guidelines, or bye-laws issued by the RBI or any competent authority affecting any provision of this Loan Agreement, the Agreement shall, to the extent necessary, stand amended or modified to give effect to and ensure compliance with such regulatory changes.</td></tr>

  <tr><td><h2>26. ACCEPTANCE</h2>If the above terms and conditions are acceptable, the Borrower shall arrange to return a copy of this letter duly signed, confirming acceptance of the terms and conditions of sanction.</td></tr>

  <tr><td style="height: 120px;">&nbsp;</td></tr>
  <tr><td class="center" style="width: 50%;">To be signed and delivered by the Lender</td></tr>
</table>
</body>
</html>`;
}

/** Alias: the legacy app treats the KFS + Loan Agreement as one combined
 * PDF (see file-level comment). There is no separate loan-agreement-only
 * template in the legacy source. */
export const renderLoanAgreementHtml = renderSanctionLetterAndLoanAgreementHtml;
