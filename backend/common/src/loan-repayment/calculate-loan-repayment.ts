import { BadRequestException } from '@nestjs/common';

/**
 * `CommonComponent::get_loan_repayment_details()`'s computed reconciliation
 * numbers for a lead's loan. Shared between `core-api`'s
 * `CollectionService` (payment verification + preview endpoint) and
 * `automation-worker`'s nightly outstanding-recompute job — both call
 * `calculateLoanRepayment()` below, each doing its own DB I/O to gather
 * the inputs and persist the result, since the two services don't share a
 * process (`automation-worker` reads/writes the shared database directly
 * rather than calling `core-api` over HTTP).
 */
export interface LoanRepaymentDetails {
  loanNumber: string | null;
  leadId: number;
  isBlacklisted: boolean;
  status: string | null;
  disbursalDate: Date | null;
  repaymentDate: Date | null;
  roi: number;
  penalRoi: number;
  tenureDays: number;
  realDays: number;
  penaltyDays: number;
  advanceInterestAmountDeducted: number;
  repaymentAmount: number;
  realInterest: number;
  repaymentWithRealInterest: number;
  totalInterestAmount: number;
  interestDiscountAmount: number;
  totalInterestAmountReceived: number;
  totalInterestAmountPending: number;
  loanRecommended: number;
  principleDiscountAmount: number;
  totalPrincipleAmountReceived: number;
  totalPrincipleAmountPending: number;
  penaltyInterest: number;
  penaltyDiscountAmount: number;
  totalPenaltyInterestReceived: number;
  totalPenaltyInterestPending: number;
  totalRepaymentAmount: number;
  totalReceivedAmount: number;
  totalDueAmount: number;
  totalDiscountAmount: number;
}

/**
 * What the caller should persist back onto `CreditAnalysisMemo` — only
 * non-null when `finalDisbursedAt` was provided, matching legacy's own
 * `if (!empty($lead_final_disbursed_date))` guard around that write.
 */
export interface LoanRepaymentCamUpdate {
  tenureDays: number;
  repaymentAmount: number;
  disbursalDate: Date;
}

export interface LoanRepaymentInput {
  leadId: number;
  loanNumber: string | null;
  isBlacklisted: boolean;
  leadStatusName: string | null;
  /** `loan && loan.status === 'DISBURSED' && cam` — legacy's real
   * `loan_status_id = 14` gate. When false, every payable/received/
   * outstanding figure comes back 0 (only loanRecommended/leadId/status/
   * isBlacklisted still populate) but the (zeroed) result is still meant
   * to be persisted, exactly like legacy. */
  gatePassed: boolean;
  finalDisbursedAt: Date | null;
  loanRecommended: number;
  roi: number | null;
  repaymentAmount: number | null;
  repaymentDate: Date | null;
  advanceInterestAmount: number | null;
  storedPrincipalDiscount: number;
  storedInterestDiscount: number;
  storedPenaltyDiscount: number;
  storedTotalDiscount: number;
  /** The first (lowest-id) verified Settle/Close/Writeoff collection row
   * for this lead, already resolved by the caller with legacy's real
   * priority (settle > close > writeoff) — null if none exists yet. */
  terminalCollection: {
    receivedDate: Date | null;
    closedAt: Date | null;
  } | null;
  totalReceivedAmount: number;
  /** Injectable for tests; defaults to `new Date()`. */
  now?: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Hardcoded 60-day grace window before a late-payment day-count freezes
 * at a flat 60 penalty days. */
const PENALTY_GRACE_DAYS = 60;

function startOfDayMs(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(startMs: number, endMs: number): number {
  return (endMs - startMs) / MS_PER_DAY;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Ports `CommonComponent::get_loan_repayment_details()` →
 * `LeadModel::getLoanRepaymentDetails()` (353 lines,
 * `components/classes/model/LeadModel.class.php:640`) — the loan-closure
 * reconciliation engine `CollectionController::UpdatePayment()`'s AC1
 * branch depends on to hard-reject a mismatched full-payment/settle/
 * writeoff amount, and `CronCollectionController::calculationAllLoans()`
 * calls nightly for every disbursed loan to keep outstanding
 * interest/penalty fresh. Every quirk below is a faithful port of what
 * legacy actually does, not a guess:
 *
 * - Legacy computes the loan's discount amounts TWICE with the same
 *   variable names, so the second silently shadows the first: the first
 *   pass (using whatever discount is *currently stored* on `loan`) feeds
 *   the principal/interest/penalty received-vs-pending split and
 *   `total_due_amount`; a second, unconditional pass right before the
 *   function returns recomputes discount from scratch by comparing the
 *   scheduled repayment amount against a "real interest" scenario, and
 *   *that* value is what gets both returned and persisted back onto
 *   `loan`. Kept as distinctly-named locals here (`stored*Discount` vs.
 *   `final*Discount`) to avoid reproducing the shadowing while still
 *   matching which round feeds which output.
 * - Meant to run on *every* call, including read-only previews — the
 *   caller is expected to persist the result back onto `Loan`
 *   (payable/received/outstanding/discount) and `CreditAnalysisMemo`
 *   (via `LoanRepaymentCamUpdate`) unconditionally, exactly like legacy.
 */
export function calculateLoanRepayment(input: LoanRepaymentInput): {
  details: LoanRepaymentDetails;
  camUpdate: LoanRepaymentCamUpdate | null;
} {
  let totalReceivedAmount = input.totalReceivedAmount;
  let roi = 0;
  let penalRoi = 0;
  let tenureDays = 0;
  let realTenureDays = 0;
  let penaltyDays = 0;
  let disbursalDate: Date | null = null;
  let repaymentDate: Date | null = null;
  let advanceInterestAmountDeducted = 0;
  let repaymentAmount = 0;
  let interestAmount = 0;
  let realInterest = 0;
  let repaymentWithRealInterest = 0;
  let totalInterestAmount = 0;
  let totalInterestAmountReceived = 0;
  let totalInterestAmountPending = 0;
  let totalPrincipleAmountReceived = 0;
  let totalPrincipleAmountPending = 0;
  let penaltyInterest = 0;
  let totalRepaymentAmount = 0;
  let totalDueAmount = 0;
  let totalPenaltyInterestReceived = 0;
  let totalPenaltyInterestPending = 0;
  const { loanRecommended, storedTotalDiscount } = input;

  if (input.gatePassed) {
    const {
      storedPrincipalDiscount,
      storedInterestDiscount,
      storedPenaltyDiscount,
    } = input;

    disbursalDate = input.finalDisbursedAt;
    repaymentDate = input.repaymentDate;
    if (!disbursalDate || !repaymentDate) {
      throw new BadRequestException(
        `Lead ${input.leadId} is disbursed but missing a disbursal/repayment date — cannot reconcile.`,
      );
    }
    const disbursalMs = startOfDayMs(disbursalDate);
    const repaymentMs = startOfDayMs(repaymentDate);
    const todayMs = startOfDayMs(input.now ?? new Date());

    roi = input.roi ?? 0;
    penalRoi = roi * 2;
    repaymentAmount = input.repaymentAmount ?? 0;
    advanceInterestAmountDeducted = input.advanceInterestAmount ?? 0;

    let dateOfReceiveMs = todayMs;
    let dateOfReceiveVerifiedMs = todayMs;
    if (input.terminalCollection?.receivedDate) {
      dateOfReceiveMs = startOfDayMs(input.terminalCollection.receivedDate);
      dateOfReceiveVerifiedMs = startOfDayMs(
        input.terminalCollection.closedAt ?? input.now ?? new Date(),
      );
    }

    realTenureDays =
      dateOfReceiveMs <= repaymentMs
        ? daysBetween(disbursalMs, dateOfReceiveMs)
        : daysBetween(disbursalMs, repaymentMs);

    if (dateOfReceiveVerifiedMs > repaymentMs) {
      const graceMs = PENALTY_GRACE_DAYS * MS_PER_DAY;
      if (dateOfReceiveVerifiedMs - repaymentMs <= graceMs) {
        realTenureDays = daysBetween(disbursalMs, repaymentMs);
        penaltyDays = daysBetween(repaymentMs, dateOfReceiveVerifiedMs);
      } else {
        penaltyDays = PENALTY_GRACE_DAYS;
      }
    }

    tenureDays = daysBetween(disbursalMs, repaymentMs);

    interestAmount = Math.round((loanRecommended * roi * tenureDays) / 100);
    realInterest = Math.round((loanRecommended * roi * realTenureDays) / 100);
    repaymentWithRealInterest = loanRecommended + realInterest;
    totalInterestAmount = repaymentAmount - loanRecommended;

    if (totalReceivedAmount < interestAmount) {
      totalInterestAmountReceived = totalReceivedAmount;
      totalInterestAmountPending =
        interestAmount - (totalInterestAmountReceived + storedInterestDiscount);
    } else {
      totalInterestAmountReceived = interestAmount - storedInterestDiscount;
      totalInterestAmountPending = 0;
    }

    if (
      totalReceivedAmount >= interestAmount &&
      totalReceivedAmount < repaymentAmount
    ) {
      totalPrincipleAmountReceived =
        totalReceivedAmount +
        advanceInterestAmountDeducted +
        storedInterestDiscount -
        interestAmount;
      totalPrincipleAmountPending =
        loanRecommended -
        totalPrincipleAmountReceived -
        storedPrincipalDiscount;
    } else if (totalReceivedAmount >= loanRecommended) {
      totalPrincipleAmountReceived = loanRecommended - storedPrincipalDiscount;
      totalPrincipleAmountPending = 0;
    } else {
      totalPrincipleAmountReceived = 0;
      totalPrincipleAmountPending = loanRecommended - storedPrincipalDiscount;
    }

    if (advanceInterestAmountDeducted > 0) {
      totalInterestAmount = advanceInterestAmountDeducted;
      totalInterestAmountReceived =
        advanceInterestAmountDeducted - storedInterestDiscount;
      totalInterestAmountPending = 0;
      totalReceivedAmount =
        totalReceivedAmount +
        storedInterestDiscount +
        totalInterestAmountReceived;
    }

    penaltyInterest = (loanRecommended * penalRoi * penaltyDays) / 100;
    totalRepaymentAmount =
      repaymentAmount + penaltyInterest + advanceInterestAmountDeducted;
    totalDueAmount =
      totalRepaymentAmount - totalReceivedAmount - storedTotalDiscount;

    if (penaltyInterest > 0) {
      if (
        totalReceivedAmount > repaymentAmount &&
        totalReceivedAmount < totalRepaymentAmount
      ) {
        totalPenaltyInterestReceived =
          totalReceivedAmount - repaymentAmount - advanceInterestAmountDeducted;
        totalPenaltyInterestPending =
          penaltyInterest -
          totalPenaltyInterestReceived -
          storedPenaltyDiscount;
      } else if (totalReceivedAmount >= totalRepaymentAmount) {
        totalPenaltyInterestReceived = penaltyInterest - storedPenaltyDiscount;
        totalPenaltyInterestPending = 0;
      } else {
        totalPenaltyInterestReceived = 0;
        totalPenaltyInterestPending = penaltyInterest - storedPenaltyDiscount;
      }
    }

    if (input.leadStatusName === 'CLOSED') {
      totalDueAmount = 0;
    }
  }

  // Round-2 auto-detected discount — unconditional, feeds both the
  // returned data and what gets persisted onto `loan`. See the function
  // doc comment for why this is a second, shadowing pass.
  let finalInterestDiscount = 0;
  let finalPenaltyDiscount = 0;
  let finalTotalDiscount = 0;
  if (
    Math.round(repaymentAmount) > Math.round(repaymentWithRealInterest) &&
    Math.round(repaymentWithRealInterest) === Math.round(totalReceivedAmount)
  ) {
    const discountAmount =
      Math.round(repaymentAmount) - Math.round(repaymentWithRealInterest);
    finalInterestDiscount = discountAmount;
    finalTotalDiscount = discountAmount;
  } else if (
    Math.round(repaymentAmount) < Math.round(repaymentWithRealInterest) &&
    Math.round(repaymentWithRealInterest) < Math.round(totalReceivedAmount)
  ) {
    const discountAmount =
      Math.round(totalReceivedAmount) - Math.round(repaymentWithRealInterest);
    finalPenaltyDiscount = discountAmount;
    finalTotalDiscount = discountAmount;
  }

  const details: LoanRepaymentDetails = {
    loanNumber: input.loanNumber,
    leadId: input.leadId,
    isBlacklisted: input.isBlacklisted,
    status: input.leadStatusName,
    disbursalDate,
    repaymentDate,
    roi: round2(roi),
    penalRoi: round2(penalRoi),
    tenureDays,
    realDays: realTenureDays,
    penaltyDays,
    advanceInterestAmountDeducted: Math.round(advanceInterestAmountDeducted),
    repaymentAmount: Math.round(repaymentAmount),
    realInterest: Math.round(realInterest),
    repaymentWithRealInterest: Math.round(repaymentWithRealInterest),
    totalInterestAmount: Math.round(totalInterestAmount),
    interestDiscountAmount: Math.round(finalInterestDiscount),
    totalInterestAmountReceived: Math.round(totalInterestAmountReceived),
    totalInterestAmountPending: Math.round(totalInterestAmountPending),
    loanRecommended: Math.round(loanRecommended),
    principleDiscountAmount: 0,
    totalPrincipleAmountReceived: Math.round(totalPrincipleAmountReceived),
    totalPrincipleAmountPending: Math.round(totalPrincipleAmountPending),
    penaltyInterest: Math.round(penaltyInterest),
    penaltyDiscountAmount: Math.round(finalPenaltyDiscount),
    totalPenaltyInterestReceived: Math.round(totalPenaltyInterestReceived),
    totalPenaltyInterestPending: Math.round(totalPenaltyInterestPending),
    totalRepaymentAmount: Math.round(totalRepaymentAmount),
    totalReceivedAmount: Math.round(totalReceivedAmount),
    totalDueAmount: Math.round(totalDueAmount),
    totalDiscountAmount: Math.round(finalTotalDiscount),
  };

  const camUpdate: LoanRepaymentCamUpdate | null = input.finalDisbursedAt
    ? {
        tenureDays: Math.round(tenureDays),
        repaymentAmount:
          Math.round(interestAmount) + Math.round(loanRecommended),
        disbursalDate: input.finalDisbursedAt,
      }
    : null;

  return { details, camUpdate };
}
