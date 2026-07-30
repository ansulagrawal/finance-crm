import { BadRequestException } from '@nestjs/common';
import {
  calculateLoanRepayment,
  type LoanRepaymentInput,
} from './calculate-loan-repayment';

function baseInput(
  overrides: Partial<LoanRepaymentInput> = {},
): LoanRepaymentInput {
  return {
    leadId: 1,
    loanNumber: 'LN1',
    isBlacklisted: false,
    leadStatusName: 'DISBURSED',
    gatePassed: false,
    finalDisbursedAt: null,
    loanRecommended: 10000,
    roi: null,
    repaymentAmount: null,
    repaymentDate: null,
    advanceInterestAmount: null,
    storedPrincipalDiscount: 0,
    storedInterestDiscount: 0,
    storedPenaltyDiscount: 0,
    storedTotalDiscount: 0,
    terminalCollection: null,
    totalReceivedAmount: 0,
    ...overrides,
  };
}

describe('calculateLoanRepayment', () => {
  it('returns loanRecommended/status/isBlacklisted only, everything else zero, when the gate fails', () => {
    const { details, camUpdate } = calculateLoanRepayment(
      baseInput({
        gatePassed: false,
        isBlacklisted: true,
        leadStatusName: 'CLOSED',
      }),
    );

    expect(details.loanRecommended).toBe(10000);
    expect(details.isBlacklisted).toBe(true);
    expect(details.status).toBe('CLOSED');
    expect(details.totalDueAmount).toBe(0);
    expect(details.totalRepaymentAmount).toBe(0);
    expect(details.penaltyInterest).toBe(0);
    expect(camUpdate).toBeNull();
  });

  it('still returns a CAM update when finalDisbursedAt is set even though the gate failed', () => {
    const { camUpdate } = calculateLoanRepayment(
      baseInput({
        gatePassed: false,
        finalDisbursedAt: new Date('2026-01-01'),
      }),
    );
    expect(camUpdate).toEqual({
      tenureDays: 0,
      repaymentAmount: 10000, // 0 interest + 10000 loanRecommended
      disbursalDate: new Date('2026-01-01'),
    });
  });

  it('throws when the gate passes but the disbursal/repayment date is missing', () => {
    expect(() =>
      calculateLoanRepayment(
        baseInput({
          gatePassed: true,
          finalDisbursedAt: null,
          repaymentDate: null,
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('computes the full reconciliation for a disbursed loan with no payments yet, past the repayment date and penalty grace window', () => {
    const { details, camUpdate } = calculateLoanRepayment(
      baseInput({
        gatePassed: true,
        finalDisbursedAt: new Date('2026-01-01'),
        roi: 1,
        repaymentAmount: 13000,
        repaymentDate: new Date('2026-01-31'), // 30-day tenure, well in the past
        advanceInterestAmount: 0,
        now: new Date('2026-08-05'),
      }),
    );

    // hand-computed: tenure=30d, interest=round(10000*1*30/100)=3000,
    // repaymentAmount=13000 (10000 principal + 3000 interest); "now" is
    // far past repaymentDate + the 60-day grace window, so penaltyDays
    // freezes at the flat 60-day cap.
    expect(details.tenureDays).toBe(30);
    expect(details.realDays).toBe(30);
    expect(details.penaltyDays).toBe(60);
    expect(details.repaymentAmount).toBe(13000);
    expect(details.realInterest).toBe(3000);
    expect(details.repaymentWithRealInterest).toBe(13000);
    expect(details.totalInterestAmount).toBe(3000);
    expect(details.totalInterestAmountPending).toBe(3000);
    expect(details.totalPrincipleAmountPending).toBe(10000);
    // penalRoi=2, penaltyInterest = 10000*2*60/100 = 12000
    expect(details.penaltyInterest).toBe(12000);
    expect(details.totalRepaymentAmount).toBe(25000); // 13000+12000+0
    expect(details.totalReceivedAmount).toBe(0);
    expect(details.totalDueAmount).toBe(25000);
    expect(details.totalDiscountAmount).toBe(0);
    expect(camUpdate).toEqual({
      tenureDays: 30,
      repaymentAmount: 13000,
      disbursalDate: new Date('2026-01-01'),
    });
  });

  it('zeroes totalDueAmount once the lead status is CLOSED, regardless of the computed figures', () => {
    const { details } = calculateLoanRepayment(
      baseInput({
        gatePassed: true,
        leadStatusName: 'CLOSED',
        finalDisbursedAt: new Date('2026-01-01'),
        roi: 1,
        repaymentAmount: 13000,
        repaymentDate: new Date('2026-01-31'),
        now: new Date('2026-08-05'),
      }),
    );
    expect(details.totalDueAmount).toBe(0);
  });

  it('auto-detects an interest discount when the received amount exactly matches the real-interest scenario below the scheduled repayment amount', () => {
    // disbursal->repaymentDate is exactly 30 days, and repaymentDate ==
    // "now" so realDays == tenureDays == 30 (no penalty window entered):
    // realInterest = round(10000*1*30/100) = 3000, so
    // repaymentWithRealInterest = 10000+3000 = 13000. Scheduled
    // repaymentAmount (13500) > that, and totalReceivedAmount (13000)
    // exactly equals it -> auto interest discount = 13500-13000 = 500.
    const { details } = calculateLoanRepayment(
      baseInput({
        gatePassed: true,
        finalDisbursedAt: new Date('2026-07-01'),
        roi: 1,
        repaymentAmount: 13500,
        repaymentDate: new Date('2026-07-31'),
        now: new Date('2026-07-31'),
        totalReceivedAmount: 13000,
      }),
    );

    expect(details.tenureDays).toBe(30);
    expect(details.realDays).toBe(30);
    expect(details.realInterest).toBe(3000);
    expect(details.repaymentWithRealInterest).toBe(13000);
    expect(details.interestDiscountAmount).toBe(500);
    expect(details.totalDiscountAmount).toBe(500);
  });
});
