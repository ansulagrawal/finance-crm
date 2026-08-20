import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useNavigate } from '@tanstack/react-router';
import { ChevronsUpDown } from 'lucide-react';
import {
  familyForRole,
  getRoleHomeRoute,
  ROLE_LABEL,
  useActiveRole,
} from '@/lib/active-role';
import type { SafeUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * The role switcher, styled as an ID badge clipped to the sidebar — a
 * monospace role code, colored family stripe, and full role name make it
 * read as a credential rather than a generic dropdown. Opening it (a plain
 * popover, not a flip/animation gimmick — reliable at this size) lists the
 * user's other assigned roles to switch into.
 *
 * This only changes which nav sections are emphasized (see __root.tsx) — the
 * backend still enforces the full union of `user.roles` regardless of which
 * one is "active" here.
 */
export function RoleBadge({ user }: { user: SafeUser }) {
  const { activeRole, setActiveRole } = useActiveRole();
  const navigate = useNavigate();

  if (!activeRole) return null;

  const family = familyForRole(activeRole);
  const otherRoles = user.roles.filter((role) => role !== activeRole);

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        disabled={otherRoles.length === 0}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2.5 text-left transition-colors hover:bg-white/10 disabled:cursor-default disabled:hover:bg-white/[0.06]',
        )}
      >
        <span
          aria-hidden='true'
          className='h-8 w-1 shrink-0 rounded-full'
          style={{ backgroundColor: family.accent }}
        />
        <span className='min-w-0 flex-1'>
          <span className='block font-mono font-semibold text-primary-foreground text-xs tracking-wide'>
            {activeRole}
          </span>
          <span className='block truncate text-primary-foreground/70 text-sm'>
            {ROLE_LABEL[activeRole] ?? activeRole}
          </span>
        </span>
        {otherRoles.length > 0 && (
          <ChevronsUpDown className='size-3.5 shrink-0 text-primary-foreground/40' />
        )}
      </PopoverPrimitive.Trigger>

      {otherRoles.length > 0 && (
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align='start'
            sideOffset={6}
            className='z-50 w-64 rounded-lg border border-border bg-white p-1.5 shadow-lg'
          >
            <p className='px-2 pt-1 pb-1.5 font-display text-[11px] text-muted-foreground uppercase tracking-wider'>
              Switch role
            </p>
            {otherRoles.map((role) => (
              <PopoverPrimitive.Close key={role} asChild>
                <button
                  type='button'
                  onClick={() => {
                    setActiveRole(role);
                    navigate({ to: getRoleHomeRoute(role) });
                  }}
                  className='flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-muted'
                >
                  <span
                    aria-hidden='true'
                    className='h-5 w-1 shrink-0 rounded-full'
                    style={{ backgroundColor: familyForRole(role).accent }}
                  />
                  <span className='font-mono text-foreground/70 text-xs'>
                    {role}
                  </span>
                  <span className='truncate text-foreground'>
                    {ROLE_LABEL[role] ?? role}
                  </span>
                </button>
              </PopoverPrimitive.Close>
            ))}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      )}
    </PopoverPrimitive.Root>
  );
}
