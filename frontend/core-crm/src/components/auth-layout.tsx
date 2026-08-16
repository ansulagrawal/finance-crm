import type { CSSProperties, ReactNode } from 'react';

function BrandIllustration() {
  return (
    <svg
      viewBox='0 0 320 320'
      fill='none'
      className='h-64 w-64 text-secondary'
      aria-hidden='true'
    >
      <title>Finance CRM</title>
      <rect
        x='36'
        y='44'
        width='150'
        height='96'
        rx='12'
        className='fill-white/10'
      />
      <rect
        x='64'
        y='76'
        width='150'
        height='96'
        rx='12'
        className='fill-white/10'
      />
      <path
        d='M160 60 L232 88 V152 C232 196 202 232 160 248 C118 232 88 196 88 152 V88 Z'
        stroke='currentColor'
        strokeWidth='6'
        strokeLinejoin='round'
        className='animate-draw'
        style={{ '--draw-length': 620 } as CSSProperties}
        strokeDasharray='620'
      />
      <path
        d='M132 156 L154 180 L196 132'
        stroke='currentColor'
        strokeWidth='8'
        strokeLinecap='round'
        strokeLinejoin='round'
        className='animate-draw'
        style={
          { animationDelay: '0.9s', '--draw-length': 100 } as CSSProperties
        }
        strokeDasharray='100'
      />
    </svg>
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
          <h1 className='text-center font-semibold text-2xl text-foreground'>
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

        <div className='relative animate-fade-in'>
          {illustration ?? <BrandIllustration />}
        </div>
        <div
          className='relative max-w-sm animate-fade-in-up text-center'
          style={{ animationDelay: '0.15s' }}
        >
          <p className='mt-2 text-primary-foreground/70'>
            Manage leads, sanctions screening, and the loan lifecycle for B4
            Salary's instant paperless personal loan business — all in one
            place.
          </p>
        </div>
      </div>
    </div>
  );
}
