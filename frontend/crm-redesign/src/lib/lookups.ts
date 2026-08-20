import { apiFetch } from '@/lib/api';

export type Company = {
  id: number;
  name: string;
  code: string | null;
};

export type Product = {
  id: number;
  name: string;
  code: string | null;
};

export type MasterStatus = {
  id: number;
  name: string;
  stageCode: string;
  sortOrder: number | null;
};

export type RejectionReason = {
  id: number;
  reason: string;
  notifyBySms: boolean;
  notifyByEmail: boolean;
};

export type DataSource = {
  id: number;
  name: string;
};

export type State = {
  id: number;
  name: string;
  code: string | null;
};

export type City = {
  id: number;
  name: string;
};

export function listCompanies() {
  return apiFetch<Company[]>('/api/v1/companies');
}

export function listProducts(companyId: number) {
  return apiFetch<Product[]>(`/api/v1/companies/${companyId}/products`);
}

/**
 * `stage` filters to a single `stageCode` — e.g. `'S16'`, which mirrors
 * legacy's own curated Collection repayment-type dropdown
 * (`CollectionController::paymentHistory()`'s `status_stage = 'S16'`
 * filter) instead of every lifecycle status.
 */
export function listMasterStatuses(stage?: string) {
  const query = stage ? `?stage=${encodeURIComponent(stage)}` : '';
  return apiFetch<MasterStatus[]>(`/api/v1/master-statuses${query}`);
}

export function listRejectionReasons() {
  return apiFetch<RejectionReason[]>('/api/v1/rejection-reasons');
}

export function listDataSources() {
  return apiFetch<DataSource[]>('/api/v1/data-sources');
}

export function listStates() {
  return apiFetch<State[]>('/api/v1/states');
}

export function listCitiesByState(stateId: number) {
  return apiFetch<City[]>(`/api/v1/states/${stateId}/cities`);
}

export type DisbursementBank = {
  id: number;
  accountNumber: string;
  isImpsEnabled: boolean;
  isNeftEnabled: boolean;
};

export function listDisbursementBanks() {
  return apiFetch<DisbursementBank[]>('/api/v1/disbursement-banks');
}

export type RoleType = {
  id: number;
  name: string;
  heading: string | null;
  code: string;
};

/** SA/CA-only. Used by admin screens (Menu/Permissions, Users) that need
 * the full role-type catalog, not just an {id, name} pair. */
export function listRoleTypes() {
  return apiFetch<RoleType[]>('/api/v1/roles');
}

export type MaritalStatus = { id: number; name: string };
export type Qualification = { id: number; name: string };
export type Religion = { id: number; name: string };
export type Occupation = { id: number; name: string };

export function listMaritalStatuses() {
  return apiFetch<MaritalStatus[]>('/api/v1/marital-statuses');
}

export function listQualifications() {
  return apiFetch<Qualification[]>('/api/v1/qualifications');
}

export function listReligions() {
  return apiFetch<Religion[]>('/api/v1/religions');
}

export function listOccupations() {
  return apiFetch<Occupation[]>('/api/v1/occupations');
}

export type RoleUser = {
  id: number;
  name: string;
};

/** Minimal {id, name} lookup, open to any authenticated user — used to
 * populate assignment pickers (e.g. a CR2 assigning a lead to a CR1
 * screener, who can't call the admin-gated GET /users). */
export function listUsersByRole(role: string) {
  return apiFetch<RoleUser[]>(
    `/api/v1/users/by-role?role=${encodeURIComponent(role)}`,
  );
}
