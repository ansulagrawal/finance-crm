import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { type Lead, listLeadsQueue } from '@/lib/leads';
import { listMasterStatuses, type MasterStatus } from '@/lib/lookups';

export const Route = createFileRoute('/collections')({
  component: CollectionsPage,
});

const ALL = 'all';

/** `MasterStatus.stageCode`s covered by the CO1/CO2/CO3 collections queue —
 * mirrors `QUEUE_ROLE_SCOPES.CO1`/`.CO2`/`.CO3` in core-api's
 * leads.service.ts. */
const COLLECTION_STAGE_CODES = ['S12', 'S13', 'S14', 'S16'];

function statusBadgeVariant(
  status: MasterStatus | null,
): 'muted' | 'default' | 'success' | 'destructive' | 'warning' {
  if (!status) return 'muted';
  const name = status.name;
  if (
    name.includes('REJECT') ||
    name.includes('CANCEL') ||
    name === 'DUPLICATE'
  ) {
    return 'destructive';
  }
  if (name.includes('CLOSED') || name === 'SETTLED') {
    return 'success';
  }
  if (name.includes('HOLD') || name.includes('SEND-BACK')) {
    return 'warning';
  }
  return 'default';
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CollectionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadStatusId, setLeadStatusId] = useState<string>(ALL);
  const limit = 20;

  const { data: statuses } = useQuery({
    queryKey: ['master-statuses'],
    queryFn: () => listMasterStatuses(),
  });

  const collectionStatuses = statuses?.filter((status) =>
    COLLECTION_STAGE_CODES.includes(status.stageCode),
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leads-queue', 'collections', { page, search, leadStatusId }],
    queryFn: () =>
      listLeadsQueue({
        page,
        limit,
        search: search || undefined,
        leadStatusId: leadStatusId === ALL ? undefined : Number(leadStatusId),
      }),
    placeholderData: (previous) => previous,
  });

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: 'id',
      header: 'Lead ID',
      cell: ({ getValue }) => (
        <span className='font-mono text-xs'>#{getValue<number>()}</span>
      ),
    },
    { accessorKey: 'firstName', header: 'Name' },
    { accessorKey: 'mobile', header: 'Mobile' },
    {
      accessorKey: 'loanAmount',
      header: 'Requested amount',
      cell: ({ getValue }) => (
        <span className='font-mono'>
          {formatCurrency(getValue<number | null>())}
        </span>
      ),
    },
    {
      accessorKey: 'leadStatus',
      header: 'Status',
      cell: ({ getValue }) => {
        const status = getValue<Lead['leadStatus']>();
        return (
          <Badge variant={statusBadgeVariant(status)}>
            {status?.name ?? 'Unknown'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      cell: ({ getValue }) => (
        <span className='text-foreground/60 text-xs'>
          {formatDate(getValue<string | null>())}
        </span>
      ),
    },
  ];

  return (
    <>
      <div>
        <h1 className='font-display font-semibold text-2xl text-primary'>
          Collections
        </h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} lead${data.total === 1 ? '' : 's'} in collection stages`
            : 'Loading…'}
        </p>
      </div>

      <div
        className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Input
          placeholder='Search by name, mobile, email…'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className='max-w-xs'
        />
        <Select
          value={leadStatusId}
          onValueChange={(value) => {
            setLeadStatusId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-56'>
            <SelectValue placeholder='All collection stages' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All collection stages</SelectItem>
            {collectionStatuses?.map((status) => (
              <SelectItem key={status.id} value={String(status.id)}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className='animate-fade-in-up rounded-lg border border-border bg-white p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {isLoading ? (
          <div className='flex h-40 items-center justify-center'>
            <Spinner className='text-primary' />
          </div>
        ) : isError ? (
          <p className='py-10 text-center text-destructive text-sm'>
            Couldn't load the collections queue. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            emptyMessage='No leads in collection stages match these filters.'
            onRowClick={(lead) =>
              navigate({
                to: '/leads/$leadId',
                params: { leadId: String(lead.id) },
              })
            }
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
