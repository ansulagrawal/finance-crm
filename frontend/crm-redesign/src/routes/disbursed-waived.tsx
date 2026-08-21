import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { type Lead, listLeads } from '@/lib/leads';

export const Route = createFileRoute('/disbursed-waived')({
  component: DisbursedWaivedPage,
});

/** Stage code for `DISBURSED-WAIVED` (`S30`) — not owned by any role in
 * `QUEUE_ROLE_SCOPES` (core-api's leads.service.ts), so this is a
 * cross-role filter view over `GET /leads`, same convention as
 * `rejected-leads.tsx`. */
const DISBURSED_WAIVED_STAGE_CODES = ['S30'];

function DisbursedWaivedPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['disbursed-waived-leads', { page, search }],
    queryFn: () =>
      listLeads({
        page,
        limit,
        search: search || undefined,
        stageCode: DISBURSED_WAIVED_STAGE_CODES.join(','),
      }),
  });

  const leads = data?.data ?? [];

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
      accessorKey: 'applicationNo',
      header: 'Application no.',
      cell: ({ getValue }) => getValue<string | null>() ?? '—',
    },
    {
      accessorKey: 'loanAmount',
      header: 'Loan amount',
      cell: ({ getValue }) => {
        const amount = getValue<number | null>();
        return amount ? `₹${amount.toLocaleString('en-IN')}` : '—';
      },
    },
    {
      accessorKey: 'leadStatus',
      header: 'Lead status',
      cell: ({ getValue }) => {
        const status = getValue<Lead['leadStatus']>();
        return <Badge variant='warning'>{status?.name ?? 'Unknown'}</Badge>;
      },
    },
  ];

  return (
    <>
      <div>
        <h1 className='font-display font-semibold text-2xl text-primary'>
          Disbursed waived applications
        </h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} waived loan${data.total === 1 ? '' : 's'}`
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
            Couldn't load waived applications. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={leads}
            emptyMessage='No waived applications match these filters.'
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
