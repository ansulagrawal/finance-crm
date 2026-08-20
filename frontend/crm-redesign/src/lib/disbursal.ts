import { ApiError, apiFetch } from '@/lib/api';

/** `Loan.status` is legacy's free-string lifecycle label (same value space
 * as `Lead.legacyStatus`), not a closed enum — this repo previously assumed
 * a simplified enum that doesn't exist in the real schema. Backend's
 * `DisbursalService`'s own `LOAN_STATUS` map (`core-api/src/modules/
 * disbursal/disbursal.service.ts`) is the set of values this app's own
 * actions can put a loan into; legacy has other free-text labels too
 * (`SANCTION`/`DISBURSAL-*`/...) for earlier stages this app doesn't set. */
export type LoanStatus = string;

export const LOAN_STATUS = {
  PENDING: 'DISBURSE-PENDING',
  DISBURSED: 'DISBURSED',
  SETTLED: 'SETTLED',
  CLOSED: 'CLOSED',
  WRITTEN_OFF: 'WRITEOFF',
} as const;

/** Backend's `LoanPaymentMode`/`LoanPaymentType` numeric enums
 * (`@finance-crm/database`, `1=>ONLINE/IMPS, 2=>OFFLINE/NEFT`) — serialize/validate
 * as the raw number, not a string label. */
export type LoanPaymentMode = 1 | 2;
export type LoanPaymentType = 1 | 2;

export const LOAN_PAYMENT_MODE_LABEL: Record<LoanPaymentMode, string> = {
  1: 'Online',
  2: 'Offline',
};
export const LOAN_PAYMENT_TYPE_LABEL: Record<LoanPaymentType, string> = {
  1: 'IMPS',
  2: 'NEFT',
};

/** Backend's `DisbursementTransactionStatus` numeric enum (`@finance-crm/database`,
 * `1=>INITIATED, 2=>PENDING, 3=>FAILED, 4=>HOLD, 5=>COMPLETE`). */
export type DisbursementTransactionStatus = 1 | 2 | 3 | 4 | 5;

export const DISBURSEMENT_TRANSACTION_STATUS_LABEL: Record<
  DisbursementTransactionStatus,
  string
> = {
  1: 'Initiated',
  2: 'Pending',
  3: 'Failed',
  4: 'Hold',
  5: 'Complete',
};

export type DisbursementBank = {
  id: number;
  accountNumber: string;
  isImpsEnabled: boolean;
  isNeftEnabled: boolean;
};

export type Loan = {
  id: number;
  loanNumber: string | null;
  status: LoanStatus;
  paymentMode: LoanPaymentMode | null;
  paymentType: LoanPaymentType | null;
  disbursementReferenceNo: string | null;
  disbursementBank: DisbursementBank | null;
  principalPayable: number | null;
  interestPayable: number | null;
  penaltyPayable: number | null;
  principalReceived: number | null;
  interestReceived: number | null;
  penaltyReceived: number | null;
  principalOutstanding: number | null;
  interestOutstanding: number | null;
  penaltyOutstanding: number | null;
  totalPayable: number | null;
  totalReceived: number | null;
  totalOutstanding: number | null;
  settledAt: string | null;
  closedAt: string | null;
  writtenOffAt: string | null;
};

export type DisbursementTransaction = {
  id: number;
  referenceNo: string | null;
  bank: DisbursementBank;
  status: DisbursementTransactionStatus | null;
  createdAt: string;
};

export async function getLoan(leadId: number): Promise<Loan | null> {
  try {
    return await apiFetch<Loan>(`/api/v1/leads/${leadId}/loan`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function createLoan(leadId: number, loanNumber: string) {
  return apiFetch<Loan>(`/api/v1/leads/${leadId}/loan`, {
    method: 'POST',
    body: { loanNumber },
  });
}

export function disburseLoan(
  leadId: number,
  dto: {
    disbursementBankId: number;
    paymentMode: LoanPaymentMode;
    paymentType: LoanPaymentType;
    disbursementReferenceNo?: string;
  },
) {
  return apiFetch<Loan>(`/api/v1/leads/${leadId}/loan/disburse`, {
    method: 'POST',
    body: dto,
  });
}

export function settleLoan(leadId: number) {
  return apiFetch<Loan>(`/api/v1/leads/${leadId}/loan/settle`, {
    method: 'PATCH',
  });
}

export function closeLoan(leadId: number) {
  return apiFetch<Loan>(`/api/v1/leads/${leadId}/loan/close`, {
    method: 'PATCH',
  });
}

export function writeOffLoan(leadId: number) {
  return apiFetch<Loan>(`/api/v1/leads/${leadId}/loan/write-off`, {
    method: 'PATCH',
  });
}

export function listTransactions(leadId: number) {
  return apiFetch<DisbursementTransaction[]>(
    `/api/v1/leads/${leadId}/loan/transactions`,
  );
}

export function createTransaction(
  leadId: number,
  dto: {
    disbursementBankId: number;
    referenceNo: string;
    status: DisbursementTransactionStatus;
  },
) {
  return apiFetch<DisbursementTransaction>(
    `/api/v1/leads/${leadId}/loan/transactions`,
    { method: 'POST', body: dto },
  );
}
