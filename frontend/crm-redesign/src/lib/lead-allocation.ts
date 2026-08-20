import { apiFetch } from '@/lib/api';

/** Backend's `UserLeadAllocationStatus` enum (`@finance-crm/database`): 1=Active, 2=Inactive. */
export const LEAD_ALLOCATION_STATUS = {
  ACTIVE: 1,
  INACTIVE: 2,
} as const;
export type LeadAllocationStatus =
  (typeof LEAD_ALLOCATION_STATUS)[keyof typeof LEAD_ALLOCATION_STATUS];

/** Backend's `UserLeadAllocationCaseType` enum (`@finance-crm/database`): 1=Fresh, 2=Repeat. */
export const LEAD_ALLOCATION_CASE_TYPE = {
  FRESH: 1,
  REPEAT: 2,
} as const;
export type LeadAllocationCaseType =
  (typeof LEAD_ALLOCATION_CASE_TYPE)[keyof typeof LEAD_ALLOCATION_CASE_TYPE];

export type LeadAllocationLog = {
  id: number;
  userStatus: LeadAllocationStatus;
  userCaseType: LeadAllocationCaseType;
  createdAt: string;
};

export function getTodayLeadAllocation() {
  return apiFetch<LeadAllocationLog | null>('/api/v1/lead-allocation/today');
}

export function declareLeadAllocation(dto: {
  userStatus: LeadAllocationStatus;
  userCaseType: LeadAllocationCaseType;
}) {
  return apiFetch<LeadAllocationLog>('/api/v1/lead-allocation', {
    method: 'POST',
    body: dto,
  });
}
