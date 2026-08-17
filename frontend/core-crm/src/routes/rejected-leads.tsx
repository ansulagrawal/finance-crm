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
import { type Lead, listLeads } from '@/lib/leads';
import { listMasterStatuses, listRejectionReasons } from '@/lib/lookups';

export const Route = createFileRoute('/rejected-leads')({
  component: RejectedLeadsPage,
});

const ALL = 'all';

/** Stage codes representing a rejected lead — `S8` (SYSTEM-REJECT, an
 * automated rejection e.g. duplicate/blacklist) and `S9` (REJECT, a manual
 * screener/credit rejection). Neither is scoped to a single role in
 * `QUEUE_ROLE_SCOPES` (core-api's leads.service.ts) — `S9` appears in both
 * CR1 and CR2 — so this is a cross-role filter view over `GET /leads`
 * rather than a role-scoped `/leads/queue` page, unlike sanctions/loans/
 * collections. Kept in sync manually, same convention as those pages. */
const REJECTED_STAGE_CODES = ['S8', 'S9'];

function RejectedLeadsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadStatusId, setLeadStatusId] = useState<string>(ALL);
  const [rejectionReasonId, setRejectionReasonId] = useState<string>(ALL);
  const limit = 20;

  const { data: allStatuses } = useQuery({
    queryKey: ['master-statuses'],
    queryFn: () => listMasterStatuses(),
  });

  const { data: rejectionReasons } = useQuery({
    queryKey: ['rejection-reasons'],
    queryFn: listRejectionReasons,
  });

  const rejectedStatuses = (allStatuses ?? [])
    .filter((status) => REJECTED_STAGE_CODES.includes(status.stageCode))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'rejected-leads',
      { page, search, leadStatusId, rejectionReasonId },
    ],
    queryFn: () =>
      listLeads({
        page,
        limit,
        search: search || undefined,
        stageCode: REJECTED_STAGE_CODES.join(','),
        leadStatusId: leadStatusId === ALL ? undefined : Number(leadStatusId),
        rejectionReasonId:
          rejectionReasonId === ALL ? undefined : Number(rejectionReasonId),
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
      accessorKey: 'leadStatus',
      header: 'Lead status',
      cell: ({ getValue }) => {
        const status = getValue<Lead['leadStatus']>();
        return <Badge variant='destructive'>{status?.name ?? 'Unknown'}</Badge>;
      },
    },
    {
      accessorKey: 'rejectionReason',
      header: 'Rejection reason',
      cell: ({ getValue }) => {
        const reason = getValue<Lead['rejectionReason']>();
        return reason ? (
          reason.reason
        ) : (
          <span className='text-foreground/40'>—</span>
        );
      },
    },
  ];

  return (
    <>
      <div>
        <h1 className='font-semibold text-2xl text-primary'>Rejected leads</h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} rejected lead${data.total === 1 ? '' : 's'}`
            : 'Loading…'}
        </p>
      </div>

      <div
        className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4'
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
            <SelectValue placeholder='Select stage' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All rejection stages</SelectItem>
            {rejectedStatuses.map((status) => (
              <SelectItem key={status.id} value={String(status.id)}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={rejectionReasonId}
          onValueChange={(value) => {
            setRejectionReasonId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-56'>
            <SelectValue placeholder='Select reason' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All reasons</SelectItem>
            {(rejectionReasons ?? []).map((reason) => (
              <SelectItem key={reason.id} value={String(reason.id)}>
                {reason.reason}
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
            Couldn't load rejected leads. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={leads}
            emptyMessage='No rejected leads match these filters.'
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
