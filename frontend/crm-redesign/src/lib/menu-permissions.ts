import { apiFetch } from '@/lib/api';
import type { RoleType } from '@/lib/lookups';

export type MenuItem = {
  id: number;
  roleType: RoleType;
  company: { id: number; name: string } | null;
  product: { id: number; name: string } | null;
  sectionId: number;
  sectionLabel: string | null;
  name: string;
  stage: string | null;
  routeLink: string;
  icon: string | null;
  boxBgColor: string | null;
  sortOrder: number | null;
};

export type MenuSection = {
  sectionId: number;
  sectionLabel: string | null;
  items: MenuItem[];
};

export type UpsertMenuItemInput = {
  roleTypeId: number;
  sectionId: number;
  sectionLabel?: string;
  name: string;
  stage?: string;
  routeLink: string;
  icon?: string;
  boxBgColor?: string;
  sortOrder?: number;
  companyId?: number;
  productId?: number;
};

export function listMenuItems(roleTypeId?: number) {
  return apiFetch<MenuItem[]>(
    `/api/v1/menu-items${roleTypeId ? `?roleTypeId=${roleTypeId}` : ''}`,
  );
}

export function listMenuItemsGrouped(roleTypeId?: number) {
  return apiFetch<MenuSection[]>(
    `/api/v1/menu-items/grouped${roleTypeId ? `?roleTypeId=${roleTypeId}` : ''}`,
  );
}

export function createMenuItem(dto: UpsertMenuItemInput) {
  return apiFetch<MenuItem>('/api/v1/menu-items', {
    method: 'POST',
    body: dto,
  });
}

export function updateMenuItem(id: number, dto: Partial<UpsertMenuItemInput>) {
  return apiFetch<MenuItem>(`/api/v1/menu-items/${id}`, {
    method: 'PATCH',
    body: dto,
  });
}

export function removeMenuItem(id: number) {
  return apiFetch<void>(`/api/v1/menu-items/${id}`, { method: 'DELETE' });
}

export type PermissionUser = { id: number; name: string };
/** Backend only shallow-loads this relation (`relations: { userRole: true }`)
 * — `roleType` itself is never populated, only the raw `roleTypeId` FK. */
export type PermissionUserRole = {
  id: number;
  roleTypeId: number;
  level: string | null;
};

export type ExportPermission = {
  id: number;
  createdAt: string;
  user: PermissionUser;
  userRole: PermissionUserRole | null;
  exportId: number;
  grantedBy: PermissionUser | null;
};

export type MisPermission = {
  id: number;
  createdAt: string;
  user: PermissionUser;
  userRole: PermissionUserRole | null;
  misId: number;
  grantedBy: PermissionUser | null;
};

export function listExportPermissions(userId?: number) {
  return apiFetch<ExportPermission[]>(
    `/api/v1/export-permissions${userId ? `?userId=${userId}` : ''}`,
  );
}

export function grantExportPermission(dto: {
  userId: number;
  exportId: number;
  userRoleId?: number;
}) {
  return apiFetch<ExportPermission>('/api/v1/export-permissions', {
    method: 'POST',
    body: dto,
  });
}

export function revokeExportPermission(id: number) {
  return apiFetch<void>(`/api/v1/export-permissions/${id}`, {
    method: 'DELETE',
  });
}

export function listMisPermissions(userId?: number) {
  return apiFetch<MisPermission[]>(
    `/api/v1/mis-permissions${userId ? `?userId=${userId}` : ''}`,
  );
}

export function grantMisPermission(dto: {
  userId: number;
  misId: number;
  userRoleId?: number;
}) {
  return apiFetch<MisPermission>('/api/v1/mis-permissions', {
    method: 'POST',
    body: dto,
  });
}

export function revokeMisPermission(id: number) {
  return apiFetch<void>(`/api/v1/mis-permissions/${id}`, {
    method: 'DELETE',
  });
}
