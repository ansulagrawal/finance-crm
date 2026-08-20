import { ApiError, apiFetch, apiFetchBlob, apiFetchMultipart } from '@/lib/api';
import type {
  Company,
  DataSource,
  MasterStatus,
  Product,
  RejectionReason,
  State,
} from '@/lib/lookups';

/** Backend's `LeadUserType` enum (`@finance-crm/database`) stores the repeat-customer
 * value as `'UNPAID-REPEAT'` (hyphen, legacy's exact stored string), not
 * `'UNPAID_REPEAT'`. */
export type LeadUserType = 'NEW' | 'REPEAT' | 'UNPAID-REPEAT';

export type LeadUser = {
  id: number;
  name: string;
};

export type Lead = {
  id: number;
  applicationNo: string | null;
  leadReferenceNo: string | null;
  firstName: string;
  mobile: string;
  email: string | null;
  pancard: string | null;
  loanAmount: number | null;
  tenureDays: number | null;
  purpose: string | null;
  userType: LeadUserType;
  pincode: string | null;
  source: string | null;
  isBlacklisted: boolean;
  createdAt: string;
  updatedAt: string | null;
  company: Company | null;
  product: Product | null;
  dataSource: DataSource | null;
  state: State | null;
  city: { id: number; name: string } | null;
  leadStatus: MasterStatus | null;
  rejectionReason: RejectionReason | null;
  screenerAssignedTo: LeadUser | null;
  creditAssignedTo: LeadUser | null;
  disbursalAssignedTo: LeadUser | null;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

export type ListLeadsQuery = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: number;
  productId?: number;
  leadStatusId?: number;
  stageCode?: string;
  screenerAssignedToId?: number;
  creditAssignedToId?: number;
  disbursalAssignedToId?: number;
  isBlacklisted?: boolean;
  rejectionReasonId?: number;
};

export type CreateLeadInput = {
  firstName: string;
  mobile: string;
  email?: string;
  pancard?: string;
  loanAmount?: number;
  tenureDays?: number;
  purpose?: string;
  userType?: LeadUserType;
  pincode?: string;
  companyId?: number;
  productId?: number;
  dataSourceId?: number;
  stateId?: number;
  cityId?: number;
  branchId?: number;
};

export type LeadFollowup = {
  id: number;
  remarks: string | null;
  createdAt: string;
  user: LeadUser | null;
  status: MasterStatus | null;
};

export type LeadAssignmentStage = 'SCREENER' | 'CREDIT' | 'DISBURSAL';

export type ChangeLeadStatusInput = {
  leadStatusId: number;
  remarks?: string;
};

export type AssignLeadInput = {
  stage: LeadAssignmentStage;
  userId: number;
  remarks?: string;
};

export type RejectLeadInput = {
  rejectionReasonId: number;
  remarks?: string;
};

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listLeads(query: ListLeadsQuery = {}) {
  return apiFetch<PaginatedResult<Lead>>(
    `/api/v1/leads${toQueryString(query)}`,
  );
}

/** Role-scoped queue (`GET /leads/queue`) — same filter/pagination shape
 * as `listLeads`, but the backend applies the current user's role-based
 * default (e.g. a CR1 screener only sees their own assigned leads in the
 * screener stages). Falls back to the same result as `listLeads` for
 * roles with no defined queue. */
export function listLeadsQueue(query: ListLeadsQuery = {}) {
  return apiFetch<PaginatedResult<Lead>>(
    `/api/v1/leads/queue${toQueryString(query)}`,
  );
}

export function getLead(leadId: number) {
  return apiFetch<Lead>(`/api/v1/leads/${leadId}`);
}

export function createLead(dto: CreateLeadInput) {
  return apiFetch<Lead>('/api/v1/leads', { method: 'POST', body: dto });
}

export function listFollowups(
  leadId: number,
  query: { page?: number; limit?: number } = {},
) {
  return apiFetch<PaginatedResult<LeadFollowup>>(
    `/api/v1/leads/${leadId}/followups${toQueryString(query)}`,
  );
}

export function addFollowup(leadId: number, remarks: string) {
  return apiFetch<LeadFollowup>(`/api/v1/leads/${leadId}/followups`, {
    method: 'POST',
    body: { remarks },
  });
}

export function changeLeadStatus(leadId: number, dto: ChangeLeadStatusInput) {
  return apiFetch<Lead>(`/api/v1/leads/${leadId}/status`, {
    method: 'PATCH',
    body: dto,
  });
}

export function assignLead(leadId: number, dto: AssignLeadInput) {
  return apiFetch<Lead>(`/api/v1/leads/${leadId}/assign`, {
    method: 'PATCH',
    body: dto,
  });
}

export function rejectLead(leadId: number, dto: RejectLeadInput) {
  return apiFetch<Lead>(`/api/v1/leads/${leadId}/reject`, {
    method: 'POST',
    body: dto,
  });
}

export type SelfAllocateResult = { allocated: number; skipped: number[] };

/** Ports legacy's `TaskController::allocateLeads()` — a self-service bulk
 * "claim these leads for myself" action from the queue view, not a
 * manager-driven reassignment (see `AssignLeadInput`/`assignLead` above).
 * Backend fires RUNO sanction-call allocation as a side effect for CR1
 * claiming SCREENER leads in production — no separate frontend action
 * needed for that (was previously logged in `docs/BLOCKED.md` as
 * un-buildable until this endpoint existed). */
export function selfAllocateLeads(dto: {
  leadIds: number[];
  assignTarget: LeadAssignmentStage;
}) {
  return apiFetch<SelfAllocateResult>('/api/v1/leads/self-allocate', {
    method: 'POST',
    body: dto,
  });
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type LeadCustomer = {
  id: number;
  firstName: string | null;
  middleName: string | null;
  surName: string | null;
  fatherName: string | null;
  gender: Gender | null;
  dob: string | null;
  mobile: string | null;
  alternateMobile: string | null;
  email: string | null;
  alternateEmail: string | null;
  pancard: string | null;
  aadhaarNumber: string | null;
  isPancardVerified: boolean;
  isAadhaarVerified: boolean;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  currentAddressLine1: string | null;
  currentAddressLine2: string | null;
  currentLandmark: string | null;
  currentResidenceType: string | null;
  currentResidenceSince: string | null;
  pincode: string | null;
  spouseName: string | null;
  state: { id: number; name: string } | null;
  city: { id: number; name: string } | null;
  maritalStatus: { id: number; name: string } | null;
  qualification: { id: number; name: string } | null;
  religion: { id: number; name: string } | null;
  spouseOccupation: { id: number; name: string } | null;
  /** Km between the Aadhaar/eKYC address and the customer's live-location
   * GPS fix — null until `AddressDistanceService` has run at least once.
   * The audit straight-through gate requires this to be set and <=25km. */
  residenceDistanceKm: string | null;
};

export type UpsertLeadCustomerInput = {
  firstName?: string;
  middleName?: string;
  surName?: string;
  fatherName?: string;
  gender?: Gender;
  dob?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  alternateEmail?: string;
  pancard?: string;
  aadhaarNumber?: string;
  currentAddressLine1?: string;
  currentAddressLine2?: string;
  currentLandmark?: string;
  currentResidenceType?: string;
  currentResidenceSince?: string;
  pincode?: string;
  spouseName?: string;
  stateId?: number;
  cityId?: number;
  maritalStatusId?: number;
  qualificationId?: number;
  religionId?: number;
  spouseOccupationId?: number;
};

export type IncomeType = 'SALARIED' | 'SELF_EMPLOYED';

export type LeadEmployment = {
  id: number;
  incomeType: IncomeType;
  monthlyIncome: string | null;
  salaryMode: string | null;
  employerName: string | null;
  designation: string | null;
  department: string | null;
  employerType: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  landmark: string | null;
  pincode: string | null;
  residenceSince: string | null;
  serviceTenure: string | null;
  state: { id: number; name: string } | null;
  city: { id: number; name: string } | null;
};

export type UpsertLeadEmploymentInput = {
  incomeType: IncomeType;
  monthlyIncome?: number;
  salaryMode?: string;
  employerName?: string;
  designation?: string;
  department?: string;
  employerType?: string;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  pincode?: string;
  residenceSince?: string;
  serviceTenure?: string;
  stateId?: number;
  cityId?: number;
};

export type LeadCustomerReference = {
  id: number;
  name: string;
  mobile: string;
  relationType: string | null;
};

export async function getCustomer(
  leadId: number,
): Promise<LeadCustomer | null> {
  try {
    return await apiFetch<LeadCustomer>(`/api/v1/leads/${leadId}/customer`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function upsertCustomer(leadId: number, dto: UpsertLeadCustomerInput) {
  return apiFetch<LeadCustomer>(`/api/v1/leads/${leadId}/customer`, {
    method: 'PUT',
    body: dto,
  });
}

export async function getEmployment(
  leadId: number,
): Promise<LeadEmployment | null> {
  try {
    return await apiFetch<LeadEmployment>(`/api/v1/leads/${leadId}/employment`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export function upsertEmployment(
  leadId: number,
  dto: UpsertLeadEmploymentInput,
) {
  return apiFetch<LeadEmployment>(`/api/v1/leads/${leadId}/employment`, {
    method: 'PUT',
    body: dto,
  });
}

export function listReferences(leadId: number) {
  return apiFetch<LeadCustomerReference[]>(
    `/api/v1/leads/${leadId}/references`,
  );
}

export function addReference(
  leadId: number,
  dto: { name: string; mobile: string; relationType?: string },
) {
  return apiFetch<LeadCustomerReference>(`/api/v1/leads/${leadId}/references`, {
    method: 'POST',
    body: dto,
  });
}

export function removeReference(leadId: number, referenceId: number) {
  return apiFetch<void>(`/api/v1/leads/${leadId}/references/${referenceId}`, {
    method: 'DELETE',
  });
}

export type LeadImportRowResult = {
  row: number;
  status: 'CREATED' | 'ERROR';
  leadId?: number;
  error?: string;
};

/** Bulk-imports leads from a CSV file (`POST /leads/import`, multipart field
 * `file`; name and mobile required, email/pan/pincode optional — matches
 * `sampleCsv()`'s header on the backend). Returns per-row results since
 * partial failure is the realistic case, not an all-or-nothing outcome. */
export function importLeadsCsv(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchMultipart<LeadImportRowResult[]>(
    '/api/v1/leads/import',
    formData,
  );
}

/** Downloads the sample CSV template (`GET /leads/import/sample-csv`) and
 * saves it via a synthetic anchor click, same pattern as `downloadKycZip`. */
export async function downloadLeadImportSampleCsv(): Promise<void> {
  const blob = await apiFetchBlob('/api/v1/leads/import/sample-csv');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lead-import-sample.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
