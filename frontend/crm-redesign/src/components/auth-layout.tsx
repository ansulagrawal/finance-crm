import type { ReactNode } from 'react';

/** Echoes the sidebar's role-badge signature element on the auth screen —
 * a stamped ID card, foreshadowing the badge the person will use once
 * they're inside the app. */
function CredentialIllustration() {
  return (
    <div
      className='relative flex w-72 animate-fade-in flex-col justify-between rounded-2xl bg-white/10 p-6 ring-1 ring-white/15'
      aria-hidden='true'
    >
      <span className='h-1.5 w-14 rounded-full bg-secondary' />
      <div>
        <p className='font-mono font-semibold text-3xl text-primary-foreground tracking-wide'>
          FLP
        </p>
        <p className='mt-1 text-primary-foreground/70 text-sm'>
          Access credential
        </p>
      </div>
      <div className='flex items-center gap-2 border-white/15 border-t pt-4 text-primary-foreground/60 text-xs'>
        <span className='flex size-6 items-center justify-center rounded-full bg-secondary/90 text-[10px] text-white'>
          ✓
        </span>
        Verified session
      </div>
    </div>
  );
}

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  illustration?: ReactNode;
  children: ReactNode;
};

export function AuthLayout({
  title,
  subtitle,
  illustration,
  children,
}: AuthLayoutProps) {
  return (
    <div className='flex min-h-screen'>
      <div className='relative flex flex-1 items-center justify-center p-6'>
        <img
          src='/logo.webp'
          alt='Finance CRM'
          className='absolute top-0 left-5 mx-auto h-15 w-auto rounded px-3 py-1.5'
        />
        <div className='w-full max-w-sm animate-fade-in-up'>
          <h1 className='text-center font-display font-semibold text-2xl text-foreground'>
            {title}
          </h1>
          <p className='mt-1 text-center text-foreground/60 text-sm'>
            {subtitle}
          </p>
          <div className='mt-8'>{children}</div>
        </div>
      </div>

      <div className='relative hidden flex-1 flex-col items-center justify-center gap-8 overflow-hidden bg-primary p-12 text-primary-foreground lg:flex'>
        <div
          aria-hidden='true'
          className='absolute -top-24 -left-24 size-96 animate-drift-1 rounded-full bg-secondary/25 blur-3xl'
        />
        <div
          aria-hidden='true'
          className='absolute -right-16 -bottom-32 size-96 animate-drift-2 rounded-full bg-white/10 blur-3xl'
        />

        <div className='relative'>
          {illustration ?? <CredentialIllustration />}
        </div>
        <div
          className='relative max-w-sm animate-fade-in-up text-center'
          style={{ animationDelay: '0.15s' }}
        >
          <p className='mt-2 text-primary-foreground/70'>
            Manage leads, sanctions screening, and the loan lifecycle for B4
            Salary's instant paperless personal loan business — organized by the
            role you're working in.
          </p>
        </div>
      </div>
    </div>
  );
}
