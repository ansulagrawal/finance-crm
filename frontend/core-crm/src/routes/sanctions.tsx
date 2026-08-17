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
import {
  BRE_DECISION_LABEL,
  type BreDecisionOrNone,
  listBreResults,
} from '@/lib/bre';
import { CAM_STATUS_LABEL, type CamStatus, getCam } from '@/lib/cam';
import { type Lead, listLeads, listLeadsQueue } from '@/lib/leads';
import { listMasterStatuses, type MasterStatus } from '@/lib/lookups';

export const Route = createFileRoute('/sanctions')({
  component: SanctionsPage,
});

const ALL = 'all';

/** Stage codes covering the BRE-evaluation/CAM-decision part of the CR2
 * queue scope (`QUEUE_ROLE_SCOPES.CR2` in core-api's leads.service.ts):
 * S4 new/unclaimed, S5 in-process, S6 hold, S9 reject, S10 recommended,
 * S11 send-back, S12 sanction. CR2's remaining stage codes (S14, S21)
 * belong to disbursal/collections, already owned by those pages, so left
 * out here. Kept in sync manually, same convention as
 * `loans.tsx`/`collections.tsx`. */
const CAM_STAGE_CODES = ['S4', 'S5', 'S6', 'S9', 'S10', 'S11', 'S12'];

const CAM_STATUS_VARIANT: Record<CamStatus, 'muted' | 'success'> = {
  0: 'muted',
  1: 'success',
};

function statusBadgeVariant(
  status: MasterStatus | null,
): 'muted' | 'default' | 'success' | 'destructive' | 'warning' {
  if (!status) return 'muted';
  const name = status.name;
  if (name.includes('REJECT') || name.includes('CANCEL')) return 'destructive';
  if (name.includes('SANCTION')) return 'success';
  if (name.includes('HOLD') || name.includes('SEND-BACK')) return 'warning';
  return 'default';
}

type RowProps = { leadId: number };

function CamCell({ leadId }: RowProps) {
  const { data: cam, isLoading } = useQuery({
    queryKey: ['cam', leadId],
    queryFn: () => getCam(leadId),
  });

  if (isLoading) return <Spinner size='sm' className='text-primary' />;
  if (!cam || cam.status === null) {
    return <span className='text-foreground/40'>No CAM</span>;
  }

  return (
    <Badge variant={CAM_STATUS_VARIANT[cam.status]}>
      {CAM_STATUS_LABEL[cam.status]}
    </Badge>
  );
}

/** Worst-case decision across a lead's BRE rule results, preferring each
 * rule's manual override over its system decision — same precedence as
 * `BreResultsSection` on the lead detail page. REJECT(3) beats REFER(2)
 * beats APPROVE(1)/no-decision(0), so one rejected rule surfaces even if
 * others passed. */
function overallBreDecision(
  results: {
    systemDecision: BreDecisionOrNone;
    manualDecision: BreDecisionOrNone;
  }[],
): BreDecisionOrNone | null {
  if (results.length === 0) return null;
  const effective = results.map((r) => r.manualDecision || r.systemDecision);
  if (effective.includes(3)) return 3;
  if (effective.includes(2)) return 2;
  if (effective.includes(1)) return 1;
  return 0;
}

const BRE_DECISION_VARIANT: Record<
  BreDecisionOrNone,
  'muted' | 'success' | 'warning' | 'destructive'
> = {
  0: 'muted',
  1: 'success',
  2: 'warning',
  3: 'destructive',
};

function BreCell({ leadId }: RowProps) {
  const { data: results, isLoading } = useQuery({
    queryKey: ['bre-results', leadId],
    queryFn: () => listBreResults(leadId),
  });

  if (isLoading) return <Spinner size='sm' className='text-primary' />;
  const decision = overallBreDecision(results ?? []);
  if (decision === null) {
    return <span className='text-foreground/40'>No BRE run</span>;
  }

  return (
    <Badge variant={BRE_DECISION_VARIANT[decision]}>
      {BRE_DECISION_LABEL[decision]}
    </Badge>
  );
}

function SanctionsPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const hasCr2Role = Boolean(user?.roles.includes('CR2'));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadStatusId, setLeadStatusId] = useState<string>(ALL);
  const [myQueue, setMyQueue] = useState(false);
  const [queueDefaultApplied, setQueueDefaultApplied] = useState(false);
  const limit = 20;

  useEffect(() => {
    if (user && !queueDefaultApplied) {
      setMyQueue(hasCr2Role);
      setQueueDefaultApplied(true);
    }
  }, [user, queueDefaultApplied, hasCr2Role]);

  const { data: allStatuses } = useQuery({
    queryKey: ['master-statuses'],
    queryFn: () => listMasterStatuses(),
  });

  const camStatuses = (allStatuses ?? [])
    .filter((status) => CAM_STAGE_CODES.includes(status.stageCode))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Same reasoning as `loans.tsx`: the "all" view has no role-based stage
  // scoping server-side, so browsing outside "My queue" requires picking
  // one of the CAM stages rather than seeing all of them unfiltered.
  useEffect(() => {
    if (
      queueDefaultApplied &&
      !myQueue &&
      leadStatusId === ALL &&
      camStatuses.length > 0
    ) {
      setLeadStatusId(String(camStatuses[0].id));
    }
  }, [queueDefaultApplied, myQueue, leadStatusId, camStatuses]);

  const canQuery = myQueue || leadStatusId !== ALL;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sanctions-queue', { page, search, leadStatusId, myQueue }],
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

  // `listLeadsQueue` unions every role the acting user holds — filter to
  // the CAM stage codes client-side so a user who also holds, say, DS1
  // doesn't see disbursal leads mixed into this queue.
  const leads = (data?.data ?? []).filter((lead) =>
    lead.leadStatus
      ? CAM_STAGE_CODES.includes(lead.leadStatus.stageCode)
      : false,
  );

  // Warm the per-row CAM/BRE caches in parallel so columns don't populate
  // one row at a time.
  useQueries({
    queries: leads.flatMap((lead) => [
      { queryKey: ['cam', lead.id], queryFn: () => getCam(lead.id) },
      {
        queryKey: ['bre-results', lead.id],
        queryFn: () => listBreResults(lead.id),
      },
    ]),
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
      id: 'bre',
      header: 'BRE result',
      cell: ({ row }) => <BreCell leadId={row.original.id} />,
    },
    {
      id: 'cam',
      header: 'CAM',
      cell: ({ row }) => <CamCell leadId={row.original.id} />,
    },
  ];

  return (
    <>
      <div>
        <h1 className='font-semibold text-2xl text-primary'>Sanctions</h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} lead${data.total === 1 ? '' : 's'} in BRE evaluation / CAM decision`
            : 'Loading…'}
        </p>
      </div>

      <div
        className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {hasCr2Role && (
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
              All sanctions leads
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
            {myQueue && <SelectItem value={ALL}>All CAM stages</SelectItem>}
            {camStatuses.map((status) => (
              <SelectItem key={status.id} value={String(status.id)}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className='animate-fade-in-up rounded-lg border border-border bg-background p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {isLoading || !canQuery ? (
          <div className='flex h-40 items-center justify-center'>
            <Spinner className='text-primary' />
          </div>
        ) : isError ? (
          <p className='py-10 text-center text-destructive text-sm'>
            Couldn't load the sanctions queue. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={leads}
            emptyMessage='No leads in BRE evaluation / CAM decision match these filters.'
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
