import { Link } from '@tanstack/react-router';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Sidebar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        // h-full, not h-screen: `.app` is already pinned to the viewport, and
        // a 100vh child inside it disagrees with the parent by whatever the
        // browser chrome takes. overflow-y-auto keeps a long nav list
        // scrolling inside the rail rather than pushing the footer off.
        'flex h-full w-64 shrink-0 flex-col gap-0.5 overflow-y-auto bg-primary p-3 text-primary-foreground',
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
        'mb-6 border-white/10 border-b px-2 pb-4 font-semibold text-lg',
        className,
      )}
      {...props}
    />
  );
}

const ACTIVE_CLASSNAME =
  'bg-white/[0.08]! font-medium text-primary-foreground! before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-secondary before:content-[""]';

type SidebarItemProps = Omit<ComponentProps<typeof Link>, 'children'> & {
  icon?: ReactNode;
  children?: ReactNode;
  /** Force the active styling on, for routes whose detail pages live outside `to`'s own path (e.g. `/leads/$leadId` for a Leads item linking to `/`). */
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
