import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  type AuditQueueLead,
  type AuditQueueStage,
  allocateAudit,
  listAuditQueue,
  sendToPostAudit,
  sendToPreAudit,
} from '@/lib/audit';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/audit')({
  component: AuditPage,
});

const ALL = 'all';
const STAGES: AuditQueueStage[] = [
  'AUDIT-NEW',
  'AUDIT-INPROCESS',
  'AUDIT-HOLD',
  'AUDIT-RECOMMENDED',
];

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function AuditPage() {
  const navigate = useNavigate();
  const canAllocate = useHasRole('AM', 'AH');
  const canAct = useHasRole('AU', 'AM', 'AH');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState<AuditQueueStage | typeof ALL>(ALL);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-queue', { page, stage }],
    queryFn: () =>
      listAuditQueue({
        page,
        limit,
        stage: stage === ALL ? undefined : stage,
      }),
    placeholderData: (previous) => previous,
  });

  const allocateMutation = useMutation({
    mutationFn: () => allocateAudit(Array.from(selected)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-queue'] });
      setSelected(new Set());
      toast({ title: 'Leads allocated' });
    },
    onError: (error) => {
      toast({
        title: 'Could not allocate leads',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  function invalidateAfterAuditAction(leadId: number) {
    queryClient.invalidateQueries({ queryKey: ['audit-queue'] });
    queryClient.invalidateQueries({ queryKey: ['audit-history', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
  }

  const sendToPreMutation = useMutation({
    mutationFn: (leadId: number) => sendToPreAudit(leadId),
    onSuccess: (_, leadId) => {
      invalidateAfterAuditAction(leadId);
      toast({ title: 'Sent to pre-audit' });
    },
    onError: (error) => {
      toast({
        title: 'Could not send to pre-audit',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const sendToPostMutation = useMutation({
    mutationFn: (leadId: number) => sendToPostAudit(leadId),
    onSuccess: (_, leadId) => {
      invalidateAfterAuditAction(leadId);
      toast({ title: 'Sent to post-audit' });
    },
    onError: (error) => {
      toast({
        title: 'Could not send to post-audit',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columns: ColumnDef<AuditQueueLead>[] = [
    ...(canAllocate
      ? ([
          {
            id: 'select',
            header: '',
            cell: ({ row }) => (
              <input
                type='checkbox'
                checked={selected.has(row.original.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleSelected(row.original.id)}
                aria-label={`Select lead ${row.original.id}`}
              />
            ),
          },
        ] as ColumnDef<AuditQueueLead>[])
      : []),
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
        const status = getValue<AuditQueueLead['leadStatus']>();
        return <Badge variant='default'>{status?.name ?? 'Unknown'}</Badge>;
      },
    },
    {
      accessorKey: 'auditAssignedTo',
      header: 'Assigned to',
      cell: ({ getValue }) =>
        getValue<AuditQueueLead['auditAssignedTo']>()?.name ?? 'Unassigned',
    },
    ...(canAct
      ? ([
          {
            id: 'auditActions',
            header: 'Actions',
            cell: ({ row }) => (
              <div className='flex items-center gap-1'>
                <Button
                  type='secondary'
                  size='sm'
                  htmlType='button'
                  disabled={
                    sendToPreMutation.isPending &&
                    sendToPreMutation.variables === row.original.id
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    sendToPreMutation.mutate(row.original.id);
                  }}
                >
                  Pre-audit
                </Button>
                <Button
                  type='secondary'
                  size='sm'
                  htmlType='button'
                  disabled={
                    sendToPostMutation.isPending &&
                    sendToPostMutation.variables === row.original.id
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    sendToPostMutation.mutate(row.original.id);
                  }}
                >
                  Post-audit
                </Button>
              </div>
            ),
          },
        ] as ColumnDef<AuditQueueLead>[])
      : []),
  ];

  return (
    <>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-display font-semibold text-2xl text-primary'>
            Audit queue
          </h1>
          <p className='text-foreground/60 text-sm'>
            {data
              ? `${data.total} lead${data.total === 1 ? '' : 's'}`
              : 'Loading…'}
          </p>
        </div>
        {canAllocate && selected.size > 0 && (
          <Button
            type='primary'
            disabled={allocateMutation.isPending}
            onClick={() => allocateMutation.mutate()}
          >
            {allocateMutation.isPending ? (
              <Spinner size='sm' />
            ) : (
              `Allocate ${selected.size} to me`
            )}
          </Button>
        )}
      </div>

      <div
        className='flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <button
          type='button'
          onClick={() => {
            setStage(ALL);
            setPage(1);
          }}
          className={`rounded-md px-3 py-2 text-sm transition-colors ${
            stage === ALL
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/70 hover:bg-muted'
          }`}
        >
          All stages
        </button>
        {STAGES.map((s) => (
          <button
            key={s}
            type='button'
            onClick={() => {
              setStage(s);
              setPage(1);
            }}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              stage === s
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/70 hover:bg-muted'
            }`}
          >
            {s}
          </button>
        ))}
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
            Couldn't load the audit queue. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            emptyMessage='No leads in this stage.'
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
      <p className='text-foreground/50 text-xs'>
        Send to pre-audit / post-audit are row actions above. Other per-lead
        audit actions (hold, recommend, send back, approval reason) live on that
        lead's detail page, in its Audit section — click a row to open it.
      </p>
    </>
  );
}
