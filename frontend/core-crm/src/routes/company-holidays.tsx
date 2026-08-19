import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  type CompanyHoliday,
  createCompanyHoliday,
  listCompanyHolidays,
  removeCompanyHoliday,
} from '@/lib/company-holidays';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/company-holidays')({
  component: CompanyHolidaysPage,
});

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    weekday: 'short',
  });
}

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function NewHolidayForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createCompanyHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-holidays'] });
      toast({ title: 'Holiday added' });
      onSuccess();
    },
    onError: (error) => onMutationError(error, 'Could not add holiday'),
  });

  const form = useForm({
    defaultValues: {
      holidayDate: '',
      name: '',
    },
    onSubmit: ({ value }) => {
      mutation.mutate({
        holidayDate: value.holidayDate,
        name: value.name.trim(),
      });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className='flex flex-col gap-3'
    >
      <form.Field
        name='holidayDate'
        validators={{
          onChange: ({ value }) => (!value ? 'Date is required' : undefined),
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Date</Label>
            <DatePicker
              id={field.name}
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
        name='name'
        validators={{
          onChange: ({ value }) =>
            !value.trim() ? 'Name is required' : undefined,
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Holiday name</Label>
            <Input
              id={field.name}
              placeholder='Independence Day'
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
        <ModalClose asChild>
          <Button type='secondary' htmlType='button'>
            Cancel
          </Button>
        </ModalClose>
        <Button type='primary' htmlType='submit' disabled={mutation.isPending}>
          Add holiday
        </Button>
      </ModalFooter>
    </form>
  );
}

function CompanyHolidaysPage() {
  const isAdmin = useHasRole('SA', 'CA');
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['company-holidays'],
    queryFn: listCompanyHolidays,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeCompanyHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-holidays'] });
      toast({ title: 'Holiday removed' });
    },
    onError: (error) => onMutationError(error, 'Could not remove holiday'),
  });

  if (!isAdmin) {
    return (
      <p className='py-10 text-center text-foreground/60 text-sm'>
        You don't have access to this page.
      </p>
    );
  }

  return (
    <>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-semibold text-2xl text-primary'>
            Company Holidays
          </h1>
          <p className='text-foreground/60 text-sm'>
            Holiday calendar used across the company.
          </p>
        </div>
        <Modal open={modalOpen} onOpenChange={setModalOpen}>
          <ModalTrigger asChild>
            <Button type='primary'>Add holiday</Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Add holiday</ModalTitle>
              <ModalDescription>
                Add a date to the company holiday calendar.
              </ModalDescription>
            </ModalHeader>
            <NewHolidayForm onSuccess={() => setModalOpen(false)} />
          </ModalContent>
        </Modal>
      </div>

      <div
        className='rounded-lg border border-border bg-background p-5'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {isLoading ? (
          <p className='py-4 text-foreground/50 text-sm'>Loading…</p>
        ) : holidays?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className='w-10' />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map((holiday: CompanyHoliday) => (
                <TableRow key={holiday.id}>
                  <TableCell>{formatDate(holiday.holidayDate)}</TableCell>
                  <TableCell>{holiday.name}</TableCell>
                  <TableCell>
                    <button
                      type='button'
                      aria-label={`Remove ${holiday.name}`}
                      onClick={() => removeMutation.mutate(holiday.id)}
                      disabled={removeMutation.isPending}
                      className='text-destructive/70 hover:text-destructive disabled:opacity-50'
                    >
                      <Trash2 className='size-4' />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className='py-4 text-foreground/50 text-sm'>
            No holidays added yet.
          </p>
        )}
      </div>
    </>
  );
}
