import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  createRootRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  CircleOff,
  FileBarChart,
  FileSearch,
  Headphones,
  History,
  ListChecks,
  ListFilter,
  LogOut,
  MapPin,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  User,
  UserCog,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { ChangePasswordModal } from '@/components/change-password-modal';
import { LeadAllocationToggle } from '@/components/lead-allocation-toggle';
import { RoleBadge } from '@/components/role-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toast';
import {
  ActiveRoleProvider,
  familyForRole,
  ROLE_FAMILIES,
  useActiveRole,
} from '@/lib/active-role';
import {
  loadStoredUser,
  logout,
  type SafeUser,
  useCurrentUser,
} from '@/lib/auth';
import { ADMIN_OVERRIDE_ROLES } from '@/lib/roles';

/** Nav items grouped by module family — the fix for "all in one": each
 * family renders as its own folder-tab section (`SidebarSection`) instead
 * of one flat list, mirroring the old app's separate per-role view folders
 * (Screener/, Disbursal/, Collection/, Audit/, UMS/, ...). */
const NAV_SECTIONS: {
  family: (typeof ROLE_FAMILIES)[number];
  items: {
    label: string;
    icon: ComponentType<{ className?: string }>;
    route: string;
    roles?: string[];
  }[];
}[] = [
  {
    family: ROLE_FAMILIES[1], // credit
    items: [
      { label: 'Leads', icon: Users, route: '/' },
      { label: 'Sanctions', icon: ShieldCheck, route: '/sanctions' },
      {
        label: 'Rejected leads',
        icon: XCircle,
        route: '/rejected-leads',
      },
      { label: 'BRE', icon: ListChecks, route: '/bre', roles: ['SA', 'CA'] },
    ],
  },
  {
    family: ROLE_FAMILIES[2], // disbursal
    items: [
      { label: 'Loans', icon: Banknote, route: '/loans' },
      {
        label: 'Disbursed / waived',
        icon: CircleOff,
        route: '/disbursed-waived',
      },
    ],
  },
  {
    family: ROLE_FAMILIES[3], // collections
    items: [
      { label: 'Collections', icon: Wallet, route: '/collections' },
      {
        label: 'Collection buckets',
        icon: ListFilter,
        route: '/collection-buckets',
        roles: ['SA', 'CA'],
      },
    ],
  },
  {
    family: ROLE_FAMILIES[4], // audit
    items: [
      {
        label: 'Audit',
        icon: FileSearch,
        route: '/audit',
        roles: ['AU', 'AM', 'AH'],
      },
      {
        label: 'Field verification',
        icon: MapPin,
        route: '/field-verification',
        roles: ['CO1', 'CO2', 'CO3', 'CFE1'],
      },
    ],
  },
  {
    family: ROLE_FAMILIES[5], // support
    items: [
      {
        label: 'Feedback',
        icon: Headphones,
        route: '/feedback',
        roles: ['SA', 'CA'],
      },
    ],
  },
  {
    family: ROLE_FAMILIES[0], // admin
    items: [
      { label: 'Reports', icon: FileBarChart, route: '/reports' },
      { label: 'Performance', icon: Target, route: '/performance' },
      {
        label: 'Users',
        icon: UserCog,
        route: '/users',
        roles: ['SA', 'CA'],
      },
      {
        label: 'Roles',
        icon: Shield,
        route: '/roles',
        roles: ['SA', 'CA'],
      },
      {
        label: 'Activity logs',
        icon: History,
        route: '/activity-logs',
        roles: ['SA', 'CA'],
      },
      {
        label: 'Menu & Permissions',
        icon: Settings,
        route: '/menu-permissions',
        roles: ['SA', 'CA'],
      },
      {
        label: 'Company & Geography',
        icon: MapPin,
        route: '/company-geography',
        roles: ['SA', 'CA'],
      },
      {
        label: 'Company Holidays',
        icon: CalendarDays,
        route: '/company-holidays',
        roles: ['SA', 'CA'],
      },
    ],
  },
];

const BARE_ROUTES = ['/login', '/forgot-password'];

function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  // Lives in the root layout, so it never unmounts across navigations —
  // without this, a typed query stuck around in the box after leaving
  // /search for an unrelated page.
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
  useEffect(() => {
    if (pathname !== '/search') setQuery('');
  }, [pathname]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim().length >= 2) {
          navigate({ to: '/search', search: { q: query.trim() } });
        }
      }}
      className='flex items-center gap-2'
    >
      <div className='relative w-80'>
        <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/40' />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search leads by name, mobile, email, PAN, loan no…'
          className='pl-9'
        />
      </div>
    </form>
  );
}

function AccountMenu({ user }: { user: SafeUser }) {
  const navigate = useNavigate();

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className='flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-left text-sm hover:bg-muted'>
        <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70'>
          <User className='size-3.5' />
        </span>
        <span className='font-medium text-foreground'>{user.name}</span>
        <ChevronDown className='size-4 shrink-0 text-foreground/60' />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className='z-50 w-56 overflow-hidden rounded-md border border-border bg-white p-1 shadow-lg'
          align='end'
          sideOffset={4}
        >
          <ChangePasswordModal />
          <Button
            type='ghost'
            className='w-full justify-start gap-2'
            onClick={async () => {
              await logout();
              navigate({ to: '/login' });
            }}
          >
            <LogOut className='size-4' />
            Logout
          </Button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const isBareRoute = BARE_ROUTES.includes(location.pathname);
    const user = await loadStoredUser();

    if (!isBareRoute && !user) {
      throw redirect({ to: '/login' });
    }
    if (isBareRoute && user) {
      throw redirect({ to: '/' });
    }
  },
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
  const isBareRoute = BARE_ROUTES.includes(pathname);
  const user = useCurrentUser();

  if (isBareRoute) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  // AppShell is a child of the provider (not inlined here) specifically so
  // it can call useActiveRole() — a component can't read a context it is
  // itself the one instantiating.
  return (
    <ActiveRoleProvider>
      <AppShell user={user} />
    </ActiveRoleProvider>
  );
}

function AppShell({ user }: { user: SafeUser | null }) {
  const { activeRole } = useActiveRole();
  const isAdmin = Boolean(
    user?.roles.some((role) => ADMIN_OVERRIDE_ROLES.includes(role)),
  );
  // Which folder-tab section lights up as "current" — the visible effect of
  // switching roles in RoleBadge, so the switcher isn't just changing its
  // own face value with nothing else in the sidebar reacting to it.
  const activeFamilyKey = activeRole ? familyForRole(activeRole).key : null;

  return (
    <div className='flex h-screen'>
      <Sidebar>
        <SidebarHeader>
          <img
            src='/logo.webp'
            alt='Finance CRM'
            className='mx-auto h-10 w-auto rounded px-2 py-1'
          />
        </SidebarHeader>

        {user && (
          <div className='mb-5'>
            <RoleBadge user={user} />
          </div>
        )}

        {NAV_SECTIONS.map(({ family, items }) => {
          const visibleItems = items.filter(
            (item) =>
              !item.roles ||
              isAdmin ||
              item.roles.some((role) => user?.roles.includes(role)),
          );
          if (visibleItems.length === 0) return null;

          return (
            <SidebarSection
              key={family.key}
              label={family.label}
              accent={family.accent}
              active={family.key === activeFamilyKey}
            >
              {visibleItems.map(({ label, icon: Icon, route }) => (
                <SidebarItem key={label} to={route}>
                  <Icon className='size-4' />
                  {label}
                </SidebarItem>
              ))}
            </SidebarSection>
          );
        })}
      </Sidebar>

      <main className='flex flex-1 flex-col gap-6 overflow-y-auto p-8'>
        <div className='flex items-center gap-4'>
          <LeadAllocationToggle />
          <div className='ml-auto flex items-center gap-3'>
            <GlobalSearchBar />
            {user && <AccountMenu user={user} />}
          </div>
        </div>
        <Outlet />
      </main>

      <TanStackRouterDevtools />
      <Toaster />
    </div>
  );
}
