import { renderCibilReportHtml } from './cibil-report.template';
import { renderAccountAggregatorConsentHtml } from './consent-form.template';
import { renderLegalNoticeHtml } from './legal-notice.template';
import { renderSanctionLetterAndLoanAgreementHtml } from './sanction-letter.template';

/**
 * These four templates are rendered by headless Chrome
 * (`PuppeteerPdfRenderer`), so an unescaped interpolation is server-side
 * script execution inside the VPC against a legally meaningful document — not
 * cosmetic markup breakage. Escaping was added across all four in the
 * 2026-08-06 security review and verified only by a throwaway script at the
 * time; this pins it.
 *
 * One test per template rather than per field: the failure mode is "somebody
 * added a new `${...}` without `escapeHtml`", which a payload in every string
 * field catches regardless of which field is new.
 */
const PAYLOAD = '<img src=x onerror="fetch(\'http://evil/\')">';
const ESCAPED = '&lt;img src=x';

function assertNeutralised(html: string) {
  expect(html).not.toContain('<img src=x');
  expect(html).not.toContain('onerror="fetch');
  expect(html).toContain(ESCAPED);
}

describe('PDF template escaping', () => {
  it('sanction letter / loan agreement escapes borrower and lender fields', () => {
    const html = renderSanctionLetterAndLoanAgreementHtml({
      loanNo: PAYLOAD,
      applicationNo: PAYLOAD,
      loanAmount: 10000,
      tenureDays: 30,
      repaymentAmount: 11000,
      repaymentDate: PAYLOAD,
      netDisbursalAmount: 9000,
      disbursalDate: PAYLOAD,
      bankAccountNumber: PAYLOAD,
      ifscCode: PAYLOAD,
      roiPerDay: 0.1,
      agreementDate: PAYLOAD,
      adminFee: 1000,
      borrowerTitle: 'Mr.',
      borrowerFullName: PAYLOAD,
      fatherName: PAYLOAD,
      panNumber: PAYLOAD,
      residenceAddressHtml: PAYLOAD,
      lenderName: PAYLOAD,
      lenderCin: PAYLOAD,
      lenderRegisteredOffice: PAYLOAD,
    });

    assertNeutralised(html);
  });

  it('sanction letter escapes the logo data URI in attribute position', () => {
    // `<img src="${logoDataUri}" alt="${lenderName}">` — a bare quote here
    // closes the attribute and opens an event handler, which is why
    // escapeHtml covers quotes and not just angle brackets.
    const html = renderSanctionLetterAndLoanAgreementHtml({
      loanNo: 'LN-1',
      applicationNo: 'APP-1',
      loanAmount: 10000,
      tenureDays: 30,
      repaymentAmount: 11000,
      repaymentDate: '01-09-2026',
      netDisbursalAmount: 9000,
      disbursalDate: '01-08-2026',
      bankAccountNumber: '123',
      ifscCode: 'ABCD0123456',
      roiPerDay: 0.1,
      agreementDate: '01-08-2026',
      adminFee: 1000,
      borrowerTitle: 'Mr.',
      borrowerFullName: 'Test',
      fatherName: 'Test',
      panNumber: 'ABCDE1234F',
      residenceAddressHtml: 'Somewhere',
      lenderName: 'Lender',
      lenderCin: 'CIN',
      lenderRegisteredOffice: 'Office',
      logoDataUri: '" onload="alert(1)',
    });

    expect(html).not.toContain('onload="alert(1)"');
    expect(html).toContain('&quot;');
  });

  it('legal notice escapes borrower name and address', () => {
    const html = renderLegalNoticeHtml({
      noticeDate: PAYLOAD,
      borrowerFullName: PAYLOAD,
      borrowerAddressHtml: PAYLOAD,
      loanNo: PAYLOAD,
      outstandingAmount: 5000,
      dueDate: PAYLOAD,
      daysToRespond: 7,
    });

    assertNeutralised(html);
  });

  it('consent form escapes the borrower name and grievance-officer details', () => {
    const html = renderAccountAggregatorConsentHtml({
      borrowerFullName: PAYLOAD,
      loanAmount: 10000,
      roiPerDay: 0.1,
      adminFee: 1000,
      netDisbursalAmount: 9000,
      repaymentAmount: 11000,
      tenureDays: 30,
      nodalGrievanceOfficerName: PAYLOAD,
      nodalGrievanceOfficerMobile: PAYLOAD,
      nodalGrievanceOfficerAddress: PAYLOAD,
    });

    assertNeutralised(html);
  });

  it('CIBIL report escapes bureau-supplied account and enquiry rows', () => {
    // This data comes straight from a third-party bureau response, so it is
    // the least trustworthy input of the four.
    const html = renderCibilReportHtml({
      reportDate: PAYLOAD,
      applicantName: PAYLOAD,
      panNumber: PAYLOAD,
      score: 750,
      scoreModelName: PAYLOAD,
      scoreRangeLabel: PAYLOAD,
      accountSummary: {
        totalAccounts: 1,
        activeAccounts: 1,
        closedAccounts: 0,
        overdueAccounts: 0,
        totalOutstandingBalance: 1000,
        totalSanctionedAmount: 2000,
      },
      accounts: [
        {
          lenderName: PAYLOAD,
          accountType: PAYLOAD,
          accountNumberMasked: PAYLOAD,
          dateOpened: PAYLOAD,
          sanctionedAmount: 1000,
          currentBalance: 500,
          overdueAmount: 0,
          accountStatus: PAYLOAD,
          paymentHistory: PAYLOAD,
        },
      ],
      enquiries: [
        {
          enquiryDate: PAYLOAD,
          lenderName: PAYLOAD,
          enquiryPurpose: PAYLOAD,
          amount: 1000,
        },
      ],
    });

    assertNeutralised(html);
  });
});
