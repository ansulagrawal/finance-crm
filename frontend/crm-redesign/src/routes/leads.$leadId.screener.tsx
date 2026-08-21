import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Archive, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  calculateAddressDistance,
  calculateAddressLatLong,
  fetchCrifReport,
  verifyBankAccount as verifyBankAccountSignzy,
  verifyUan,
} from '@/lib/integrations';
import { getCustomer, getLead, type Lead } from '@/lib/leads';
import { useHasRole } from '@/lib/roles';
import {
  createBanking,
  downloadKycZip,
  listBankAccountStatuses,
  listBanking,
  listDocuments,
  listDocumentTypes,
  recordDocumentDownload,
  removeDocument,
  setBankAccountStatus,
  uploadDocument,
} from '@/lib/verification';

export const Route = createFileRoute('/leads/$leadId/screener')({
  component: ScreenerTabPage,
});

function BankingCard({
  leadId,
  canManage,
}: {
  leadId: number;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');

  const { data: bankings, isLoading } = useQuery({
    queryKey: ['banking', leadId],
    queryFn: () => listBanking(leadId),
  });

  const { data: statuses } = useQuery({
    queryKey: ['bank-account-statuses'],
    queryFn: () => listBankAccountStatuses(),
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBanking(leadId, {
        bankName: bankName.trim(),
        ifscCode: ifscCode.trim(),
        accountNumber: accountNumber.trim(),
        confirmAccountNumber: confirmAccountNumber.trim(),
        beneficiaryName: beneficiaryName.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banking', leadId] });
      setBankName('');
      setIfscCode('');
      setAccountNumber('');
      setConfirmAccountNumber('');
      setBeneficiaryName('');
      toast({ title: 'Bank account added' });
    },
    onError: (error) => {
      toast({
        title: 'Could not add bank account',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      bankingId,
      accountStatusId,
    }: {
      bankingId: number;
      accountStatusId: number;
    }) => setBankAccountStatus(leadId, bankingId, accountStatusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banking', leadId] });
      toast({ title: 'Bank account status updated' });
    },
    onError: (error) => {
      toast({
        title: 'Could not update bank account status',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit =
    bankName.trim() &&
    ifscCode.trim() &&
    accountNumber.trim() &&
    confirmAccountNumber.trim() === accountNumber.trim() &&
    beneficiaryName.trim();

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Bank accounts
      </h2>
      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) createMutation.mutate();
          }}
          className='grid grid-cols-2 gap-2 md:grid-cols-4'
        >
          <Input
            placeholder='Bank name'
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
          />
          <Input
            placeholder='IFSC code'
            value={ifscCode}
            onChange={(event) => setIfscCode(event.target.value)}
          />
          <Input
            placeholder='Account number'
            value={accountNumber}
            onChange={(event) => setAccountNumber(event.target.value)}
          />
          <Input
            placeholder='Confirm account number'
            value={confirmAccountNumber}
            onChange={(event) => setConfirmAccountNumber(event.target.value)}
          />
          <Input
            placeholder='Beneficiary name'
            value={beneficiaryName}
            onChange={(event) => setBeneficiaryName(event.target.value)}
          />
          <Button
            type='primary'
            size='sm'
            htmlType='submit'
            disabled={!canSubmit || createMutation.isPending}
            className='col-span-2 md:col-span-1'
          >
            {createMutation.isPending ? <Spinner size='sm' /> : 'Add account'}
          </Button>
        </form>
      )}
      {canManage &&
        accountNumber.trim() &&
        confirmAccountNumber.trim() &&
        accountNumber.trim() !== confirmAccountNumber.trim() && (
          <p className='text-destructive text-xs'>
            Account numbers don't match.
          </p>
        )}
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : bankings?.length ? (
        bankings.map((b) => (
          <div
            key={b.id}
            className='flex items-center justify-between border-border/60 border-b py-2.5 last:border-0'
          >
            <div className='flex flex-col'>
              <span className='font-medium text-sm'>
                {b.bankName} · {b.accountNumber}
              </span>
              <span className='text-foreground/50 text-xs'>
                {b.ifscCode} · {b.beneficiaryName}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              {canManage && statuses?.length ? (
                <Select
                  value={b.accountStatusId ? String(b.accountStatusId) : ''}
                  onValueChange={(value) =>
                    statusMutation.mutate({
                      bankingId: b.id,
                      accountStatusId: Number(value),
                    })
                  }
                >
                  <SelectTrigger className='w-64'>
                    <SelectValue placeholder='Set status' />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={b.accountStatusId === 1 ? 'success' : 'muted'}>
                  {b.accountStatusId === 1 ? 'Verified' : 'Unverified'}
                </Badge>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>No bank accounts yet.</p>
      )}
    </div>
  );
}

function DocumentsCard({
  leadId,
  canManage,
}: {
  leadId: number;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [filePath, setFilePath] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState('');
  // Legacy (`Admin/KycZipController.php`) restricts the KYC-docs zip
  // download to `LD1` only — see `kyc-zip.controller.ts`'s matching
  // `@Roles('LD1')`.
  const canDownloadZip = useHasRole('LD1');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', leadId],
    queryFn: () => listDocuments(leadId),
  });
  const { data: types } = useQuery({
    queryKey: ['document-types'],
    queryFn: listDocumentTypes,
    enabled: canManage,
  });

  const uploadMutation = useMutation({
    mutationFn: () =>
      uploadDocument(leadId, {
        filePath: filePath.trim(),
        documentTypeId: documentTypeId ? Number(documentTypeId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', leadId] });
      setFilePath('');
      setDocumentTypeId('');
      toast({ title: 'Document recorded' });
    },
    onError: (error) => {
      toast({
        title: 'Could not record document',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (documentId: number) =>
      recordDocumentDownload(leadId, documentId),
    onSuccess: () => {
      toast({ title: 'Download logged' });
    },
    onError: (error) => {
      toast({
        title: 'Could not log download',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const zipMutation = useMutation({
    mutationFn: () => downloadKycZip(leadId),
    onError: (error) => {
      toast({
        title: 'Could not download zip',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (documentId: number) => removeDocument(leadId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', leadId] });
      toast({ title: 'Document removed' });
    },
    onError: (error) => {
      toast({
        title: 'Could not remove document',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          Documents
        </h2>
        {!!documents?.length && canDownloadZip && (
          <Button
            type='ghost'
            size='sm'
            onClick={() => zipMutation.mutate()}
            disabled={zipMutation.isPending}
          >
            {zipMutation.isPending ? (
              <Spinner size='sm' />
            ) : (
              <Archive className='size-4' />
            )}
            Download all as ZIP
          </Button>
        )}
      </div>
      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (filePath.trim()) uploadMutation.mutate();
          }}
          className='flex flex-wrap gap-2'
        >
          <Input
            placeholder='File path / URL'
            value={filePath}
            onChange={(event) => setFilePath(event.target.value)}
            className='flex-1'
          />
          <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='Type (optional)' />
            </SelectTrigger>
            <SelectContent>
              {types?.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='primary'
            size='sm'
            htmlType='submit'
            disabled={!filePath.trim() || uploadMutation.isPending}
          >
            {uploadMutation.isPending ? <Spinner size='sm' /> : 'Record'}
          </Button>
        </form>
      )}
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : documents?.length ? (
        <div className='flex max-h-80 flex-col overflow-y-auto'>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className='flex items-center justify-between border-border/60 border-b py-2.5 last:border-0'
            >
              <div className='flex flex-col'>
                <span className='break-all font-medium text-sm'>
                  {doc.filePath}
                </span>
                <span className='text-foreground/50 text-xs'>
                  {doc.documentType?.name ?? 'Unspecified type'}
                  {doc.uploadedBy && ` · ${doc.uploadedBy.name}`}
                </span>
              </div>
              <div className='flex items-center gap-1'>
                <button
                  type='button'
                  aria-label={`Log download for ${doc.filePath}`}
                  onClick={() => downloadMutation.mutate(doc.id)}
                  className='text-foreground/50 hover:text-foreground'
                >
                  <Download className='size-4' />
                </button>
                {canManage && (
                  <button
                    type='button'
                    aria-label={`Remove ${doc.filePath}`}
                    onClick={() => removeMutation.mutate(doc.id)}
                    className='text-destructive/70 hover:text-destructive'
                  >
                    <Trash2 className='size-4' />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className='text-foreground/50 text-sm'>No documents yet.</p>
      )}
    </div>
  );
}
const RESIDENCE_DISTANCE_KM_LIMIT = 25;

function ResidenceDistanceCard({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const { data: customer, isLoading } = useQuery({
    queryKey: ['lead-customer', leadId],
    queryFn: () => getCustomer(leadId),
  });

  const address = customer
    ? [
        customer.currentAddressLine1,
        customer.currentAddressLine2,
        customer.currentLandmark,
        customer.city?.name,
        customer.state?.name,
        customer.pincode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const mutation = useMutation({
    mutationFn: async () => {
      const latLong = await calculateAddressLatLong({
        leadId,
        address,
        addressType: 2,
      });
      if (latLong.status !== 'SUCCESS') {
        throw new Error(
          latLong.errors ?? 'Could not geocode the Aadhaar address.',
        );
      }
      return calculateAddressDistance({ leadId });
    },
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: ['lead-customer', leadId] });
      if (log.status === 'SUCCESS') {
        toast({ title: `Residence distance: ${log.distanceKm} km` });
      } else {
        toast({
          title: 'Could not calculate distance',
          description: log.errors ?? undefined,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Could not calculate residence distance',
        description:
          error instanceof Error ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const distanceKm = customer?.residenceDistanceKm
    ? Number(customer.residenceDistanceKm)
    : null;

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Residence distance
      </h3>
      <p className='text-foreground/50 text-xs'>
        Distance between the Aadhaar/current address on file and the customer's
        live-location GPS fix. Required (and must be within{' '}
        {RESIDENCE_DISTANCE_KM_LIMIT}km) for straight-through audit eligibility.
      </p>
      {isLoading ? (
        <div className='flex h-10 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : (
        <>
          <p className='text-foreground/60 text-xs'>
            Address to geocode: {address || 'No current address on file.'}
          </p>
          {distanceKm !== null && (
            <Badge
              variant={
                distanceKm > RESIDENCE_DISTANCE_KM_LIMIT
                  ? 'destructive'
                  : 'success'
              }
              className='self-start'
            >
              {distanceKm} km
            </Badge>
          )}
          <Button
            type='primary'
            size='sm'
            htmlType='button'
            className='self-start'
            disabled={!address || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Spinner size='sm' />
            ) : (
              'Calculate residence distance'
            )}
          </Button>
        </>
      )}
    </div>
  );
}

function VerificationSection({ leadId }: { leadId: number }) {
  // Backend doesn't role-gate banking/documents controllers itself.
  // Gated client-side to CR1 (screener) only. LD1 was previously included
  // here too, but legacy only ever ties LD1 to the KYC-zip-download feature
  // (Admin/KycZipController.php) — no legacy evidence gates banking/documents
  // editing on it, so it's been removed from this check.
  const canManage = useHasRole('CR1');

  return (
    <div className='flex flex-col gap-6'>
      <h2 className='font-display font-semibold text-lg text-primary'>
        Verification
      </h2>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <BankingCard leadId={leadId} canManage={canManage} />
        <DocumentsCard leadId={leadId} canManage={canManage} />
        <ResidenceDistanceCard leadId={leadId} />
      </div>
    </div>
  );
}

function CrifBureauCard({ lead }: { lead: Lead }) {
  const [lastName, setLastName] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof fetchCrifReport>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      fetchCrifReport({
        leadId: lead.id,
        firstName: lead.firstName,
        lastName: lastName.trim(),
        mobile: lead.mobile,
        pan: lead.pancard ?? '',
      }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.status === 'SUCCESS' ? 'CRIF report fetched' : 'CRIF call failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not fetch CRIF report',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        CRIF bureau report
      </h3>
      <p className='text-foreground/50 text-xs'>
        Uses this lead's name/mobile/PAN — Surepass CRIF adapter. Requires a PAN
        on the lead ({lead.pancard ?? 'none set'}).
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (lastName.trim() && lead.pancard) mutation.mutate();
        }}
        className='flex gap-2'
      >
        <Input
          placeholder='Last name'
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className='flex-1'
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!lastName.trim() || !lead.pancard || mutation.isPending}
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Fetch report'}
        </Button>
      </form>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={result.status === 'SUCCESS' ? 'success' : 'destructive'}
          >
            {result.status}
          </Badge>
          {result.cibilScore && (
            <span className='ml-2'>CIBIL score: {result.cibilScore}</span>
          )}
          {result.errors && (
            <p className='mt-1 text-destructive text-xs'>{result.errors}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BankVerificationCard({ lead }: { lead: Lead }) {
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof verifyBankAccountSignzy>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      verifyBankAccountSignzy({
        leadId: lead.id,
        beneficiaryAccount: account.trim(),
        beneficiaryName: name.trim(),
        beneficiaryIfsc: ifsc.trim(),
      }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Bank account verified'
            : 'Verification failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not verify bank account',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Bank verification (Signzy penny-drop)
      </h3>
      <p className='text-foreground/50 text-xs'>
        Real-time vendor check — separate from the manual "Verify" flag in the
        Verification section above.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (account.trim() && name.trim() && ifsc.trim()) mutation.mutate();
        }}
        className='grid grid-cols-3 gap-2'
      >
        <Input
          placeholder='Account number'
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        />
        <Input
          placeholder='Beneficiary name'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder='IFSC'
          value={ifsc}
          onChange={(e) => setIfsc(e.target.value)}
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          className='col-span-3'
          disabled={
            !account.trim() ||
            !name.trim() ||
            !ifsc.trim() ||
            mutation.isPending
          }
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Verify account'}
        </Button>
      </form>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={result.status === 'SUCCESS' ? 'success' : 'destructive'}
          >
            {result.status}
          </Badge>
          {result.errors && (
            <p className='mt-1 text-destructive text-xs'>{result.errors}</p>
          )}
        </div>
      )}
    </div>
  );
}

function UanVerificationCard({ lead }: { lead: Lead }) {
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof verifyUan>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      verifyUan({
        leadId: lead.id,
        mobileNumber: lead.mobile,
        panNumber: lead.pancard ?? '',
      }),
    onSuccess: (log) => {
      setResult(log);
      toast({ title: log.uanFound ? 'UAN found' : 'No UAN found' });
    },
    onError: (error) => {
      toast({
        title: 'Could not verify UAN',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        UAN / employment verification
      </h3>
      <p className='text-foreground/50 text-xs'>
        Uses this lead's mobile + PAN. Requires a PAN on the lead (
        {lead.pancard ?? 'none set'}).
      </p>
      <Button
        type='primary'
        size='sm'
        htmlType='button'
        disabled={!lead.pancard || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Spinner size='sm' /> : 'Check UAN'}
      </Button>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge variant={result.uanFound ? 'success' : 'muted'}>
            {result.uanFound ? 'UAN found' : 'Not found'}
          </Badge>
          {result.employerName && (
            <span className='ml-2'>Employer: {result.employerName}</span>
          )}
        </div>
      )}
    </div>
  );
}

function BureauVerificationSection({ lead }: { lead: Lead }) {
  return (
    <div className='flex flex-col gap-6'>
      <h2 className='font-semibold text-lg text-primary'>
        Bureau &amp; Verification (vendor calls)
      </h2>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <CrifBureauCard lead={lead} />
        <UanVerificationCard lead={lead} />
      </div>
      <BankVerificationCard lead={lead} />
    </div>
  );
}

function ScreenerTabPage() {
  const { leadId } = Route.useParams();
  const id = Number(leadId);
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => getLead(id),
  });

  if (isLoading || !lead) {
    return (
      <div className='flex h-40 items-center justify-center'>
        <Spinner className='text-primary' />
      </div>
    );
  }

  return (
    <>
      <VerificationSection leadId={id} />
      <BureauVerificationSection lead={lead} />
    </>
  );
}
