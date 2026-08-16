import { ApiError, apiFetch } from '@/lib/api';
import type { LeadUserType } from '@/lib/leads';

/** Backend's `CamStatus` numeric enum (`@finance-crm/database`, `0=>DRAFT,
 * 1=>SANCTION`) — serializes over the wire as the raw number, not the enum
 * key. No `SEND_BACK` member exists there; `CamService.sendBack()` reverts
 * a sent-back CAM to `DRAFT`, the closest real status. */
export type CamStatus = 0 | 1;

export const CAM_STATUS_LABEL: Record<CamStatus, string> = {
  0: 'Draft',
  1: 'Sanctioned',
};

/**
 * FOIR (Fixed Obligations to Income Ratio) cap, mirrored from legacy's
 * `FOIR_PERCENTAGE` constant (old-php-files/config.php:265-268):
 *   const FOIR_PERCENTAGE = ['NEW' => 0.45, 'REPEAT' => 0.50];
 * Legacy applies this as a binary switch — `CAMController.php:105`:
 *   $foir_percent = ($_POST['lead_type'] == 'NEW') ? FOIR_PERCENTAGE['NEW'] : FOIR_PERCENTAGE['REPEAT'];
 * i.e. anything other than 'NEW' (including 'REPEAT') falls to the 50% cap —
 * there is no separate legacy value for 'UNPAID_REPEAT', so it's treated the
 * same as 'REPEAT' here, consistent with that ternary.
 * Legacy also enforces this client-side before allowing submission —
 * `application/views/Tasks/main_js.php:3801-3813` blocks the form with
 * `alert('Foir can not be above <cap>%')` when final FOIR meets/exceeds the cap.
 */
export const FOIR_CAP_PERCENT: Record<'NEW' | 'REPEAT', number> = {
  NEW: 45,
  REPEAT: 50,
};

export function getFoirCapPercent(userType: LeadUserType): number {
  return userType === 'NEW' ? FOIR_CAP_PERCENT.NEW : FOIR_CAP_PERCENT.REPEAT;
}

export type Cam = {
  id: number;
  recommendedLoanAmount: number | null;
  roi: number | null;
  penalRoi: number | null;
  tenureDays: number | null;
  processingFeePercent: number | null;
  adminFee: number | null;
  netDisbursalAmount: number | null;
  repaymentAmount: number | null;
  disbursalDate: string | null;
  repaymentDate: string | null;
  eligibleFoirPercentage: number | null;
  finalFoirPercentage: number | null;
  appraisedMonthlyIncome: number | null;
  appraisedObligations: number | null;
  riskProfile: string | null;
  riskScore: number | null;
  remarks: string | null;
  status: CamStatus | null;
  sanctionedBy: { id: number; name: string } | null;
};

export type UpsertCamInput = {
  recommendedLoanAmount: number;
  roi: number;
  penalRoi?: number;
  tenureDays: number;
  processingFeePercent?: number;
  adminFee?: number;
  netDisbursalAmount: number;
  repaymentAmount: number;
  disbursalDate?: string;
  repaymentDate?: string;
  eligibleFoirPercentage?: number;
  finalFoirPercentage?: number;
  appraisedMonthlyIncome?: number;
  appraisedObligations?: number;
  riskProfile?: string;
  riskScore?: number;
  remarks?: string;
};

/** "No CAM yet" is a normal state for a lead that hasn't reached credit
 * review — the backend 404s (`findByLead` throws `NotFoundException`)
 * rather than returning an empty shape, so that's translated to `null`
 * here instead of surfacing as an error. */
export async function getCam(leadId: number): Promise<Cam | null> {
  try {
    return await apiFetch<Cam>(`/api/v1/leads/${leadId}/cam`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function upsertCam(leadId: number, dto: UpsertCamInput) {
  return apiFetch<Cam>(`/api/v1/leads/${leadId}/cam`, {
    method: 'PUT',
    body: dto,
  });
}

export function sanctionCam(leadId: number) {
  return apiFetch<Cam>(`/api/v1/leads/${leadId}/cam/sanction`, {
    method: 'POST',
  });
}

export function sendBackCam(leadId: number, remarks?: string) {
  return apiFetch<Cam>(`/api/v1/leads/${leadId}/cam/send-back`, {
    method: 'POST',
    body: { remarks },
  });
}
