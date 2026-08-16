import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { CURRENT_USER_QUERY_KEY, signIn, storeUser } from '@/lib/auth';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      try {
        const { user } = await signIn(value.email, value.password);
        await storeUser(user);
        // Seed the query cache with what the login response already gave us
        // so the sidebar/role-gated UI has roles on the very first render of
        // "/" — otherwise useCurrentUser() starts uncached and briefly
        // renders as logged-out until its own /auth/me round trip resolves.
        queryClient.setQueryData(CURRENT_USER_QUERY_KEY, user);
        toast({
          title: 'Signed in',
          description: `Welcome back, ${user.name}.`,
        });
        navigate({ to: '/' });
      } catch (error) {
        // Backend distinguishes a locked account / expired password from a
        // wrong password only by message text (all are plain 401s, same
        // `error: "Unauthorized"` body) — match on that so each gets its own
        // clear message instead of reading like another failed-password
        // attempt.
        const isLocked =
          error instanceof ApiError && /locked/i.test(error.message);
        const isExpired =
          error instanceof ApiError &&
          /password has expired/i.test(error.message);
        if (isLocked) {
          // A password reset now clears `failedLoginCount` server-side, so a
          // locked-out user can recover without an admin — the old copy told
          // them to contact one, which is no longer the shortest path (and
          // was the only way out before that change).
          toast({
            title: 'Account locked',
            description:
              'Too many failed attempts. Reset your password to unlock the account.',
            variant: 'destructive',
          });
          navigate({ to: '/forgot-password' });
          return;
        }
        if (isExpired) {
          // Relay the backend's own message rather than hardcoding the
          // expiry window here — PASSWORD_EXPIRY_DAYS is configurable
          // server-side, so this copy must not assume 14.
          toast({
            title: 'Password expired',
            description: (error as ApiError).message,
          });
          navigate({ to: '/forgot-password' });
          return;
        }
        toast({
          title: 'Sign in failed',
          description:
            error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    },
  });

  return (
    <AuthLayout
      title='Sign in'
      subtitle='Sign in to your Finance CRM account.'
      illustration={
        <DotLottieReact
          src='/login.lottie'
          autoplay
          loop
          className='lottie h-auto w-xl max-w-[50dvw] md:w-2xl xl:w-3xl 2xl:w-5xl'
        />
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit();
        }}
        className='flex flex-col gap-4'
      >
        <form.Field
          name='email'
          validators={{
            onChange: ({ value }) =>
              !/^\S+@\S+\.\S+$/.test(value) ? 'Enter a valid email' : undefined,
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>Email</Label>
              <Input
                placeholder='name@example.com'
                id={field.name}
                type='email'
                autoComplete='email'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name='password'
          validators={{
            onChange: ({ value }) =>
              !value ? 'Password is required' : undefined,
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <div className='flex items-center justify-between'>
                <Label htmlFor={field.name}>Password</Label>
                <Link
                  to='/forgot-password'
                  className='text-primary text-xs hover:underline'
                >
                  Forgot password?
                </Link>
              </div>
              <div className='relative'>
                <Input
                  placeholder='Enter your password'
                  id={field.name}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete='current-password'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  className='pr-10'
                />
                <button
                  type='button'
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className='absolute inset-y-0 right-0 flex w-10 items-center justify-center text-foreground/50 hover:text-foreground'
                >
                  {showPassword ? (
                    <svg viewBox='0 0 24 24' fill='none' className='size-5'>
                      <title>Hide password</title>
                      <path
                        d='M3 3l18 18M10.6 10.6a2.5 2.5 0 003.5 3.5M6.6 6.7C4.5 8.1 3 10 2 12c1.8 3.6 5.5 7 10 7 1.6 0 3.1-.4 4.4-1.1M9.9 5.2A10.4 10.4 0 0112 5c4.5 0 8.2 3.4 10 7-.6 1.1-1.3 2.2-2.2 3.1'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  ) : (
                    <svg viewBox='0 0 24 24' fill='none' className='size-5'>
                      <title>Show password</title>
                      <path
                        d='M2 12c1.8-3.6 5.5-7 10-7s8.2 3.4 10 7c-1.8 3.6-5.5 7-10 7s-8.2-3.4-10-7Z'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinejoin='round'
                      />
                      <circle
                        cx='12'
                        cy='12'
                        r='3'
                        stroke='currentColor'
                        strokeWidth='1.8'
                      />
                    </svg>
                  )}
                </button>
              </div>
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type='primary'
              htmlType='submit'
              disabled={isSubmitting}
              className='mt-2 w-full'
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthLayout>
  );
}
