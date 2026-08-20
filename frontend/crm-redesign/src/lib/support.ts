import { apiFetch } from '@/lib/api';
import type { Cam } from '@/lib/cam';
import type {
  Gender,
  LeadAssignmentStage,
  LeadCustomer,
  LeadEmployment,
} from '@/lib/leads';
import type { CustomerBanking } from '@/lib/verification';

/**
 * Ops-support toolkit (`SA`/`CA` only, `POST/PATCH /support/leads/:leadId/*`)
 * — ports the legacy `SupportController.php` "fix a stuck lead" panel.
 * Every write except the three resets below 403s unless the lead is in an
 * active, not-yet-disbursed status (backend's `assertLeadEditableBySupport`)
 * — surface `ApiError.message` from that check directly, it's already a
 * clear sentence.
 */

export function resetEkyc(leadId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/support/leads/${leadId}/ekyc/reset`, {
    method: 'POST',
  });
}

export function resetEsign(leadId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/support/leads/${leadId}/esign/reset`, {
    method: 'POST',
  });
}

export function resetAccountAggregator(leadId: number): Promise<void> {
  return apiFetch<void>(
    `/api/v1/support/leads/${leadId}/account-aggregator/reset`,
    { method: 'POST' },
  );
}

export type SupportAllocationOverrideInput = {
  stage: LeadAssignmentStage;
  userId: number;
  remarks?: string;
};

export function overrideAllocation(
  leadId: number,
  dto: SupportAllocationOverrideInput,
) {
  return apiFetch<unknown>(`/api/v1/support/leads/${leadId}/allocation`, {
    method: 'PATCH',
    body: dto,
  });
}

export type SupportPersonalDetailInput = {
  firstName?: string;
  surName?: string;
  mobile?: string;
  email?: string;
  pancard?: string;
  aadhaarNumber?: string;
  dob?: string;
  gender?: Gender;
};

export function overridePersonalDetail(
  leadId: number,
  dto: SupportPersonalDetailInput,
): Promise<LeadCustomer> {
  return apiFetch<LeadCustomer>(
    `/api/v1/support/leads/${leadId}/personal-detail`,
    { method: 'PATCH', body: dto },
  );
}

export type SupportEmploymentDetailInput = {
  incomeType: 'SALARIED' | 'SELF_EMPLOYED';
  monthlyIncome?: number;
  employerName?: string;
  designation?: string;
  salaryMode?: string;
};

export function overrideEmploymentDetail(
  leadId: number,
  dto: SupportEmploymentDetailInput,
): Promise<LeadEmployment> {
  return apiFetch<LeadEmployment>(
    `/api/v1/support/leads/${leadId}/employment-detail`,
    { method: 'PATCH', body: dto },
  );
}

export type SupportBankDetailInput = {
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  confirmAccountNumber: string;
  beneficiaryName: string;
  branch?: string;
};

export function overrideBankDetail(
  leadId: number,
  dto: SupportBankDetailInput,
): Promise<CustomerBanking> {
  return apiFetch<CustomerBanking>(
    `/api/v1/support/leads/${leadId}/bank-detail`,
    { method: 'POST', body: dto },
  );
}

export type SupportCamDetailInput = {
  recommendedLoanAmount: number;
  roi: number;
  penalRoi?: number;
  tenureDays: number;
  processingFeePercent?: number;
  adminFee?: number;
  netDisbursalAmount: number;
  repaymentAmount: number;
  appraisedMonthlyIncome: number;
  appraisedObligations: number;
  disbursalDate?: string;
  repaymentDate?: string;
  eligibleFoirPercentage?: number;
  finalFoirPercentage?: number;
  riskProfile?: string;
  riskScore?: number;
  remarks?: string;
};

export function overrideCamDetail(
  leadId: number,
  dto: SupportCamDetailInput,
): Promise<Cam> {
  return apiFetch<Cam>(`/api/v1/support/leads/${leadId}/cam-detail`, {
    method: 'PATCH',
    body: dto,
  });
}
