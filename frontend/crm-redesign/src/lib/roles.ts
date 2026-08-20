import type { ReactNode } from 'react';
import { useCurrentUser } from '@/lib/auth';

/** `SA`/`CA` always pass any role check here too — matches the backend's
 * `RolesGuard` (`core-api`'s `@finance-crm/common`), which lets Client Admin
 * bypass every `@Roles(...)` gate. Without this, an admin would be
 * blocked from a form the backend would actually let them submit, purely
 * because their literal role isn't in that form's specific allowlist. */
export const ADMIN_OVERRIDE_ROLES = ['SA', 'CA'];

/** A user can hold multiple roles (`user_roles` is one-to-many per user
 * in the backend schema) — this checks "has any of these", never assumes
 * a single role. */
export function useHasRole(...roleCodes: string[]): boolean {
  const user = useCurrentUser();
  if (!user) return false;
  return user.roles.some(
    (role) => roleCodes.includes(role) || ADMIN_OVERRIDE_ROLES.includes(role),
  );
}

export function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const allowed = useHasRole(...roles);
  if (!allowed) return null;
  return children;
}
