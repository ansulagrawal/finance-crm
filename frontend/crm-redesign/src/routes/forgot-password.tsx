import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { MoveLeft } from 'lucide-react';
import { useState } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OtpInput } from '@/components/ui/otp-input';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  requestPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
} from '@/lib/auth';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
});

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      try {
        await requestPasswordResetOtp(value.email);
        toast({
          title: 'OTP sent',
          description: `If ${value.email} is registered, we emailed a 6-digit code.`,
        });
        onSent(value.email);
      } catch (error) {
        toast({
          title: 'Could not send OTP',
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

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type='primary'
            htmlType='submit'
            disabled={isSubmitting}
            className='mt-2 w-full'
          >
            {isSubmitting ? 'Sending…' : 'Send OTP'}
          </Button>
        )}
      </form.Subscribe>

      <Link
        to='/login'
        className='flex items-center justify-center gap-1 text-center text-primary text-sm hover:underline'
      >
        <MoveLeft className='w-4' />
        Back to sign in
      </Link>
    </form>
  );
}

function ResetStep({ email }: { email: string }) {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: { otp: '', password: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      try {
        const { resetToken } = await verifyPasswordResetOtp(email, value.otp);
        await resetPassword(resetToken, value.password);
        toast({
          title: 'Password reset',
          description: 'You can now sign in with your new password.',
        });
        navigate({ to: '/login' });
      } catch (error) {
        // The backend burns a reset request after 5 wrong OTP guesses, and
        // deliberately returns the same generic "Invalid or expired OTP"
        // either way. So the copy can't tell the user which happened — it
        // points at the one action that always works: request a fresh OTP.
        const isBadOtp =
          error instanceof ApiError &&
          /invalid or expired otp/i.test(error.message);
        toast({
          title: 'Could not reset password',
          description: isBadOtp
            ? 'That OTP is not valid. After several wrong attempts an OTP stops working — go back and request a new one.'
            : error instanceof ApiError
              ? error.message
              : 'Something went wrong. Please try again.',
          variant: 'destructive',
        });
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className='flex flex-col gap-4'
    >
      <p className='text-foreground/60 text-sm'>
        Enter the 6-digit code sent to{' '}
        <span className='font-medium text-foreground'>{email}</span>.
      </p>

      <form.Field
        name='otp'
        validators={{
          onChange: ({ value }) =>
            value.length !== 6 ? 'Enter the 6-digit code' : undefined,
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor='otp-0'>One-time code</Label>
            <OtpInput value={field.state.value} onChange={field.handleChange} />
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
            value.length < 8 ? 'At least 8 characters' : undefined,
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>New password</Label>
            <Input
              placeholder='At least 8 characters'
              id={field.name}
              type='password'
              autoComplete='new-password'
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
        name='confirmPassword'
        validators={{
          onChangeListenTo: ['password'],
          onChange: ({ value, fieldApi }) =>
            value !== fieldApi.form.getFieldValue('password')
              ? 'Passwords do not match'
              : undefined,
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Confirm password</Label>
            <Input
              placeholder='Re-enter the new password'
              id={field.name}
              type='password'
              autoComplete='new-password'
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

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type='primary'
            htmlType='submit'
            disabled={isSubmitting}
            className='mt-2 w-full'
          >
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <AuthLayout
      title={email ? 'Enter code' : 'Forgot password'}
      subtitle={
        email
          ? 'Check your inbox for the verification code.'
          : "We'll email you a one-time code."
      }
    >
      {email ? <ResetStep email={email} /> : <EmailStep onSent={setEmail} />}
    </AuthLayout>
  );
}
