import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { useCurrentUser } from '@/lib/auth';
import { ADMIN_OVERRIDE_ROLES } from '@/lib/roles';

/** Display names for the legacy role codes, seeded verbatim from the
 * production `master_role_type` table (see backend docs/COMPLETED.md Task
 * #41a) — not invented here. Codes with no dedicated module route yet fall
 * back to the Leads/Screener home in `getRoleHomeRoute` below. */
export const ROLE_LABEL: Record<string, string> = {
  SA: 'Super Admin',
  CA: 'Client Admin',
  CR1: 'Screener',
  CR2: 'Credit Manager',
  CR3: 'Credit Head',
  DS1: 'Disbursal Manager',
  DS2: 'Disbursal Head',
  CO1: 'Collection Executive',
  CO2: 'State Collection Manager',
  CO3: 'Collection Head',
  CO4: 'Pre Collection Executive',
  AC1: 'Account Manager',
  AC2: 'Account Head',
  CFE1: 'Collection Field Executive',
  MR: 'Marketing',
  OL: 'Other',
  AU: 'Audit',
  AM: 'Audit Manager',
  AH: 'Audit Head',
  CC: 'Customer Care',
  LD1: 'Loan Docs',
  ST: 'Support Tech',
  AF: 'Affiliates',
};

/** Module families group role codes for the sidebar's folder-tab sections and
 * the role-switcher badge's accent stripe — mirrors how the old app's
 * `LoginController::home()` menu filter clustered labels (e.g. CO/AC/CFE1
 * always appeared together). Purely a display grouping, not an auth
 * boundary — see the role-switcher plan note on this. */
export type RoleFamily = {
  key: string;
  label: string;
  accent: string;
  roles: string[];
};

export const ROLE_FAMILIES: RoleFamily[] = [
  {
    key: 'admin',
    label: 'Admin',
    accent: 'var(--color-family-admin)',
    roles: ['SA', 'CA'],
  },
  {
    key: 'credit',
    label: 'Credit & Screener',
    accent: 'var(--color-family-credit)',
    roles: ['CR1', 'CR2', 'CR3'],
  },
  {
    key: 'disbursal',
    label: 'Disbursal',
    accent: 'var(--color-family-disbursal)',
    roles: ['DS1', 'DS2', 'LD1'],
  },
  {
    key: 'collections',
    label: 'Collections & Accounts',
    accent: 'var(--color-family-collections)',
    roles: ['CO1', 'CO2', 'CO3', 'CO4', 'CFE1', 'AC1', 'AC2'],
  },
  {
    key: 'audit',
    label: 'Audit',
    accent: 'var(--color-family-audit)',
    roles: ['AU', 'AM', 'AH'],
  },
  {
    key: 'support',
    label: 'Support',
    accent: 'var(--color-family-support)',
    roles: ['CC', 'ST', 'MR', 'OL', 'AF'],
  },
];

export function familyForRole(role: string): RoleFamily {
  return (
    ROLE_FAMILIES.find((family) => family.roles.includes(role)) ?? {
      key: 'support',
      label: 'Other',
      accent: 'var(--color-family-support)',
      roles: [],
    }
  );
}

/** Where a role lands by default after login or a role switch — the closest
 * thing to old `home()`'s per-label redirect. All modules referenced here
 * are ported and routed in `__root.tsx`'s `NAV_SECTIONS`; roles with no
 * dedicated queue of their own fall back to Leads. */
export function getRoleHomeRoute(role: string): string {
  if (['DS1', 'DS2', 'LD1'].includes(role)) return '/loans';
  if (['CO1', 'CO2', 'CO3', 'CO4', 'CFE1', 'AC1', 'AC2'].includes(role))
    return '/collections';
  if (['AU', 'AM', 'AH'].includes(role)) return '/audit';
  return '/';
}

const STORAGE_PREFIX = 'finance-crm_active_role:';

type ActiveRoleContextValue = {
  activeRole: string | null;
  setActiveRole: (role: string) => void;
};

const ActiveRoleContext = createContext<ActiveRoleContextValue | null>(null);

export function ActiveRoleProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const [activeRole, setActiveRoleState] = useState<string | null>(null);

  // Re-derive whenever the signed-in user (or their role list) changes: a
  // stored choice from a previous user, or a role the backend has since
  // revoked, must not silently stick around.
  useEffect(() => {
    if (!user) {
      setActiveRoleState(null);
      return;
    }
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${user.id}`);
    if (stored && user.roles.includes(stored)) {
      setActiveRoleState(stored);
      return;
    }
    const fallback =
      user.roles.find((role) => ADMIN_OVERRIDE_ROLES.includes(role)) ??
      user.roles[0] ??
      null;
    setActiveRoleState(fallback);
  }, [user]);

  const setActiveRole = (role: string) => {
    setActiveRoleState(role);
    if (user) localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, role);
  };

  return (
    <ActiveRoleContext value={{ activeRole, setActiveRole }}>
      {children}
    </ActiveRoleContext>
  );
}

export function useActiveRole(): ActiveRoleContextValue {
  const context = use(ActiveRoleContext);
  if (!context) {
    throw new Error('useActiveRole must be used within an ActiveRoleProvider');
  }
  return context;
}
