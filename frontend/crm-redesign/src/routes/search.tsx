import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';
import type { Lead } from '@/lib/leads';
import { search } from '@/lib/search';

type SearchParams = { q?: string };

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  component: SearchPage,
});

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

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
  { accessorKey: 'pancard', header: 'PAN' },
  { accessorKey: 'applicationNo', header: 'Application no.' },
  {
    accessorKey: 'loanAmount',
    header: 'Amount',
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
      return <Badge variant='default'>{status?.name ?? 'Unknown'}</Badge>;
    },
  },
];

function SearchPage() {
  const navigate = useNavigate();
  const { q } = Route.useSearch();
  const trimmed = q?.trim() ?? '';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => search(trimmed),
    enabled: trimmed.length >= 2,
  });

  return (
    <>
      <div>
        <h1 className='font-display font-semibold text-2xl text-primary'>
          Search results
        </h1>
        <p className='text-foreground/60 text-sm'>
          {trimmed
            ? `Matches for "${trimmed}"`
            : 'Type at least 2 characters in the search bar to begin.'}
        </p>
      </div>

      {trimmed.length < 2 ? null : (
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
              Search failed. Try again.
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={data?.leads ?? []}
              emptyMessage='No matches found.'
              onRowClick={(lead) =>
                navigate({
                  to: '/leads/$leadId',
                  params: { leadId: String(lead.id) },
                })
              }
            />
          )}
        </div>
      )}
    </>
  );
}
