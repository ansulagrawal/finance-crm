import { useQueries, useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
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
import { useCurrentUser } from '@/lib/auth';
import { getLoan, LOAN_STATUS } from '@/lib/disbursal';
import { type Lead, listLeads, listLeadsQueue } from '@/lib/leads';
import { listMasterStatuses, type MasterStatus } from '@/lib/lookups';

export const Route = createFileRoute('/loans')({
  component: LoansPage,
});

const ALL = 'all';

/** Stage codes covered by the DS1 role scope in `QUEUE_ROLE_SCOPES`
 * (core-api's leads.service.ts) — the disbursal pipeline. Kept in sync
 * manually, same convention as `index.tsx`'s `QUEUE_ROLES`. */
const DISBURSAL_STAGE_CODES = ['S13', 'S20', 'S21', 'S22', 'S25'];

function loanStatusVariant(
  status: string,
): 'muted' | 'success' | 'warning' | 'destructive' {
  if (status === LOAN_STATUS.WRITTEN_OFF) return 'destructive';
  if (status === LOAN_STATUS.CLOSED) return 'warning';
  if (status === LOAN_STATUS.DISBURSED || status === LOAN_STATUS.SETTLED) {
    return 'success';
  }
  return 'muted';
}

function statusBadgeVariant(
  status: MasterStatus | null,
): 'muted' | 'default' | 'success' | 'destructive' | 'warning' {
  if (!status) return 'muted';
  const name = status.name;
  if (name.includes('REJECT') || name.includes('CANCEL')) return 'destructive';
  if (name.includes('HOLD') || name.includes('SEND-BACK')) return 'warning';
  return 'default';
}

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

type LoanCellProps = { leadId: number };

function LoanCells({ leadId }: LoanCellProps) {
  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', leadId],
    queryFn: () => getLoan(leadId),
  });

  if (isLoading) return <Spinner size='sm' className='text-primary' />;
  if (!loan) return <span className='text-foreground/40'>No loan</span>;

  return (
    <div className='flex items-center gap-2'>
      <span className='font-mono text-xs'>{loan.loanNumber ?? '—'}</span>
      <Badge variant={loanStatusVariant(loan.status)}>{loan.status}</Badge>
    </div>
  );
}

function OutstandingCell({ leadId }: LoanCellProps) {
  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', leadId],
    queryFn: () => getLoan(leadId),
  });

  if (isLoading) return null;
  return (
    <span className='font-mono'>{formatCurrency(loan?.totalOutstanding)}</span>
  );
}

function LoansPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const hasDs1Role = Boolean(user?.roles.includes('DS1'));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadStatusId, setLeadStatusId] = useState<string>(ALL);
  const [myQueue, setMyQueue] = useState(false);
  const [queueDefaultApplied, setQueueDefaultApplied] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (user && !queueDefaultApplied) {
      setMyQueue(hasDs1Role);
      setQueueDefaultApplied(true);
    }
  }, [user, queueDefaultApplied, hasDs1Role]);

  const { data: allStatuses } = useQuery({
    queryKey: ['master-statuses'],
    queryFn: () => listMasterStatuses(),
  });

  const disbursalStatuses = (allStatuses ?? [])
    .filter((status) => DISBURSAL_STAGE_CODES.includes(status.stageCode))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  useEffect(() => {
    if (
      queueDefaultApplied &&
      !myQueue &&
      leadStatusId === ALL &&
      disbursalStatuses.length > 0
    ) {
      setLeadStatusId(String(disbursalStatuses[0].id));
    }
  }, [queueDefaultApplied, myQueue, leadStatusId, disbursalStatuses]);

  const canQuery = myQueue || leadStatusId !== ALL;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['loans-queue', { page, search, leadStatusId, myQueue }],
    queryFn: () => {
      const params = {
        page,
        limit,
        search: search || undefined,
        leadStatusId: leadStatusId === ALL ? undefined : Number(leadStatusId),
      };
      return myQueue ? listLeadsQueue(params) : listLeads(params);
    },
    enabled: canQuery,
    placeholderData: (previous) => previous,
  });

  const leads = (data?.data ?? []).filter((lead) =>
    lead.leadStatus
      ? DISBURSAL_STAGE_CODES.includes(lead.leadStatus.stageCode)
      : false,
  );

  useQueries({
    queries: leads.map((lead) => ({
      queryKey: ['loan', lead.id],
      queryFn: () => getLoan(lead.id),
    })),
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
      accessorKey: 'leadStatus',
      header: 'Lead status',
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
      id: 'loan',
      header: 'Loan',
      cell: ({ row }) => <LoanCells leadId={row.original.id} />,
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      cell: ({ row }) => <OutstandingCell leadId={row.original.id} />,
    },
  ];

  return (
    <>
      <div>
        <h1 className='font-display font-semibold text-2xl text-primary'>
          Loans
        </h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} lead${data.total === 1 ? '' : 's'} in the disbursal pipeline`
            : 'Loading…'}
        </p>
      </div>

      <div
        className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-white p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {hasDs1Role && (
          <div className='flex overflow-hidden rounded-md border border-border'>
            <button
              type='button'
              onClick={() => {
                setMyQueue(true);
                setLeadStatusId(ALL);
                setPage(1);
              }}
              className={`px-3 py-2 text-sm transition-colors ${
                myQueue
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/70 hover:bg-muted'
              }`}
            >
              My queue
            </button>
            <button
              type='button'
              onClick={() => {
                setMyQueue(false);
                setPage(1);
              }}
              className={`px-3 py-2 text-sm transition-colors ${
                !myQueue
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/70 hover:bg-muted'
              }`}
            >
              All disbursal leads
            </button>
          </div>
        )}
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
            <SelectValue placeholder='Select stage' />
          </SelectTrigger>
          <SelectContent>
            {myQueue && (
              <SelectItem value={ALL}>All disbursal stages</SelectItem>
            )}
            {disbursalStatuses.map((status) => (
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
        {isLoading || !canQuery ? (
          <div className='flex h-40 items-center justify-center'>
            <Spinner className='text-primary' />
          </div>
        ) : isError ? (
          <p className='py-10 text-center text-destructive text-sm'>
            Couldn't load loans. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={leads}
            emptyMessage='No leads in the disbursal pipeline match these filters.'
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
