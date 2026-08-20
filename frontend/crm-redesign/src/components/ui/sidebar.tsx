import { Link } from '@tanstack/react-router';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Sidebar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        'flex h-full w-72 shrink-0 flex-col overflow-y-auto bg-primary p-3 text-primary-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mb-5 border-white/10 border-b px-2 pb-4 font-semibold text-lg',
        className,
      )}
      {...props}
    />
  );
}

/** A folder-tab-style section header: a colored 3px tab-flag identifies the
 * module family, echoing the old app's separate per-role view folders
 * (Screener/, Disbursal/, Collection/, ...) instead of one flat list.
 * `active` brightens the tab-flag and label — the visible cue that the
 * role switcher (`RoleBadge`) actually changed something, not just its own
 * face value. */
export function SidebarSection({
  label,
  accent,
  active,
  children,
}: {
  label: string;
  accent: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div className='mt-5 first:mt-0'>
      <div className='mb-1.5 flex items-center gap-2 px-2.5'>
        <span
          aria-hidden='true'
          className={cn(
            'w-0.75 shrink-0 rounded-full transition-all',
            active ? 'h-4' : 'h-3',
          )}
          style={{ backgroundColor: accent, opacity: active ? 1 : 0.55 }}
        />
        <span
          className={cn(
            'font-display text-[11px] uppercase tracking-wider transition-colors',
            active
              ? 'text-primary-foreground/85'
              : 'text-primary-foreground/45',
          )}
        >
          {label}
        </span>
      </div>
      <div className='flex flex-col gap-0.5'>{children}</div>
    </div>
  );
}

const ACTIVE_CLASSNAME =
  'bg-white/[0.08]! font-medium text-primary-foreground! before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-secondary before:content-[""]';

type SidebarItemProps = Omit<ComponentProps<typeof Link>, 'children'> & {
  icon?: ReactNode;
  children?: ReactNode;
  /** Force the active styling on, for routes whose detail pages live outside `to`'s own path. */
  forceActive?: boolean;
};

export function SidebarItem({
  className,
  icon,
  children,
  forceActive,
  ...props
}: SidebarItemProps) {
  return (
    <Link
      className={cn(
        'relative flex items-center gap-2.5 rounded-md py-2 pr-3 pl-3.5 text-primary-foreground/70 text-sm transition-colors hover:bg-white/6 hover:text-primary-foreground',
        forceActive && ACTIVE_CLASSNAME,
        className,
      )}
      activeProps={{ className: ACTIVE_CLASSNAME }}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}
