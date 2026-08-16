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
  History,
  ListChecks,
  ListFilter,
  LogOut,
  MapPin,
  MessageSquare,
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
import { useEffect, useState } from 'react';
import { ChangePasswordModal } from '@/components/change-password-modal';
import { LeadAllocationToggle } from '@/components/lead-allocation-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sidebar, SidebarHeader, SidebarItem } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toast';
import {
  loadStoredUser,
  logout,
  type SafeUser,
  useCurrentUser,
} from '@/lib/auth';
import { ADMIN_OVERRIDE_ROLES } from '@/lib/roles';

/** `roles` omitted = visible to every authenticated user. Filtered with a
 * plain array check (not the `useHasRole` hook) since this list is
 * rendered inside a `.map`, where a variable number of hook calls would
 * violate the rules of hooks. */
const NAV_ITEMS = [
  { to: '/', label: 'Leads', icon: Users },
  { to: '/sanctions', label: 'Sanctions', icon: ShieldCheck },
  { to: '/loans', label: 'Loans', icon: Banknote },
  {
    to: '/disbursed-waived',
    label: 'Disbursed waived',
    icon: CircleOff,
  },
  { to: '/collections', label: 'Collections', icon: Wallet },
  {
    to: '/field-verification',
    label: 'Field Verification',
    icon: MapPin,
    roles: ['CO1', 'CO2', 'CO3', 'CFE1'],
  },
  { to: '/rejected-leads', label: 'Rejected leads', icon: XCircle },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/performance', label: 'Performance', icon: Target },
  {
    to: '/audit',
    label: 'Audit',
    icon: FileSearch,
    roles: ['AU', 'AM', 'AH'],
  },
  { to: '/bre', label: 'BRE', icon: ListChecks, roles: ['SA', 'CA'] },
  {
    to: '/feedback',
    label: 'Feedback',
    icon: MessageSquare,
    roles: ['SA', 'CA'],
  },
  {
    to: '/menu-permissions',
    label: 'Menu & Permissions',
    icon: Settings,
    roles: ['SA', 'CA'],
  },
  { to: '/users', label: 'Users', icon: UserCog, roles: ['SA', 'CA'] },
  { to: '/roles', label: 'Roles', icon: Shield, roles: ['SA', 'CA'] },
  {
    to: '/activity-logs',
    label: 'Activity logs',
    icon: History,
    roles: ['SA', 'CA'],
  },
  {
    to: '/company-geography',
    label: 'Company & Geography',
    icon: MapPin,
    roles: ['SA', 'CA'],
  },
  {
    to: '/company-holidays',
    label: 'Company Holidays',
    icon: CalendarDays,
    roles: ['SA', 'CA'],
  },
  {
    to: '/collection-buckets',
    label: 'Collection Buckets',
    icon: ListFilter,
    roles: ['SA', 'CA'],
  },
] as const;

const BARE_ROUTES = ['/login', '/forgot-password'];

function AccountMenu({ user }: { user: SafeUser }) {
  const navigate = useNavigate();

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger className='flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted'>
        <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70'>
          <User className='size-3.5' />
        </span>
        <span className='font-medium text-foreground'>{user.name}</span>
        <ChevronDown className='size-4 shrink-0 text-foreground/60' />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className='z-50 w-56 overflow-hidden rounded-md border border-border bg-background p-1 shadow-lg'
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

function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  // This bar lives in the root layout, so it never unmounts across
  // navigations — without this, a typed query stuck around in the box
  // after leaving `/search` for an unrelated page.
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
    // `resolvedLocation`, not `location`: `location` flips to the target
    // path the instant navigate() is called, while `resolvedLocation` only
    // updates once that route has actually committed. Reading `location`
    // here made the sidebar/chrome unmount as soon as a navigation to a
    // bare route (e.g. logout -> /login) started, well before the login
    // page had anything to paint — a blank, stretched flash in between.
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });
  const isBareRoute = BARE_ROUTES.includes(pathname);
  const user = useCurrentUser();
  // `SA`/`CA` see every nav item regardless of its own `roles` list —
  // matches `useHasRole`'s/the backend `RolesGuard`'s universal override.
  // Not `useHasRole` itself: NAV_ITEMS is filtered inside a `.map`, and a
  // per-item hook call would violate the rules of hooks (see NAV_ITEMS's
  // own comment above).
  const isAdmin = Boolean(
    user?.roles.some((role) => ADMIN_OVERRIDE_ROLES.includes(role)),
  );

  if (isBareRoute) {
    return (
      <>
        <Outlet />
        <Toaster />
      </>
    );
  }

  return (
    <div className='app'>
      <Sidebar>
        <SidebarHeader>
          <img
            src='/logo.webp'
            alt='Finance CRM'
            className='mx-auto h-10 w-auto rounded px-2 py-1'
          />
        </SidebarHeader>

        {NAV_ITEMS.filter(
          (item) =>
            !('roles' in item) ||
            isAdmin ||
            item.roles.some((role) => user?.roles.includes(role)),
        ).map(({ to, label, icon: Icon }) => (
          <SidebarItem
            key={to}
            to={to}
            forceActive={to === '/' && pathname.startsWith('/leads')}
          >
            <Icon className='size-4' />
            {label}
          </SidebarItem>
        ))}
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
