import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  CustomerSection,
  EmploymentSection,
  ReferencesSection,
} from '@/components/lead-sections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from '@/components/ui/modal';
import { NumberInput } from '@/components/ui/number-input';
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
import { useCurrentUser } from '@/lib/auth';
import { listBlacklistedPincodes } from '@/lib/company-geography';
import {
  type CreateLeadInput,
  createLead,
  downloadLeadImportSampleCsv,
  importLeadsCsv,
  type Lead,
  type LeadAssignmentStage,
  type LeadImportRowResult,
  listLeads,
  listLeadsQueue,
  selfAllocateLeads,
} from '@/lib/leads';
import {
  type Company,
  listCompanies,
  listMasterStatuses,
  listProducts,
  type MasterStatus,
} from '@/lib/lookups';
import { search } from '@/lib/search';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: LeadsPage,
});

const ALL = 'all';

/** Roles with a defined queue on the backend (`QUEUE_ROLE_SCOPES` in
 * core-api's leads.service.ts) — kept in sync manually, mirrors the
 * backend's role table rather than re-deriving the stage logic
 * client-side. */
const QUEUE_ROLES = ['CR1', 'CR2', 'CO1', 'CO3', 'DS1'];

/** Roles that can self-allocate (`POST /leads/self-allocate`,
 * `SELF_ALLOCATE_RULES` in core-api's leads.service.ts) — a subset of
 * `QUEUE_ROLES`: CO1/CO3 have a queue view but no self-allocate rule
 * defined backend-side. First matching role wins if a user somehow holds
 * more than one. */
const SELF_ALLOCATE_STAGE_BY_ROLE: Record<string, LeadAssignmentStage> = {
  CR1: 'SCREENER',
  CR2: 'CREDIT',
  DS1: 'DISBURSAL',
  DS2: 'DISBURSAL',
};

/** Bulk CSV import is gated `SA`/`CA` on the backend
 * (`@Roles('SA', 'CA')` on `LeadImportController`) — mirrored here so the
 * button doesn't invite a 403. */
const IMPORT_ROLES = ['SA', 'CA'];

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
  if (
    name.includes('DISBURSED') ||
    name === 'SANCTION' ||
    name === 'CLOSED' ||
    name === 'SETTLED'
  ) {
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

/** Step 1 of the lead intake wizard: creates the lead itself (`POST
 * /leads`). Subsequent wizard steps (`LeadIntakeWizard`) attach
 * customer/employment/reference data to the id this returns via their own
 * separate `PUT`/`POST` calls — there's no atomic multi-step transaction on
 * the backend, so once this step succeeds the lead already exists even if
 * a later step is abandoned. */
function LeadBasicsStep({ onCreated }: { onCreated: (lead: Lead) => void }) {
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [mobileToCheck, setMobileToCheck] = useState('');
  const [pincodeToCheck, setPincodeToCheck] = useState('');

  const { data: companies } = useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
  });
  const { data: products } = useQuery({
    queryKey: ['products', companyId],
    queryFn: () => listProducts(companyId as number),
    enabled: companyId !== undefined,
  });

  // Duplicate-lead detection: a soft warning here, not a hard block. Legacy
  // *does* hard-block same-day PAN/mobile/email repeats, but server-side and
  // later in the flow (LeadEligibilityService.hasSameDayDuplicate(), run
  // right after creation) — same architecture as legacy, whose intake form
  // doesn't block either. This pre-submission check is just an earlier,
  // softer heads-up for the agent on top of that real enforcement.
  const { data: duplicateMatches } = useQuery({
    queryKey: ['search', mobileToCheck],
    queryFn: () => search(mobileToCheck),
    enabled: /^\d{10}$/.test(mobileToCheck),
  });

  // Blacklist check at intake — same soft-warning treatment.
  const { data: blacklistedPincodes } = useQuery({
    queryKey: ['blacklisted-pincodes'],
    queryFn: listBlacklistedPincodes,
  });
  const isPincodeBlacklisted = blacklistedPincodes?.some(
    (bp) => bp.pincode === pincodeToCheck,
  );

  const mutation = useMutation({
    mutationFn: (dto: CreateLeadInput) => createLead(dto),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({
        title: 'Lead created',
        description: `${lead.firstName} was added.`,
      });
      onCreated(lead);
    },
    onError: (error) => {
      toast({
        title: 'Could not create lead',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      firstName: '',
      mobile: '',
      email: '',
      pancard: '',
      loanAmount: 15000,
      tenureDays: 90,
      purpose: '',
      companyId: undefined as number | undefined,
      productId: undefined as number | undefined,
      pincode: '',
    },
    onSubmit: ({ value }) => {
      mutation.mutate({
        firstName: value.firstName,
        mobile: value.mobile,
        email: value.email || undefined,
        pancard: value.pancard || undefined,
        loanAmount: value.loanAmount,
        tenureDays: value.tenureDays,
        purpose: value.purpose || undefined,
        companyId: value.companyId,
        productId: value.productId,
        pincode: value.pincode || undefined,
      });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className='flex flex-col gap-3'
    >
      <form.Field
        name='firstName'
        validators={{
          onChange: ({ value }) => (!value ? 'Name is required' : undefined),
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Full name</Label>
            <Input
              id={field.name}
              placeholder='Full name'
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            {field.state.meta.errors.length > 0 && (
              <span className='text-destructive text-xs'>
                {field.state.meta.errors.join(', ')}
              </span>
            )}
          </div>
        )}
      </form.Field>

      <form.Field
        name='mobile'
        validators={{
          onChange: ({ value }) =>
            !/^\d{10}$/.test(value)
              ? '10-digit mobile number required'
              : undefined,
        }}
      >
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Mobile</Label>
            <Input
              id={field.name}
              placeholder='9876543210'
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
                setMobileToCheck(event.target.value);
              }}
            />
            {field.state.meta.errors.length > 0 && (
              <span className='text-destructive text-xs'>
                {field.state.meta.errors.join(', ')}
              </span>
            )}
            {duplicateMatches && duplicateMatches.leads.length > 0 && (
              <span className='text-warning text-xs'>
                {duplicateMatches.leads.length} existing lead
                {duplicateMatches.leads.length === 1 ? '' : 's'} already use
                this mobile number — check for a duplicate before saving.
              </span>
            )}
          </div>
        )}
      </form.Field>

      <div className='grid grid-cols-2 gap-3'>
        <form.Field name='email'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>Email</Label>
              <Input
                id={field.name}
                type='email'
                placeholder='name@example.com'
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Field name='pancard'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>PAN</Label>
              <Input
                id={field.name}
                placeholder='ABCDE1234F'
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(event.target.value.toUpperCase())
                }
              />
            </div>
          )}
        </form.Field>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <form.Field
          name='loanAmount'
          validators={{
            onChange: ({ value }) =>
              value < 1000 ? 'Minimum amount is ₹1,000' : undefined,
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>Amount</Label>
              <NumberInput
                id={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                min={1000}
                max={100000}
                step={1000}
              />
            </div>
          )}
        </form.Field>

        <form.Field name='tenureDays'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>Tenure (days)</Label>
              <NumberInput
                id={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                min={7}
                max={365}
                step={1}
              />
            </div>
          )}
        </form.Field>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <form.Field
          name='companyId'
          validators={{
            onChange: ({ value }) =>
              value == null ? 'Company is required' : undefined,
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>Company</Label>
              <Select
                value={
                  field.state.value ? String(field.state.value) : undefined
                }
                onValueChange={(value) => {
                  const id = Number(value);
                  field.handleChange(id);
                  setCompanyId(id);
                }}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue placeholder='Select company' />
                </SelectTrigger>
                <SelectContent>
                  {companies?.map((company: Company) => (
                    <SelectItem key={company.id} value={String(company.id)}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>

        <form.Field
          name='productId'
          validators={{
            onChange: ({ value }) =>
              value == null ? 'Product is required' : undefined,
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label htmlFor={field.name}>Product</Label>
              <Select
                value={
                  field.state.value ? String(field.state.value) : undefined
                }
                onValueChange={(value) => field.handleChange(Number(value))}
                disabled={!companyId}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue placeholder='Select product' />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name='pincode'>
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label htmlFor={field.name}>Pincode</Label>
            <Input
              id={field.name}
              placeholder='400001'
              value={field.state.value}
              onChange={(event) => {
                field.handleChange(event.target.value);
                setPincodeToCheck(event.target.value);
              }}
            />
            {isPincodeBlacklisted && (
              <span className='text-destructive text-xs'>
                This pincode is blacklisted — confirm before proceeding.
              </span>
            )}
          </div>
        )}
      </form.Field>

      <ModalFooter>
        <ModalClose asChild>
          <Button type='secondary' htmlType='button'>
            Cancel
          </Button>
        </ModalClose>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type='primary'
              htmlType='submit'
              disabled={!canSubmit || mutation.isPending}
            >
              {mutation.isPending ? <Spinner size='sm' /> : 'Create & continue'}
            </Button>
          )}
        </form.Subscribe>
      </ModalFooter>
    </form>
  );
}

const WIZARD_STEP_LABELS = [
  'Lead details',
  'Customer (KYC)',
  'Employment',
  'References',
] as const;

type WizardStep = 0 | 1 | 2 | 3;

function WizardStepper({ step }: { step: WizardStep }) {
  return (
    <div className='mb-4 flex items-center'>
      {WIZARD_STEP_LABELS.map((label, index) => (
        <div key={label} className='flex flex-1 items-center last:flex-none'>
          <div className='flex items-center gap-2'>
            <div
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full font-medium text-xs',
                index < step
                  ? 'bg-primary text-primary-foreground'
                  : index === step
                    ? 'border-2 border-primary text-primary'
                    : 'border border-border text-foreground/40',
              )}
            >
              {index < step ? <Check className='size-3.5' /> : index + 1}
            </div>
            <span
              className={cn(
                'whitespace-nowrap text-xs',
                index === step
                  ? 'font-medium text-foreground'
                  : 'text-foreground/50',
              )}
            >
              {label}
            </span>
          </div>
          {index < WIZARD_STEP_LABELS.length - 1 && (
            <div
              className={cn(
                'mx-3 h-px flex-1',
                index < step ? 'bg-primary' : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Multi-step lead intake: step 1 creates the lead (`LeadBasicsStep`), then
 * steps 2-4 reuse the same section editors the lead detail page uses to
 * edit customer/employment/reference data post-creation
 * (`@/components/lead-sections`) — the backend has no atomic multi-step
 * lead-creation transaction, so once step 1 succeeds the lead already
 * exists and is visible in the leads list even if the wizard is closed
 * before the later steps are filled in. Those remaining sections can
 * always be finished later from the lead's own detail page. */
function LeadIntakeWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<WizardStep>(0);
  const [lead, setLead] = useState<Lead | null>(null);

  return (
    <div className='flex flex-col gap-4'>
      <WizardStepper step={step} />

      {step === 0 && (
        <LeadBasicsStep
          onCreated={(created) => {
            setLead(created);
            setStep(1);
          }}
        />
      )}

      {step === 1 && lead && (
        <>
          <CustomerSection leadId={lead.id} />
          <ModalFooter className='justify-between'>
            <Button type='secondary' htmlType='button' onClick={onDone}>
              Finish later
            </Button>
            <Button type='primary' htmlType='button' onClick={() => setStep(2)}>
              Next
            </Button>
          </ModalFooter>
        </>
      )}

      {step === 2 && lead && (
        <>
          <EmploymentSection leadId={lead.id} />
          <ModalFooter className='justify-between'>
            <Button
              type='secondary'
              htmlType='button'
              onClick={() => setStep(1)}
            >
              Back
            </Button>
            <Button type='primary' htmlType='button' onClick={() => setStep(3)}>
              Next
            </Button>
          </ModalFooter>
        </>
      )}

      {step === 3 && lead && (
        <>
          <ReferencesSection leadId={lead.id} />
          <ModalFooter className='justify-between'>
            <Button
              type='secondary'
              htmlType='button'
              onClick={() => setStep(2)}
            >
              Back
            </Button>
            <Button type='primary' htmlType='button' onClick={onDone}>
              Finish
            </Button>
          </ModalFooter>
        </>
      )}
    </div>
  );
}

/** Bulk lead CSV import (`POST /leads/import`, `SA`/`CA` only). Response is
 * per-row results, not all-or-nothing, so success is rendered as a results
 * table rather than a single toast — partial failure is the realistic case
 * (e.g. a duplicate mobile or missing required column on one row shouldn't
 * hide that the other rows imported fine). */
function ImportLeadsModal({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<LeadImportRowResult[] | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const importMutation = useMutation({
    mutationFn: (file: File) => importLeadsCsv(file),
    onSuccess: (data) => {
      setResults(data);
      onImported();
      setFileInputKey((key) => key + 1);
    },
    onError: (error) => {
      toast({
        title: 'Import failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const sampleMutation = useMutation({
    mutationFn: downloadLeadImportSampleCsv,
    onError: () => {
      toast({
        title: 'Could not download sample CSV',
        variant: 'destructive',
      });
    },
  });

  const createdCount =
    results?.filter((row) => row.status === 'CREATED').length ?? 0;
  const errorCount =
    results?.filter((row) => row.status === 'ERROR').length ?? 0;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setResults(null);
      }}
    >
      <ModalTrigger asChild>
        <Button type='secondary'>
          <Upload className='size-4' />
          Import CSV
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Import leads from CSV</ModalTitle>
          <ModalDescription>
            Columns: name, mobile (required), email, pan, pincode (optional).
          </ModalDescription>
        </ModalHeader>

        <div className='flex flex-col gap-3'>
          <Button
            type='ghost'
            size='sm'
            className='self-start'
            onClick={() => sampleMutation.mutate()}
            disabled={sampleMutation.isPending}
          >
            {sampleMutation.isPending ? <Spinner size='sm' /> : null}
            Download sample CSV
          </Button>

          <Input
            key={fileInputKey}
            type='file'
            accept='.csv,text/csv'
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setResults(null);
                importMutation.mutate(file);
              }
            }}
            disabled={importMutation.isPending}
          />

          {importMutation.isPending && (
            <div className='flex items-center gap-2 text-foreground/60 text-sm'>
              <Spinner size='sm' />
              Importing…
            </div>
          )}

          {results && (
            <div className='flex flex-col gap-2'>
              <div className='flex items-center gap-2 text-sm'>
                <Badge variant='success'>{createdCount} imported</Badge>
                {errorCount > 0 && (
                  <Badge variant='destructive'>{errorCount} failed</Badge>
                )}
              </div>
              {errorCount > 0 && (
                <div className='max-h-48 overflow-y-auto rounded-md border border-border'>
                  <table className='w-full text-sm'>
                    <tbody>
                      {results
                        .filter((row) => row.status === 'ERROR')
                        .map((row) => (
                          <tr
                            key={row.row}
                            className='border-border border-b last:border-0'
                          >
                            <td className='px-3 py-1.5 font-mono text-foreground/60 text-xs'>
                              Row {row.row}
                            </td>
                            <td className='px-3 py-1.5 text-destructive'>
                              {row.error}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Close
            </Button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const hasQueueRole = Boolean(
    user?.roles.some((role) => QUEUE_ROLES.includes(role)),
  );
  const canImportLeads = Boolean(
    user?.roles.some((role) => IMPORT_ROLES.includes(role)),
  );
  const selfAllocateStage = user?.roles
    .map((role) => SELF_ALLOCATE_STAGE_BY_ROLE[role])
    .find((stage): stage is LeadAssignmentStage => Boolean(stage));
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [leadStatusId, setLeadStatusId] = useState<string>(ALL);
  const [myQueue, setMyQueue] = useState(false);
  const [queueDefaultApplied, setQueueDefaultApplied] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(
    new Set(),
  );
  const limit = 20;
  // An unclaimed lead is by definition unassigned, and every self-allocate
  // role (CR1/CR2/DS1) has an `assigneeRelation` in `QUEUE_ROLE_SCOPES`, so
  // "My queue" is always scoped to leads already assigned to this user —
  // an unclaimed lead can never appear there. The claimable pool only shows
  // up on "All leads"; `selfAllocate` already skips anything not actually
  // eligible, so it's safe to offer selection there.
  const canClaim = !myQueue && Boolean(selfAllocateStage);

  // `useCurrentUser()` resolves asynchronously (starts null) — apply the
  // "default to my queue" behavior once, the first time the user loads,
  // without overriding a manual toggle made afterward.
  useEffect(() => {
    if (user && !queueDefaultApplied) {
      setMyQueue(hasQueueRole);
      setQueueDefaultApplied(true);
    }
  }, [user, queueDefaultApplied, hasQueueRole]);

  const { data: statuses } = useQuery({
    queryKey: ['master-statuses'],
    queryFn: () => listMasterStatuses(),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leads', { page, search, leadStatusId, myQueue }],
    queryFn: () => {
      const params = {
        page,
        limit,
        search: search || undefined,
        leadStatusId: leadStatusId === ALL ? undefined : Number(leadStatusId),
      };
      return myQueue ? listLeadsQueue(params) : listLeads(params);
    },
    placeholderData: (previous) => previous,
  });

  const claimMutation = useMutation({
    mutationFn: () => {
      if (!selfAllocateStage) {
        throw new Error('Your role cannot self-allocate leads.');
      }
      return selfAllocateLeads({
        leadIds: Array.from(selectedLeadIds),
        assignTarget: selfAllocateStage,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setSelectedLeadIds(new Set());
      toast({
        title:
          result.skipped.length > 0
            ? `Claimed ${result.allocated}, skipped ${result.skipped.length} (no longer eligible)`
            : `Claimed ${result.allocated} lead${result.allocated === 1 ? '' : 's'}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not claim leads',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const columns: ColumnDef<Lead>[] = [
    ...(canClaim
      ? [
          {
            id: 'select',
            header: () => null,
            cell: ({ row }: { row: { original: Lead } }) => (
              <Checkbox
                checked={selectedLeadIds.has(row.original.id)}
                onCheckedChange={(checked) => {
                  setSelectedLeadIds((previous) => {
                    const next = new Set(previous);
                    if (checked) {
                      next.add(row.original.id);
                    } else {
                      next.delete(row.original.id);
                    }
                    return next;
                  });
                }}
                onClick={(event) => event.stopPropagation()}
              />
            ),
          } satisfies ColumnDef<Lead>,
        ]
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
        const status = getValue<Lead['leadStatus']>();
        return (
          <Badge variant={statusBadgeVariant(status)}>
            {status?.name ?? 'Unknown'}
          </Badge>
        );
      },
    },
  ];

  return (
    <>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-semibold text-2xl text-primary'>Leads</h1>
          <p className='text-foreground/60 text-sm'>
            {data
              ? `${data.total} lead${data.total === 1 ? '' : 's'}`
              : 'Loading…'}
          </p>
        </div>

        <div className='flex items-center gap-2'>
          {canImportLeads && (
            <ImportLeadsModal
              onImported={() =>
                queryClient.invalidateQueries({ queryKey: ['leads'] })
              }
            />
          )}

          <Modal open={modalOpen} onOpenChange={setModalOpen}>
            <ModalTrigger asChild>
              <Button type='primary'>New lead</Button>
            </ModalTrigger>
            <ModalContent className='max-w-3xl'>
              <ModalHeader>
                <ModalTitle>New lead</ModalTitle>
                <ModalDescription>
                  Create the lead, then capture KYC, employment, and reference
                  details. Once the lead is created you can always finish the
                  remaining steps later from its detail page.
                </ModalDescription>
              </ModalHeader>
              <LeadIntakeWizard onDone={() => setModalOpen(false)} />
            </ModalContent>
          </Modal>
        </div>
      </div>

      <div
        className='flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4'
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {hasQueueRole && (
          <div className='flex overflow-hidden rounded-md border border-border'>
            <button
              type='button'
              onClick={() => {
                setMyQueue(true);
                setPage(1);
                setSelectedLeadIds(new Set());
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
                setSelectedLeadIds(new Set());
              }}
              className={`px-3 py-2 text-sm transition-colors ${
                !myQueue
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/70 hover:bg-muted'
              }`}
            >
              All leads
            </button>
          </div>
        )}
        {canClaim && (
          <Button
            type='primary'
            size='sm'
            disabled={selectedLeadIds.size === 0 || claimMutation.isPending}
            onClick={() => claimMutation.mutate()}
          >
            {claimMutation.isPending ? (
              <Spinner size='sm' />
            ) : (
              `Claim${selectedLeadIds.size > 0 ? ` ${selectedLeadIds.size}` : ''} lead${selectedLeadIds.size === 1 ? '' : 's'}`
            )}
          </Button>
        )}
        <Input
          placeholder='Search by name, mobile, email…'
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
            setSelectedLeadIds(new Set());
          }}
          className='max-w-xs'
        />
        <Select
          value={leadStatusId}
          onValueChange={(value) => {
            setLeadStatusId(value);
            setPage(1);
            setSelectedLeadIds(new Set());
          }}
        >
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='All statuses' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statuses?.map((status) => (
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
        {isLoading ? (
          <div className='flex h-40 items-center justify-center'>
            <Spinner className='text-primary' />
          </div>
        ) : isError ? (
          <p className='py-10 text-center text-destructive text-sm'>
            Couldn't load leads. Try refreshing.
          </p>
        ) : (
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            emptyMessage='No leads match these filters.'
            onRowClick={(lead) =>
              navigate({
                to: '/leads/$leadId',
                params: { leadId: String(lead.id) },
              })
            }
            manualPagination={{
              pageIndex: page - 1,
              pageCount: data ? Math.max(1, Math.ceil(data.total / limit)) : 1,
              onPageChange: (pageIndex) => {
                setPage(pageIndex + 1);
                setSelectedLeadIds(new Set());
              },
            }}
          />
        )}
      </div>
    </>
  );
}
