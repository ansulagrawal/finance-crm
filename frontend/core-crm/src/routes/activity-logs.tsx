import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useHasRole } from '@/lib/roles';
import {
  listActivityLogs,
  USER_ACTIVITY_TYPE_LABEL,
  type UserActivityLog,
  type UserActivityType,
} from '@/lib/users';

export const Route = createFileRoute('/activity-logs')({
  component: ActivityLogsPage,
});

const ALL = 'all';
const ACTIVITY_TYPES: UserActivityType[] = [1, 2, 3];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const columns: ColumnDef<UserActivityLog>[] = [
  {
    accessorKey: 'user',
    header: 'User',
    cell: ({ getValue }) => getValue<UserActivityLog['user']>().name,
  },
  {
    accessorKey: 'activityType',
    header: 'Activity',
    cell: ({ getValue }) => {
      const activityType = getValue<UserActivityType>();
      return (
        <Badge variant={activityType === 1 ? 'success' : 'muted'}>
          {USER_ACTIVITY_TYPE_LABEL[activityType]}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP',
    cell: ({ getValue }) => getValue<string | null>() ?? '—',
  },
  {
    accessorKey: 'platform',
    header: 'Platform',
    cell: ({ getValue }) => getValue<string | null>() ?? '—',
  },
  {
    accessorKey: 'occurredAt',
    header: 'Occurred at',
    cell: ({ getValue }) => formatDateTime(getValue<string>()),
  },
];

function ActivityLogsPage() {
  const isAdmin = useHasRole('SA', 'CA');
  const [page, setPage] = useState(1);
  const [activityType, setActivityType] = useState<string>(ALL);
  const limit = 30;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity-logs', { page, activityType }],
    queryFn: () =>
      listActivityLogs({
        page,
        limit,
        activityType:
          activityType === ALL
            ? undefined
            : (Number(activityType) as UserActivityType),
      }),
    placeholderData: (previous) => previous,
    enabled: isAdmin,
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
      <div>
        <h1 className='font-semibold text-2xl text-primary'>Activity logs</h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} entr${data.total === 1 ? 'y' : 'ies'}`
            : 'Loading…'}
        </p>
      </div>

      <div
        className='flex items-center gap-3 rounded-lg border border-border bg-background p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Select
          value={activityType}
          onValueChange={(value) => {
            setActivityType(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-44'>
            <SelectValue placeholder='All activity' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All activity</SelectItem>
            {ACTIVITY_TYPES.map((type) => (
              <SelectItem key={type} value={String(type)}>
                {USER_ACTIVITY_TYPE_LABEL[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className='animate-fade-in-up rounded-lg border border-border bg-background p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {isLoading ? (
          <div className='flex h-40 items-center justify-center'>
            <Spinner className='text-primary' />
          </div>
        ) : isError ? (
          <p className='py-10 text-center text-destructive text-sm'>
            Couldn't load activity logs. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            emptyMessage='No activity recorded.'
            manualPagination={{
              pageIndex: page - 1,
              pageCount: data ? Math.max(1, Math.ceil(data.total / limit)) : 1,
              onPageChange: (pageIndex) => setPage(pageIndex + 1),
            }}
          />
        )}
      </div>
    </>
  );
}
