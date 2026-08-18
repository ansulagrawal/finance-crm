import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
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
import {
  type FieldVerificationTrack,
  type FieldVerificationVisit,
  listFieldVerificationQueue,
} from '@/lib/field-verification';

export const Route = createFileRoute('/field-verification')({
  component: FieldVerificationPage,
});

const ALL = 'all';

function trackBadgeVariant(
  initiated: 'YES' | 'NO' | null,
  reportStatus: '1' | '2' | '3' | null,
): 'muted' | 'success' | 'destructive' | 'warning' {
  if (initiated !== 'YES') return 'muted';
  if (reportStatus === '2') return 'success';
  if (reportStatus === '3') return 'destructive';
  return 'warning';
}

function trackLabel(
  initiated: 'YES' | 'NO' | null,
  reportStatus: '1' | '2' | '3' | null,
): string {
  if (initiated !== 'YES') return 'Not initiated';
  if (reportStatus === '2') return 'Positive';
  if (reportStatus === '3') return 'Negative';
  return 'Pending';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function FieldVerificationPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [track, setTrack] = useState<string>(ALL);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['field-verification-queue', { page, track }],
    queryFn: () =>
      listFieldVerificationQueue({
        page,
        limit,
        track: track === ALL ? undefined : (track as FieldVerificationTrack),
      }),
    placeholderData: (previous) => previous,
  });

  const columns: ColumnDef<FieldVerificationVisit>[] = [
    {
      id: 'leadId',
      header: 'Lead ID',
      cell: ({ row }) => (
        <span className='font-mono text-xs'>#{row.original.lead.id}</span>
      ),
    },
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => row.original.lead.firstName,
    },
    {
      id: 'mobile',
      header: 'Mobile',
      cell: ({ row }) => row.original.lead.mobile,
    },
    {
      id: 'residence',
      header: 'Residence',
      cell: ({ row }) => (
        <Badge
          variant={trackBadgeVariant(
            row.original.residenceCpvInitiated,
            row.original.residenceReportStatus,
          )}
        >
          {trackLabel(
            row.original.residenceCpvInitiated,
            row.original.residenceReportStatus,
          )}
        </Badge>
      ),
    },
    {
      id: 'office',
      header: 'Office',
      cell: ({ row }) => (
        <Badge
          variant={trackBadgeVariant(
            row.original.officeCpvInitiated,
            row.original.officeReportStatus,
          )}
        >
          {trackLabel(
            row.original.officeCpvInitiated,
            row.original.officeReportStatus,
          )}
        </Badge>
      ),
    },
    {
      id: 'requestedBy',
      header: 'Requested by',
      cell: ({ row }) => row.original.visitRequestedBy?.name ?? '—',
    },
    {
      id: 'requestedOn',
      header: 'Requested on',
      cell: ({ row }) => (
        <span className='text-foreground/60 text-xs'>
          {formatDate(row.original.visitRequestedOn)}
        </span>
      ),
    },
  ];

  return (
    <>
      <div>
        <h1 className='font-semibold text-2xl text-primary'>
          Field Verification
        </h1>
        <p className='text-foreground/60 text-sm'>
          {data
            ? `${data.total} verification${data.total === 1 ? '' : 's'}`
            : 'Loading…'}
        </p>
      </div>

      <div
        className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Select
          value={track}
          onValueChange={(value) => {
            setTrack(value);
            setPage(1);
          }}
        >
          <SelectTrigger className='w-56'>
            <SelectValue placeholder='All tracks' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tracks</SelectItem>
            <SelectItem value='RESIDENCE'>Residence</SelectItem>
            <SelectItem value='OFFICE'>Office</SelectItem>
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
            Couldn't load the field verification queue. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            emptyMessage='No field verifications match these filters.'
            onRowClick={(visit) =>
              navigate({
                to: '/leads/$leadId',
                params: { leadId: String(visit.lead.id) },
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
