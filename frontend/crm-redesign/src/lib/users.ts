import { apiFetch } from '@/lib/api';
import type { PaginatedResult } from '@/lib/leads';
import type { Company, Product, RoleType } from '@/lib/lookups';

export type User = {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  username: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  company: Company | null;
  product: Product | null;
};

export type UserRoleAssignment = {
  id: number;
  roleType: RoleType;
  supervisorRole: UserRoleAssignment | null;
  /** Backend's `UserRole.level` (`@finance-crm/database`) is a string hierarchy code
   * (`'L1'`..`'L4'`), not a numeric level. */
  level: string | null;
  isActive: boolean;
};

/** Backend's `UserRoleLocationType` numeric enum (`@finance-crm/database`, `1=>CITY,
 * 2=>STATE, 3=>BRANCH`) — serializes/validates as the raw number. */
export type UserRoleLocationType = 1 | 2 | 3;

export const USER_ROLE_LOCATION_TYPE = {
  CITY: 1,
  STATE: 2,
  BRANCH: 3,
} as const;

export const USER_ROLE_LOCATION_TYPE_LABEL: Record<
  UserRoleLocationType,
  string
> = {
  1: 'City',
  2: 'State',
  3: 'Branch',
};

export type UserRoleLocation = {
  id: number;
  locationType: UserRoleLocationType;
  locationId: number;
};

/** Backend's `UserActivityType` numeric enum (`@finance-crm/database`, `1=>LOGIN,
 * 2=>ROLE_CHANGE, 3=>LOGOUT`) — serializes as the raw number. */
export type UserActivityType = 1 | 2 | 3;

export const USER_ACTIVITY_TYPE_LABEL: Record<UserActivityType, string> = {
  1: 'Login',
  2: 'Role change',
  3: 'Logout',
};

export type UserActivityLog = {
  id: number;
  user: { id: number; name: string };
  /** Backend relation is `userRole`, not `roleType` — only the shallow
   * `UserRole` row is loaded (its own `roleType` relation isn't). */
  userRole: { id: number; level: string | null } | null;
  activityType: UserActivityType;
  ipAddress: string | null;
  userAgent: string | null;
  platform: string | null;
  geoLocation: string | null;
  occurredAt: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  mobile?: string;
  username?: string;
  companyId?: number;
  productId?: number;
};

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>>;

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listUsers(
  query: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: number;
    isActive?: boolean;
  } = {},
) {
  return apiFetch<PaginatedResult<User>>(
    `/api/v1/users${toQueryString(query)}`,
  );
}

export function createUser(dto: CreateUserInput) {
  return apiFetch<User>('/api/v1/users', { method: 'POST', body: dto });
}

export function updateUser(id: number, dto: UpdateUserInput) {
  return apiFetch<User>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    body: dto,
  });
}

export function activateUser(id: number) {
  return apiFetch<User>(`/api/v1/users/${id}/activate`, { method: 'PATCH' });
}

export function deactivateUser(id: number) {
  return apiFetch<User>(`/api/v1/users/${id}/deactivate`, {
    method: 'PATCH',
  });
}

export function unlockUser(id: number) {
  return apiFetch<User>(`/api/v1/users/${id}/unlock`, { method: 'PATCH' });
}

export function listUserRoles(userId: number) {
  return apiFetch<UserRoleAssignment[]>(`/api/v1/users/${userId}/roles`);
}

export function assignUserRole(
  userId: number,
  dto: { roleTypeId: number; supervisorRoleId?: number; level?: string },
) {
  return apiFetch<UserRoleAssignment>(`/api/v1/users/${userId}/roles`, {
    method: 'POST',
    body: dto,
  });
}

export function updateUserRole(
  userId: number,
  userRoleId: number,
  dto: { supervisorRoleId?: number; level?: string; isActive?: boolean },
) {
  return apiFetch<UserRoleAssignment>(
    `/api/v1/users/${userId}/roles/${userRoleId}`,
    { method: 'PATCH', body: dto },
  );
}

export function removeUserRole(userId: number, userRoleId: number) {
  return apiFetch<void>(`/api/v1/users/${userId}/roles/${userRoleId}`, {
    method: 'DELETE',
  });
}

export function listUserRoleLocations(userRoleId: number) {
  return apiFetch<UserRoleLocation[]>(
    `/api/v1/user-roles/${userRoleId}/locations`,
  );
}

export function createUserRoleLocation(
  userRoleId: number,
  dto: { locationType: UserRoleLocationType; locationId: number },
) {
  return apiFetch<UserRoleLocation>(
    `/api/v1/user-roles/${userRoleId}/locations`,
    { method: 'POST', body: dto },
  );
}

export function removeUserRoleLocation(userRoleId: number, locationId: number) {
  return apiFetch<void>(
    `/api/v1/user-roles/${userRoleId}/locations/${locationId}`,
    { method: 'DELETE' },
  );
}

export function listActivityLogs(
  query: {
    page?: number;
    limit?: number;
    userId?: number;
    activityType?: UserActivityType;
    from?: string;
    to?: string;
  } = {},
) {
  return apiFetch<PaginatedResult<UserActivityLog>>(
    `/api/v1/activity-logs${toQueryString(query)}`,
  );
}

// Role types (SA/CA admin CRUD)
export function listRoleTypesAdmin() {
  return apiFetch<RoleType[]>('/api/v1/roles');
}

export function createRoleType(dto: {
  name: string;
  heading?: string;
  code: string;
}) {
  return apiFetch<RoleType>('/api/v1/roles', { method: 'POST', body: dto });
}

export function updateRoleType(
  id: number,
  dto: { name?: string; heading?: string; code?: string },
) {
  return apiFetch<RoleType>(`/api/v1/roles/${id}`, {
    method: 'PATCH',
    body: dto,
  });
}

export function removeRoleType(id: number) {
  return apiFetch<void>(`/api/v1/roles/${id}`, { method: 'DELETE' });
}
