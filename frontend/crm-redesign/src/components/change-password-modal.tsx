import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import { PasswordInput } from '@/components/ui/password-input';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { changePassword, logout } from '@/lib/auth';

const NEW_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await changePassword(value.currentPassword, value.newPassword);
        setOpen(false);
        form.reset();
        toast({
          title: 'Password changed',
          description: 'Your session has ended. Please sign in again.',
        });
        await logout();
        navigate({ to: '/login' });
      } catch (error) {
        toast({
          title: 'Could not change password',
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
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <ModalTrigger asChild>
        <Button type='ghost' className='w-full justify-start gap-2'>
          <KeyRound className='size-4' />
          Change password
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Change password</ModalTitle>
          <ModalDescription>
            Changing your password will sign you out of your current session.
          </ModalDescription>
        </ModalHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            form.handleSubmit();
          }}
          className='flex flex-col gap-4'
        >
          <form.Field
            name='currentPassword'
            validators={{
              onChange: ({ value }) =>
                value.length === 0 ? 'Current password is required' : undefined,
            }}
          >
            {(field) => (
              <div className='flex flex-col gap-1'>
                <Label htmlFor={field.name}>Current password</Label>
                <PasswordInput
                  placeholder='Enter your current password'
                  id={field.name}
                  autoComplete='current-password'
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
            name='newPassword'
            validators={{
              onChange: ({ value }) => {
                if (value.length < 8) return 'At least 8 characters';
                if (!NEW_PASSWORD_PATTERN.test(value))
                  return 'Must contain at least one letter and one number';
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className='flex flex-col gap-1'>
                <Label htmlFor={field.name}>New password</Label>
                <PasswordInput
                  placeholder='At least 8 characters'
                  id={field.name}
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
              onChangeListenTo: ['newPassword'],
              onChange: ({ value, fieldApi }) =>
                value !== fieldApi.form.getFieldValue('newPassword')
                  ? 'Passwords do not match'
                  : undefined,
            }}
          >
            {(field) => (
              <div className='flex flex-col gap-1'>
                <Label htmlFor={field.name}>Confirm new password</Label>
                <PasswordInput
                  placeholder='Re-enter the new password'
                  id={field.name}
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

          <ModalFooter>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  type='primary'
                  htmlType='submit'
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Changing…' : 'Change password'}
                </Button>
              )}
            </form.Subscribe>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
