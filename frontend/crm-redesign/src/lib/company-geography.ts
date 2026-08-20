import { apiFetch } from '@/lib/api';

export type AdminCompany = {
  id: number;
  name: string;
  code: string | null;
  url: string | null;
  address: string | null;
  contactNumber: string | null;
};

export type AdminProduct = {
  id: number;
  name: string;
  code: string | null;
  source: string | null;
};

export type AdminState = {
  id: number;
  name: string;
  code: string | null;
};

export type AdminCity = {
  id: number;
  name: string;
};

export type AdminPincode = {
  id: number;
  value: string;
  city: AdminCity | null;
};

export type Branch = {
  id: number;
  name: string;
};

export type AdminDataSource = {
  id: number;
  name: string;
  code: string | null;
};

export type BlacklistedPincode = {
  id: number;
  pincode: string;
  publishedBy: { id: number; name: string } | null;
};

// Companies + products
export function listCompaniesAdmin() {
  return apiFetch<AdminCompany[]>('/api/v1/companies');
}

export function createCompany(dto: {
  name: string;
  code?: string;
  url?: string;
  address?: string;
  contactNumber?: string;
}) {
  return apiFetch<AdminCompany>('/api/v1/companies', {
    method: 'POST',
    body: dto,
  });
}

export function removeCompany(id: number) {
  return apiFetch<void>(`/api/v1/companies/${id}`, { method: 'DELETE' });
}

export function listProductsAdmin(companyId: number) {
  return apiFetch<AdminProduct[]>(`/api/v1/companies/${companyId}/products`);
}

export function createProduct(
  companyId: number,
  dto: { name: string; code?: string; source?: string },
) {
  return apiFetch<AdminProduct>(`/api/v1/companies/${companyId}/products`, {
    method: 'POST',
    body: dto,
  });
}

export function removeProduct(companyId: number, productId: number) {
  return apiFetch<void>(
    `/api/v1/companies/${companyId}/products/${productId}`,
    { method: 'DELETE' },
  );
}

// States + cities
export function listStatesAdmin() {
  return apiFetch<AdminState[]>('/api/v1/states');
}

export function createState(dto: { name: string; code?: string }) {
  return apiFetch<AdminState>('/api/v1/states', {
    method: 'POST',
    body: dto,
  });
}

export function removeState(id: number) {
  return apiFetch<void>(`/api/v1/states/${id}`, { method: 'DELETE' });
}

export function listCitiesByStateAdmin(stateId: number) {
  return apiFetch<AdminCity[]>(`/api/v1/states/${stateId}/cities`);
}

export function createCity(stateId: number, name: string) {
  return apiFetch<AdminCity>(`/api/v1/states/${stateId}/cities`, {
    method: 'POST',
    body: { name },
  });
}

export function removeCity(id: number) {
  return apiFetch<void>(`/api/v1/cities/${id}`, { method: 'DELETE' });
}

// Pincodes — always filtered by city, never fetched unfiltered (~7,900 rows)
export function listPincodesByCity(cityId: number) {
  return apiFetch<AdminPincode[]>(`/api/v1/pincodes?cityId=${cityId}`);
}

export function createPincode(dto: { value: string; cityId?: number }) {
  return apiFetch<AdminPincode>('/api/v1/pincodes', {
    method: 'POST',
    body: dto,
  });
}

export function removePincode(id: number) {
  return apiFetch<void>(`/api/v1/pincodes/${id}`, { method: 'DELETE' });
}

// Branches
export function listBranches() {
  return apiFetch<Branch[]>('/api/v1/branches');
}

export function createBranch(name: string) {
  return apiFetch<Branch>('/api/v1/branches', {
    method: 'POST',
    body: { name },
  });
}

export function removeBranch(id: number) {
  return apiFetch<void>(`/api/v1/branches/${id}`, { method: 'DELETE' });
}

// Data sources
export function listDataSourcesAdmin() {
  return apiFetch<AdminDataSource[]>('/api/v1/data-sources');
}

export function createDataSource(dto: { name: string; code?: string }) {
  return apiFetch<AdminDataSource>('/api/v1/data-sources', {
    method: 'POST',
    body: dto,
  });
}

export function removeDataSource(id: number) {
  return apiFetch<void>(`/api/v1/data-sources/${id}`, { method: 'DELETE' });
}

// Blacklisted pincodes
export function listBlacklistedPincodes() {
  return apiFetch<BlacklistedPincode[]>('/api/v1/blacklisted-pincodes');
}

export function createBlacklistedPincode(pincode: string) {
  return apiFetch<BlacklistedPincode>('/api/v1/blacklisted-pincodes', {
    method: 'POST',
    body: { pincode },
  });
}

export function removeBlacklistedPincode(id: number) {
  return apiFetch<void>(`/api/v1/blacklisted-pincodes/${id}`, {
    method: 'DELETE',
  });
}
