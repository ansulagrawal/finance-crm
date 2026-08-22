import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  downloadReportCsv,
  REPORT_CATALOG,
  type ReportDefinition,
  type ReportRow,
  type ReportRunParams,
  runReport,
} from '@/lib/reporting';

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});

const ALL_MODULES = 'all';

function onError(error: unknown, title: string) {
  toast({
    title,
    description:
      error instanceof ApiError ? error.message : 'Something went wrong.',
    variant: 'destructive',
  });
}

/** Builds react-table columns from whatever keys the first row has — every
 * report/export here is a raw-SQL read with a report-specific column set,
 * so there's no static shape to type against (see `lib/reporting.ts`). */
function columnsFromRows(rows: ReportRow[]): ColumnDef<ReportRow>[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).map((key) => ({
    accessorKey: key,
    header: key,
    cell: ({ getValue }) => {
      const value = getValue();
      if (value === null || value === undefined) return '—';
      return String(value);
    },
  }));
}

function FilterInputs({
  def,
  params,
  onChange,
}: {
  def: ReportDefinition;
  params: ReportRunParams;
  onChange: (params: ReportRunParams) => void;
}) {
  switch (def.filter) {
    case 'dateRange':
      return (
        <>
          <DatePicker
            aria-label='From date'
            value={params.fromDate ?? ''}
            onChange={(e) => onChange({ ...params, fromDate: e.target.value })}
          />
          <DatePicker
            aria-label='To date'
            value={params.toDate ?? ''}
            onChange={(e) => onChange({ ...params, toDate: e.target.value })}
          />
        </>
      );
    case 'collectionExport':
      return (
        <>
          <DatePicker
            aria-label='From date'
            value={params.fromDate ?? ''}
            onChange={(e) => onChange({ ...params, fromDate: e.target.value })}
          />
          <DatePicker
            aria-label='To date'
            value={params.toDate ?? ''}
            onChange={(e) => onChange({ ...params, toDate: e.target.value })}
          />
          <label
            htmlFor='include-contact-details'
            className='flex items-center gap-2 text-foreground/70 text-sm'
          >
            <Checkbox
              id='include-contact-details'
              checked={params.includeContactDetails ?? false}
              onCheckedChange={(checked) =>
                onChange({ ...params, includeContactDetails: checked === true })
              }
            />
            Include contact details (SA/CA only)
          </label>
        </>
      );
    case 'month':
      return (
        <DatePicker
          aria-label='Any date in target month'
          value={params.month ?? ''}
          onChange={(e) => onChange({ ...params, month: e.target.value })}
        />
      );
    case 'financialYear':
      return (
        <DatePicker
          aria-label='Any date in the financial year'
          value={params.financialYearStart ?? ''}
          onChange={(e) =>
            onChange({ ...params, financialYearStart: e.target.value })
          }
        />
      );
    case 'executiveCollection':
      return (
        <>
          <DatePicker
            aria-label='From date'
            value={params.fromDate ?? ''}
            onChange={(e) => onChange({ ...params, fromDate: e.target.value })}
          />
          <DatePicker
            aria-label='To date'
            value={params.toDate ?? ''}
            onChange={(e) => onChange({ ...params, toDate: e.target.value })}
          />
          <Select
            value={params.typeId ? String(params.typeId) : ''}
            onValueChange={(value) =>
              onChange({ ...params, typeId: Number(value) as 1 | 2 })
            }
          >
            <SelectTrigger className='w-48'>
              <SelectValue placeholder='Date type' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='1'>Actual payment date</SelectItem>
              <SelectItem value='2'>Loan repayment (due) date</SelectItem>
            </SelectContent>
          </Select>
        </>
      );
    case 'fromDate':
      return (
        <DatePicker
          aria-label='From date'
          value={params.fromDate ?? ''}
          onChange={(e) => onChange({ ...params, fromDate: e.target.value })}
        />
      );
    case 'toDate':
      return (
        <DatePicker
          aria-label='To date'
          value={params.toDate ?? ''}
          onChange={(e) => onChange({ ...params, toDate: e.target.value })}
        />
      );
    case 'date':
      return (
        <DatePicker
          aria-label='Date'
          value={params.date ?? ''}
          onChange={(e) => onChange({ ...params, date: e.target.value })}
        />
      );
    case 'none':
      return <span className='text-foreground/50 text-sm'>No filters.</span>;
    default:
      return null;
  }
}

/** Whether the currently-entered filters satisfy `def`'s required params —
 * mirrors each backend DTO's required fields (`class-validator`'s
 * `@IsDateString()` with no `@IsOptional()`). */
function canRun(def: ReportDefinition, params: ReportRunParams): boolean {
  switch (def.filter) {
    case 'dateRange':
    case 'collectionExport':
      return true; // DateRangeQueryDto: both fields optional
    case 'month':
      return !!params.month;
    case 'financialYear':
      return !!params.financialYearStart;
    case 'executiveCollection':
      return !!params.fromDate && !!params.toDate && !!params.typeId;
    case 'fromDate':
      return !!params.fromDate;
    case 'toDate':
      return !!params.toDate;
    case 'date':
      return !!params.date;
    case 'none':
      return true;
    default:
      return true;
  }
}

function ReportRunnerPanel({ def }: { def: ReportDefinition }) {
  const [params, setParams] = useState<ReportRunParams>({});
  const [extraKey, setExtraKey] = useState('');
  const [extraValue, setExtraValue] = useState('');
  const [rows, setRows] = useState<ReportRow[] | null>(null);

  const runMutation = useMutation({
    mutationFn: () => runReport(def, params),
    onSuccess: (data) => setRows(data),
    onError: (error) => onError(error, 'Could not run report'),
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadReportCsv(def, params),
    onSuccess: () => toast({ title: 'CSV download started' }),
    onError: (error) => onError(error, 'Could not export CSV'),
  });

  const columns = useMemo(() => columnsFromRows(rows ?? []), [rows]);
  const runnable = canRun(def, params);

  return (
    <div
      className='flex flex-col gap-4 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h2 className='font-display font-semibold text-lg text-primary'>
            {def.label}
          </h2>
          <p className='text-foreground/50 text-xs'>
            {def.module} &middot;{' '}
            {def.kind === 'report' ? 'MIS report' : 'CSV export'}
            {def.permissionId !== null
              ? ` · permission #${def.permissionId}`
              : ' · ungated'}
          </p>
        </div>
        <Badge variant={def.kind === 'report' ? 'default' : 'muted'}>
          {def.kind}
        </Badge>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <FilterInputs def={def} params={params} onChange={setParams} />
        <Input
          placeholder='Extra param name'
          value={extraKey}
          onChange={(e) => setExtraKey(e.target.value)}
          className='w-40'
        />
        <Input
          placeholder='Extra param value'
          value={extraValue}
          onChange={(e) => setExtraValue(e.target.value)}
          className='w-40'
        />
        <Button
          type='ghost'
          size='sm'
          disabled={!extraKey.trim() || !extraValue.trim()}
          onClick={() => {
            setParams((p) => ({
              ...p,
              extra: { ...p.extra, [extraKey.trim()]: extraValue.trim() },
            }));
            setExtraKey('');
            setExtraValue('');
          }}
        >
          Add filter
        </Button>
        {params.extra &&
          Object.entries(params.extra).map(([key, value]) => (
            <Badge key={key} variant='muted'>
              {key}={value}
            </Badge>
          ))}
      </div>

      <div className='flex gap-2'>
        {def.kind === 'report' && (
          <Button
            type='primary'
            size='sm'
            disabled={!runnable || runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            <Play className='mr-1 size-4' />
            Run
          </Button>
        )}
        <Button
          type='secondary'
          size='sm'
          disabled={!runnable || downloadMutation.isPending}
          onClick={() => downloadMutation.mutate()}
        >
          <Download className='mr-1 size-4' />
          Download CSV
        </Button>
      </div>

      {runMutation.isPending && (
        <div className='flex h-32 items-center justify-center'>
          <Spinner className='text-primary' />
        </div>
      )}

      {rows && !runMutation.isPending && (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage='This report returned no rows for the given filters.'
        />
      )}
    </div>
  );
}

function ReportPicker({
  selected,
  onSelect,
}: {
  selected: ReportDefinition | null;
  onSelect: (def: ReportDefinition) => void;
}) {
  const [search, setSearch] = useState('');
  const [module, setModule] = useState(ALL_MODULES);
  const [kind, setKind] = useState<'all' | 'report' | 'export'>('all');

  const modules = useMemo(
    () => Array.from(new Set(REPORT_CATALOG.map((d) => d.module))).sort(),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return REPORT_CATALOG.filter((d) => {
      if (module !== ALL_MODULES && d.module !== module) return false;
      if (kind !== 'all' && d.kind !== kind) return false;
      if (q && !d.label.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, module, kind]);

  return (
    <div className='flex w-80 shrink-0 flex-col gap-3'>
      <Input
        placeholder='Search reports…'
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className='flex gap-2'>
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger className='flex-1'>
            <SelectValue placeholder='Module' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MODULES}>All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={kind}
          onValueChange={(value) => setKind(value as typeof kind)}
        >
          <SelectTrigger className='w-32'>
            <SelectValue placeholder='Kind' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All kinds</SelectItem>
            <SelectItem value='report'>Reports</SelectItem>
            <SelectItem value='export'>Exports</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className='flex max-h-[70vh] flex-col divide-y divide-border/60 overflow-y-auto rounded-lg border border-border bg-white'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {filtered.length === 0 ? (
          <p className='p-4 text-center text-foreground/50 text-sm'>
            No reports match.
          </p>
        ) : (
          filtered.map((d) => (
            <button
              key={d.key}
              type='button'
              onClick={() => onSelect(d)}
              className={`flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                selected?.key === d.key ? 'bg-muted' : ''
              }`}
            >
              <span>
                <span className='block'>{d.label}</span>
                <span className='text-foreground/50 text-xs'>{d.module}</span>
              </span>
              <Badge variant={d.kind === 'report' ? 'default' : 'muted'}>
                {d.kind}
              </Badge>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// reporting-api has no catalog endpoint to list reports from (confirmed:
// `docs/TODO.md`'s "Menu/Permissions export/MIS picker" item), so
// `REPORT_CATALOG` in `lib/reporting.ts` is a hand-built static list of
// every controller method found in the backend, not a live-fetched catalog.
function ReportsPage() {
  const [selected, setSelected] = useState<ReportDefinition | null>(null);

  return (
    <>
      <div>
        <h1 className='font-display font-semibold text-2xl text-primary'>
          MIS Reports
        </h1>
        <p className='text-foreground/60 text-sm'>
          {REPORT_CATALOG.length} reports/exports from reporting-api. Access to
          each is gated by the legacy MIS/export permission model — SA/CA can
          run everything, other roles need a grant from{' '}
          <span className='font-medium'>Menu &amp; Permissions</span>.
        </p>
      </div>

      <div className='flex gap-6'>
        <ReportPicker selected={selected} onSelect={setSelected} />
        <div className='flex-1'>
          {selected ? (
            <ReportRunnerPanel key={selected.key} def={selected} />
          ) : (
            <div className='flex h-40 items-center justify-center rounded-lg border border-border border-dashed text-foreground/50 text-sm'>
              Select a report from the list to run it.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
