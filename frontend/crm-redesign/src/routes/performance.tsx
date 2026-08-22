import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import { useCurrentUser } from '@/lib/auth';
import {
  getUserPerformance,
  USER_TARGET_ALLOCATION_TYPE,
  USER_TARGET_ALLOCATION_TYPE_LABEL,
  type UserTargetAllocationType,
  upsertUserTarget,
} from '@/lib/performance';
import { useHasRole } from '@/lib/roles';
import { listUsers } from '@/lib/users';

export const Route = createFileRoute('/performance')({
  component: PerformancePage,
});

const TARGET_TYPES: UserTargetAllocationType[] = [1, 2];

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function onMutationError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

function PerformanceMeter({
  label,
  achieved,
  target,
  format,
}: {
  label: string;
  achieved: number;
  target: number;
  format: (value: number) => string;
}) {
  const pct =
    target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-baseline justify-between'>
        <span className='text-foreground/60 text-sm'>{label}</span>
        <span className='font-medium text-sm'>
          {format(achieved)}{' '}
          <span className='text-foreground/50'>/ {format(target)}</span>
        </span>
      </div>
      <div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
        <div
          className='h-full rounded-full bg-primary'
          style={{ width: `${target > 0 ? pct : 0}%` }}
        />
      </div>
      <span className='text-foreground/50 text-xs'>
        {target > 0 ? `${pct}% of target` : 'No target set'}
      </span>
    </div>
  );
}

function PerformanceCard({
  userId,
  type,
  title,
}: {
  userId: number;
  type: UserTargetAllocationType;
  title: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['performance', userId, type],
    queryFn: () => getUserPerformance(userId, type),
  });

  return (
    <div
      className='flex flex-col gap-4 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <h2 className='font-display font-semibold text-lg text-primary'>
          {title}
        </h2>
        <p className='text-foreground/60 text-sm'>
          {USER_TARGET_ALLOCATION_TYPE_LABEL[type]} target
        </p>
      </div>
      {isLoading ? (
        <p className='py-2 text-foreground/50 text-sm'>Loading…</p>
      ) : data ? (
        <div className='flex flex-col gap-4'>
          <PerformanceMeter
            label='Amount'
            achieved={data.achievedAmount}
            target={data.targetAmount}
            format={formatCurrency}
          />
          <PerformanceMeter
            label='Cases'
            achieved={data.achievedCases}
            target={data.targetCases}
            format={(value) => String(value)}
          />
        </div>
      ) : null}
    </div>
  );
}

function SetTargetForm({ onSuccess }: { onSuccess: (userId: number) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: userResults } = useQuery({
    queryKey: ['users-search', search],
    queryFn: () => listUsers({ search, limit: 10 }),
    enabled: search.trim().length > 1,
  });

  const mutation = useMutation({
    mutationFn: upsertUserTarget,
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['performance', result.user.id],
      });
      toast({ title: 'Target saved' });
      onSuccess(result.user.id);
    },
    onError: (error) => onMutationError(error, 'Could not save target'),
  });

  const form = useForm({
    defaultValues: {
      type: USER_TARGET_ALLOCATION_TYPE.SANCTION as UserTargetAllocationType,
      targetAmount: 0,
      targetCases: 0,
    },
    onSubmit: ({ value }) => {
      if (!selectedUserId) return;
      mutation.mutate({
        userId: Number(selectedUserId),
        type: value.type,
        targetAmount: value.targetAmount,
        targetCases: value.targetCases,
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
      <div className='flex flex-col gap-1'>
        <Label htmlFor='performance-user-search'>User</Label>
        <Input
          id='performance-user-search'
          placeholder='Search by name, email, username, mobile…'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelectedUserId('');
          }}
        />
        {userResults?.data.length ? (
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className='mt-1'>
              <SelectValue placeholder='Select user' />
            </SelectTrigger>
            <SelectContent>
              {userResults.data.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <form.Field name='type'>
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Target type</Label>
            <Select
              value={String(field.state.value)}
              onValueChange={(value) =>
                field.handleChange(Number(value) as UserTargetAllocationType)
              }
            >
              <SelectTrigger id={field.name}>
                <SelectValue placeholder='Select target type' />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPES.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {USER_TARGET_ALLOCATION_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form.Field>

      <form.Field name='targetAmount'>
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Target amount (₹)</Label>
            <NumberInput
              id={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              min={0}
              step={10000}
            />
          </div>
        )}
      </form.Field>

      <form.Field name='targetCases'>
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Target cases</Label>
            <NumberInput
              id={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              min={0}
              step={1}
            />
          </div>
        )}
      </form.Field>

      <Button
        type='primary'
        htmlType='submit'
        disabled={!selectedUserId || mutation.isPending}
      >
        Save target
      </Button>
    </form>
  );
}

function PerformancePage() {
  const user = useCurrentUser();
  const isAdmin = useHasRole('SA', 'CA');
  const [type, setType] = useState<UserTargetAllocationType>(
    USER_TARGET_ALLOCATION_TYPE.SANCTION,
  );
  const [lastSetUserId, setLastSetUserId] = useState<number | null>(null);

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-display font-semibold text-2xl text-primary'>
            Performance
          </h1>
          <p className='text-foreground/60 text-sm'>
            Rolling target vs. achieved — no month window, legacy tracks one
            running total per target type.
          </p>
        </div>
        <div className='flex flex-col gap-1'>
          <Label htmlFor='performance-type'>Type</Label>
          <Select
            value={String(type)}
            onValueChange={(value) =>
              setType(Number(value) as UserTargetAllocationType)
            }
          >
            <SelectTrigger id='performance-type' className='w-36'>
              <SelectValue placeholder='Select type' />
            </SelectTrigger>
            <SelectContent>
              {TARGET_TYPES.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {USER_TARGET_ALLOCATION_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {user ? (
        <PerformanceCard userId={user.id} type={type} title='My performance' />
      ) : null}

      {isAdmin ? (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <div
            className='flex flex-col gap-4 rounded-lg border border-border bg-white p-5'
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div>
              <h2 className='font-display font-semibold text-lg text-primary'>
                Set a user's target
              </h2>
              <p className='text-foreground/60 text-sm'>
                SA/CA only — sets a user's rolling sanction or collection
                target.
              </p>
            </div>
            <SetTargetForm onSuccess={setLastSetUserId} />
          </div>

          {lastSetUserId ? (
            <PerformanceCard
              userId={lastSetUserId}
              type={type}
              title="That user's performance"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
