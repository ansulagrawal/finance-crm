import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/components/lead-detail/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  type AaTransaction,
  type AccountAggregatorLog,
  type BankAnalysisLog,
  createDigilockerUrl,
  createVideoKycSession,
  downloadEsignDocument,
  getAaAnalyticsReport,
  getAaConsentStatus,
  getAaFiData,
  getAaFiStatus,
  getBankAnalysisResult,
  getDigilockerDetails,
  getDigilockerEaadhaar,
  initiateEsign,
  ocrAadhaar,
  ocrPan,
  requestAaConsent,
  requestAaFi,
  uploadBankAnalysis,
  verifyFaceMatch,
  verifyPan,
} from '@/lib/integrations';
import { getLead, type Lead } from '@/lib/leads';
import { safeExternalUrl } from '@/lib/safe-url';
import { type LeadDocument, listDocuments } from '@/lib/verification';

export const Route = createFileRoute('/leads/$leadId/kyc')({
  component: KycTabPage,
});

const AA_POLL_INTERVAL_MS = 5000;
const AA_POLL_TIMEOUT_MS = 3 * 60 * 1000;

function useAaLogPoll(
  queryKey: unknown[],
  queryFn: () => Promise<AccountAggregatorLog>,
  isDone: (log: AccountAggregatorLog) => boolean,
) {
  const [polling, setPolling] = useState(false);
  const [pollStart, setPollStart] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: polling,
    refetchInterval: polling ? AA_POLL_INTERVAL_MS : false,
  });

  const done = query.data ? isDone(query.data) : false;

  useEffect(() => {
    if (!polling) return;
    if (done) {
      setPolling(false);
      return;
    }
    if (pollStart !== null && Date.now() - pollStart > AA_POLL_TIMEOUT_MS) {
      setPolling(false);
      setTimedOut(true);
    }
  }, [polling, done, pollStart, query.dataUpdatedAt]);

  function start() {
    setTimedOut(false);
    setPollStart(Date.now());
    setPolling(true);
  }

  return { query, polling, done, timedOut, start };
}

function formatRawPayload(payload: string | null): string {
  if (!payload) return 'No payload.';
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function AccountAggregatorSection({
  leadId,
  lead,
}: {
  leadId: number;
  lead: Lead;
}) {
  const [mobile, setMobile] = useState(lead.mobile);
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const consentPoll = useAaLogPoll(
    ['aa-consent-status', leadId],
    () => getAaConsentStatus(leadId),
    (log) => Boolean(log.consentId),
  );
  const fiStatusPoll = useAaLogPoll(
    ['aa-fi-status', leadId],
    () => getAaFiStatus(leadId),
    (log) => log.status === 'SUCCESS',
  );
  const fiDataQuery = useQuery({
    queryKey: ['aa-fi-data', leadId],
    queryFn: () => getAaFiData(leadId),
    enabled: false,
  });
  const analyticsReportQuery = useQuery({
    queryKey: ['aa-analytics-report', leadId],
    queryFn: () => getAaAnalyticsReport(leadId),
    enabled: false,
  });

  const consentRequestMutation = useMutation({
    mutationFn: () => requestAaConsent({ leadId, mobileNumber: mobile.trim() }),
    onSuccess: () => {
      setConsentModalOpen(false);
      toast({ title: 'Consent request sent to customer' });
      consentPoll.start();
    },
    onError: (error) => {
      toast({
        title: 'Could not request consent',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const fiRequestMutation = useMutation({
    mutationFn: () => requestAaFi(leadId, { fromDate, toDate }),
    onSuccess: () => {
      toast({ title: 'Bank statement pull requested' });
      fiStatusPoll.start();
    },
    onError: (error) => {
      toast({
        title: 'Could not request bank statement',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const consentAccepted = Boolean(consentPoll.query.data?.consentId);
  const fiReady = Boolean(
    fiStatusPoll.query.data && fiStatusPoll.query.data.status === 'SUCCESS',
  );

  const transactionColumns: ColumnDef<AaTransaction>[] = [
    { accessorKey: 'date', header: 'Date' },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge variant={row.original.type === 'CREDIT' ? 'success' : 'muted'}>
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => formatCurrency(String(row.original.amount)),
    },
    {
      accessorKey: 'narration',
      header: 'Narration',
      cell: ({ row }) => row.original.narration ?? '—',
    },
    {
      accessorKey: 'balance',
      header: 'Balance',
      cell: ({ row }) =>
        row.original.balance != null
          ? formatCurrency(String(row.original.balance))
          : '—',
    },
  ];

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-4 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <h2 className='font-semibold text-lg text-primary'>
          Bank statement (Account Aggregator)
        </h2>
        <p className='text-foreground/60 text-xs'>
          RBI Account Aggregator consent-based bank-statement pull, via the AA
          gateway.
        </p>
      </div>

      <div className='flex flex-col gap-2 border-border/60 border-b pb-4'>
        <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          1. Request consent
        </h3>
        <div className='flex flex-wrap items-center gap-2'>
          <Modal open={consentModalOpen} onOpenChange={setConsentModalOpen}>
            <ModalTrigger asChild>
              <Button type='primary' size='sm' htmlType='button'>
                Request consent
              </Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Request AA consent</ModalTitle>
                <ModalDescription>
                  Sends a consent request to the customer's mobile for a
                  periodic bank-statement pull.
                </ModalDescription>
              </ModalHeader>
              <div className='flex flex-col gap-1'>
                <Label>Mobile number</Label>
                <Input
                  placeholder='10-digit mobile number'
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </div>
              <ModalFooter>
                <ModalClose asChild>
                  <Button type='secondary' htmlType='button'>
                    Cancel
                  </Button>
                </ModalClose>
                <Button
                  type='primary'
                  htmlType='button'
                  disabled={!mobile.trim() || consentRequestMutation.isPending}
                  onClick={() => consentRequestMutation.mutate()}
                >
                  {consentRequestMutation.isPending ? (
                    <Spinner size='sm' />
                  ) : (
                    'Send request'
                  )}
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>

          {consentPoll.polling && (
            <span className='flex items-center gap-1.5 text-foreground/60 text-xs'>
              <Spinner size='sm' /> Waiting for customer to accept…
            </span>
          )}
          {consentPoll.query.data && !consentPoll.polling && (
            <Button
              type='secondary'
              size='sm'
              htmlType='button'
              onClick={() => consentPoll.start()}
            >
              Check again
            </Button>
          )}
        </div>
        {consentPoll.query.data && (
          <div className='rounded-md bg-muted p-2 text-sm'>
            <Badge
              variant={
                consentAccepted
                  ? 'success'
                  : consentPoll.timedOut
                    ? 'destructive'
                    : 'warning'
              }
            >
              {consentAccepted
                ? 'Accepted'
                : consentPoll.timedOut
                  ? 'Timed out'
                  : 'Pending'}
            </Badge>
            {consentPoll.query.data.statusMessage && (
              <span className='ml-2 text-foreground/60'>
                {consentPoll.query.data.statusMessage}
              </span>
            )}
          </div>
        )}
      </div>

      <div className='flex flex-col gap-2 border-border/60 border-b pb-4'>
        <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          2. Request bank statement
        </h3>
        {!consentAccepted ? (
          <p className='text-foreground/50 text-xs'>
            Waiting for accepted consent.
          </p>
        ) : (
          <>
            <div className='flex flex-wrap items-end gap-2'>
              <div className='flex flex-col gap-1'>
                <Label>From</Label>
                <DatePicker
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className='flex flex-col gap-1'>
                <Label>To</Label>
                <DatePicker
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <Button
                type='primary'
                size='sm'
                htmlType='button'
                disabled={!fromDate || !toDate || fiRequestMutation.isPending}
                onClick={() => fiRequestMutation.mutate()}
              >
                {fiRequestMutation.isPending ? (
                  <Spinner size='sm' />
                ) : (
                  'Request statement'
                )}
              </Button>
              {fiStatusPoll.polling && (
                <span className='flex items-center gap-1.5 text-foreground/60 text-xs'>
                  <Spinner size='sm' /> Checking pull status…
                </span>
              )}
              {fiStatusPoll.query.data && !fiStatusPoll.polling && (
                <Button
                  type='secondary'
                  size='sm'
                  htmlType='button'
                  onClick={() => fiStatusPoll.start()}
                >
                  Check again
                </Button>
              )}
            </div>
            {fiStatusPoll.query.data && (
              <div className='rounded-md bg-muted p-2 text-sm'>
                <Badge
                  variant={
                    fiReady
                      ? 'success'
                      : fiStatusPoll.timedOut
                        ? 'destructive'
                        : 'warning'
                  }
                >
                  {fiReady
                    ? 'Status received'
                    : fiStatusPoll.timedOut
                      ? 'Timed out'
                      : 'Pending'}
                </Badge>
                {fiStatusPoll.query.data.statusMessage && (
                  <span className='ml-2 text-foreground/60'>
                    {fiStatusPoll.query.data.statusMessage}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className='flex flex-col gap-3 border-border/60 border-b pb-4'>
        <div className='flex items-center justify-between'>
          <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
            3. Bank statement data
          </h3>
          <Button
            type='secondary'
            size='sm'
            htmlType='button'
            disabled={!fiReady || fiDataQuery.isFetching}
            onClick={() => fiDataQuery.refetch()}
          >
            {fiDataQuery.isFetching ? <Spinner size='sm' /> : 'Fetch data'}
          </Button>
        </div>
        {fiDataQuery.data && (
          <>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Debits</TableHead>
                    <TableHead>Net change</TableHead>
                    <TableHead>Closing balance</TableHead>
                    <TableHead>Txns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fiDataQuery.data.monthlySummary.map((m) => (
                    <TableRow key={m.yearMonth}>
                      <TableCell>{m.yearMonth}</TableCell>
                      <TableCell>{formatCurrency(String(m.credits))}</TableCell>
                      <TableCell>{formatCurrency(String(m.debits))}</TableCell>
                      <TableCell>
                        {formatCurrency(String(m.netChange))}
                      </TableCell>
                      <TableCell>
                        {m.closingBalance != null
                          ? formatCurrency(String(m.closingBalance))
                          : '—'}
                      </TableCell>
                      <TableCell>{m.transactionCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DataTable
              columns={transactionColumns}
              data={fiDataQuery.data.transactions}
              emptyMessage='No transactions.'
            />
          </>
        )}
      </div>

      <Accordion type='single' collapsible>
        <AccordionItem value='raw-report'>
          <AccordionTrigger
            onClick={() => {
              if (!analyticsReportQuery.data) analyticsReportQuery.refetch();
            }}
          >
            View raw analytics report
          </AccordionTrigger>
          <AccordionContent>
            {analyticsReportQuery.isFetching ? (
              <Spinner size='sm' />
            ) : (
              <pre className='max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs'>
                {analyticsReportQuery.data
                  ? formatRawPayload(analyticsReportQuery.data.responsePayload)
                  : 'No report fetched yet.'}
              </pre>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function DigilockerEkycCard({ leadId }: { leadId: number }) {
  const [createResult, setCreateResult] = useState<Awaited<
    ReturnType<typeof createDigilockerUrl>
  > | null>(null);
  const [detailsResult, setDetailsResult] = useState<Awaited<
    ReturnType<typeof getDigilockerDetails>
  > | null>(null);
  const [eaadhaarResult, setEaadhaarResult] = useState<Awaited<
    ReturnType<typeof getDigilockerEaadhaar>
  > | null>(null);

  const onFailure = (label: string) => (error: unknown) => {
    toast({
      title: `Could not ${label}`,
      description:
        error instanceof ApiError ? error.message : 'Something went wrong.',
      variant: 'destructive',
    });
  };

  const createMutation = useMutation({
    mutationFn: () => createDigilockerUrl(leadId),
    onSuccess: (log) => {
      setCreateResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Digilocker consent URL created'
            : 'Could not create consent URL',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: onFailure('start Digilocker KYC'),
  });

  const detailsMutation = useMutation({
    mutationFn: () => getDigilockerDetails(leadId),
    onSuccess: (log) => {
      setDetailsResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Digilocker details fetched'
            : 'Details not available yet',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: onFailure('fetch Digilocker details'),
  });

  const eaadhaarMutation = useMutation({
    mutationFn: () => getDigilockerEaadhaar(leadId),
    onSuccess: (log) => {
      setEaadhaarResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'e-Aadhaar fetched'
            : 'e-Aadhaar not available yet',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: onFailure('fetch e-Aadhaar'),
  });

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        eKYC / Digilocker
      </h3>
      <p className='text-foreground/50 text-xs'>
        Three manual steps, in order: start the consent flow, then (once the
        customer completes it) check details, then fetch e-Aadhaar.
      </p>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='primary'
          size='sm'
          htmlType='button'
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? (
            <Spinner size='sm' />
          ) : (
            'Start Digilocker KYC'
          )}
        </Button>
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={detailsMutation.isPending}
          onClick={() => detailsMutation.mutate()}
        >
          {detailsMutation.isPending ? <Spinner size='sm' /> : 'Check details'}
        </Button>
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={eaadhaarMutation.isPending}
          onClick={() => eaadhaarMutation.mutate()}
        >
          {eaadhaarMutation.isPending ? (
            <Spinner size='sm' />
          ) : (
            'Fetch e-Aadhaar'
          )}
        </Button>
      </div>
      {createResult && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={
              createResult.status === 'SUCCESS' ? 'success' : 'destructive'
            }
          >
            {createResult.status}
          </Badge>
          {safeExternalUrl(createResult.returnUrl) && (
            <a
              href={safeExternalUrl(createResult.returnUrl) ?? undefined}
              target='_blank'
              rel='noreferrer'
              className='ml-2 text-primary hover:underline'
            >
              Consent URL
            </a>
          )}
          {createResult.errors && (
            <p className='mt-1 text-destructive text-xs'>
              {createResult.errors}
            </p>
          )}
        </div>
      )}
      {detailsResult && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={
              detailsResult.status === 'SUCCESS' ? 'success' : 'destructive'
            }
          >
            Details: {detailsResult.status}
          </Badge>
          {detailsResult.errors && (
            <p className='mt-1 text-destructive text-xs'>
              {detailsResult.errors}
            </p>
          )}
        </div>
      )}
      {eaadhaarResult && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={
              eaadhaarResult.status === 'SUCCESS' ? 'success' : 'destructive'
            }
          >
            e-Aadhaar: {eaadhaarResult.status}
          </Badge>
          {eaadhaarResult.errors && (
            <p className='mt-1 text-destructive text-xs'>
              {eaadhaarResult.errors}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EsignCard({ lead }: { lead: Lead }) {
  const [documentBase64, setDocumentBase64] = useState('');
  const [signerName, setSignerName] = useState(lead.firstName);
  const [signerMobile, setSignerMobile] = useState(lead.mobile);
  const [signerEmail, setSignerEmail] = useState(lead.email ?? '');
  const [signerGender, setSignerGender] = useState('');
  const [aadhaarLastFourDigits, setAadhaarLastFourDigits] = useState('');
  const [signerYearOfBirth, setSignerYearOfBirth] = useState('');
  const [initiateResult, setInitiateResult] = useState<Awaited<
    ReturnType<typeof initiateEsign>
  > | null>(null);
  const [downloadResult, setDownloadResult] = useState<Awaited<
    ReturnType<typeof downloadEsignDocument>
  > | null>(null);

  const initiateMutation = useMutation({
    mutationFn: () =>
      initiateEsign({
        leadId: lead.id,
        documentBase64: documentBase64.trim(),
        signerName: signerName.trim(),
        signerMobile: signerMobile.trim(),
        signerEmail: signerEmail.trim(),
        signerGender: signerGender.trim() || undefined,
        aadhaarLastFourDigits: aadhaarLastFourDigits.trim(),
        signerYearOfBirth: signerYearOfBirth.trim() || undefined,
      }),
    onSuccess: (log) => {
      setInitiateResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'eSign contract initiated'
            : 'Could not initiate eSign',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not initiate eSign',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: () => downloadEsignDocument(lead.id),
    onSuccess: (log) => {
      setDownloadResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Signed document ready'
            : 'Signed document not ready yet',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not download signed document',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const canInitiate =
    documentBase64.trim() &&
    signerName.trim() &&
    signerMobile.trim() &&
    signerEmail.trim() &&
    aadhaarLastFourDigits.trim();

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        eSign
      </h3>
      <p className='text-foreground/50 text-xs'>
        No in-app document renderer exists yet (the `pdf/` package is a
        placeholder) — paste the base64 PDF to be signed (e.g. a sanction letter
        rendered elsewhere) below.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canInitiate) initiateMutation.mutate();
        }}
        className='flex flex-col gap-2'
      >
        <Textarea
          placeholder='Base64-encoded PDF content'
          value={documentBase64}
          onChange={(e) => setDocumentBase64(e.target.value)}
          rows={3}
        />
        <div className='grid grid-cols-2 gap-2'>
          <Input
            placeholder='Signer name'
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
          <Input
            placeholder='Signer mobile'
            value={signerMobile}
            onChange={(e) => setSignerMobile(e.target.value)}
          />
          <Input
            placeholder='Signer email'
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
          />
          <Input
            placeholder='Signer gender (optional)'
            value={signerGender}
            onChange={(e) => setSignerGender(e.target.value)}
          />
          <Input
            placeholder='Aadhaar last 4 digits'
            value={aadhaarLastFourDigits}
            onChange={(e) => setAadhaarLastFourDigits(e.target.value)}
          />
          <Input
            placeholder='Signer year of birth (optional)'
            value={signerYearOfBirth}
            onChange={(e) => setSignerYearOfBirth(e.target.value)}
          />
        </div>
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!canInitiate || initiateMutation.isPending}
        >
          {initiateMutation.isPending ? (
            <Spinner size='sm' />
          ) : (
            'Initiate eSign'
          )}
        </Button>
      </form>
      {initiateResult && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={
              initiateResult.status === 'SUCCESS' ? 'success' : 'destructive'
            }
          >
            {initiateResult.status}
          </Badge>
          {safeExternalUrl(initiateResult.returnUrl) && (
            <a
              href={safeExternalUrl(initiateResult.returnUrl) ?? undefined}
              target='_blank'
              rel='noreferrer'
              className='ml-2 text-primary hover:underline'
            >
              Signing link
            </a>
          )}
          {initiateResult.errors && (
            <p className='mt-1 text-destructive text-xs'>
              {initiateResult.errors}
            </p>
          )}
        </div>
      )}
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={downloadMutation.isPending}
        onClick={() => downloadMutation.mutate()}
        className='self-start'
      >
        {downloadMutation.isPending ? (
          <Spinner size='sm' />
        ) : (
          'Download signed document'
        )}
      </Button>
      {downloadResult && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={
              downloadResult.status === 'SUCCESS' ? 'success' : 'destructive'
            }
          >
            {downloadResult.status}
          </Badge>
          {safeExternalUrl(downloadResult.returnUrl) && (
            <a
              href={safeExternalUrl(downloadResult.returnUrl) ?? undefined}
              target='_blank'
              rel='noreferrer'
              className='ml-2 text-primary hover:underline'
            >
              Signed document
            </a>
          )}
          {downloadResult.errors && (
            <p className='mt-1 text-destructive text-xs'>
              {downloadResult.errors}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VideoKycCard({ lead }: { lead: Lead }) {
  const [customerFullName, setCustomerFullName] = useState(lead.firstName);
  const [loanAmount, setLoanAmount] = useState(Number(lead.loanAmount) || 0);
  const [repaymentDate, setRepaymentDate] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState(0);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof createVideoKycSession>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createVideoKycSession({
        leadId: lead.id,
        customerFullName: customerFullName.trim(),
        loanAmount,
        repaymentDate,
        repaymentAmount,
      }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Video KYC session sent'
            : 'Could not send video KYC session',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not send video KYC session',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit =
    customerFullName.trim() &&
    loanAmount > 0 &&
    repaymentDate &&
    repaymentAmount > 0;

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Video KYC
      </h3>
      <p className='text-foreground/50 text-xs'>
        Sends a scripted loan-consent statement for the customer to read on
        camera. Status updates via a backend-side vendor callback — resend if
        needed.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        className='grid grid-cols-2 gap-2'
      >
        <Input
          placeholder='Customer full name'
          value={customerFullName}
          onChange={(e) => setCustomerFullName(e.target.value)}
        />
        <NumberInput
          value={loanAmount}
          onChange={setLoanAmount}
          min={0}
          step={100}
        />
        <DatePicker
          value={repaymentDate}
          onChange={(e) => setRepaymentDate(e.target.value)}
        />
        <NumberInput
          value={repaymentAmount}
          onChange={setRepaymentAmount}
          min={0}
          step={100}
        />
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          className='col-span-2'
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? (
            <Spinner size='sm' />
          ) : result ? (
            'Resend Video KYC'
          ) : (
            'Send Video KYC'
          )}
        </Button>
      </form>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={result.status === 'SUCCESS' ? 'success' : 'destructive'}
          >
            {result.status}
          </Badge>
          {safeExternalUrl(result.returnUrl) && (
            <a
              href={safeExternalUrl(result.returnUrl) ?? undefined}
              target='_blank'
              rel='noreferrer'
              className='ml-2 text-primary hover:underline'
            >
              Session link
            </a>
          )}
          {result.errors && (
            <p className='mt-1 text-destructive text-xs'>{result.errors}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentUrlSelect({
  documents,
  value,
  onChange,
  placeholder,
}: {
  documents: LeadDocument[] | undefined;
  value: string;
  onChange: (filePath: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {documents?.map((doc) => (
          <SelectItem key={doc.id} value={doc.filePath}>
            {doc.documentType?.name ?? 'Unspecified type'} — {doc.filePath}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FaceMatchCard({ leadId }: { leadId: number }) {
  const [firstImageUrl, setFirstImageUrl] = useState('');
  const [secondImageUrl, setSecondImageUrl] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof verifyFaceMatch>
  > | null>(null);

  const { data: documents } = useQuery({
    queryKey: ['documents', leadId],
    queryFn: () => listDocuments(leadId),
  });

  const mutation = useMutation({
    mutationFn: () =>
      verifyFaceMatch({ leadId, firstImageUrl, secondImageUrl }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? `Face match: ${log.matchPercentage}%`
            : 'Face match failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not run face match',
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
        Face match
      </h3>
      <p className='text-foreground/50 text-xs'>
        Pick the live selfie and the Aadhaar photo (or fallback selfie) from
        this lead's uploaded documents.
      </p>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <DocumentUrlSelect
          documents={documents}
          value={firstImageUrl}
          onChange={setFirstImageUrl}
          placeholder='Selfie document'
        />
        <DocumentUrlSelect
          documents={documents}
          value={secondImageUrl}
          onChange={setSecondImageUrl}
          placeholder='Aadhaar photo document'
        />
      </div>
      <Button
        type='primary'
        size='sm'
        htmlType='button'
        className='self-start'
        disabled={!firstImageUrl || !secondImageUrl || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Spinner size='sm' /> : 'Verify face match'}
      </Button>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={result.status === 'SUCCESS' ? 'success' : 'destructive'}
          >
            {result.status}
          </Badge>
          {result.matchPercentage && (
            <span className='ml-2'>Match: {result.matchPercentage}%</span>
          )}
          {result.errors && (
            <p className='mt-1 text-destructive text-xs'>{result.errors}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PoiVerificationCard({ lead }: { lead: Lead }) {
  const [pan, setPan] = useState(lead.pancard ?? '');
  const [panDocUrl, setPanDocUrl] = useState('');
  const [aadhaarDocUrl, setAadhaarDocUrl] = useState('');
  const [panResult, setPanResult] = useState<Awaited<
    ReturnType<typeof verifyPan>
  > | null>(null);
  const [panOcrResult, setPanOcrResult] = useState<Awaited<
    ReturnType<typeof ocrPan>
  > | null>(null);
  const [aadhaarOcrResult, setAadhaarOcrResult] = useState<Awaited<
    ReturnType<typeof ocrAadhaar>
  > | null>(null);

  const { data: documents } = useQuery({
    queryKey: ['documents', lead.id],
    queryFn: () => listDocuments(lead.id),
  });

  const onFailure = (label: string) => (error: unknown) => {
    toast({
      title: `Could not ${label}`,
      description:
        error instanceof ApiError ? error.message : 'Something went wrong.',
      variant: 'destructive',
    });
  };

  const panMutation = useMutation({
    mutationFn: () => verifyPan({ leadId: lead.id, pan: pan.trim() }),
    onSuccess: (log) => {
      setPanResult(log);
      toast({
        title:
          log.status === 'SUCCESS' ? 'PAN verified' : 'PAN verification failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: onFailure('verify PAN'),
  });

  const panOcrMutation = useMutation({
    mutationFn: () => ocrPan({ leadId: lead.id, documentUrl: panDocUrl }),
    onSuccess: (log) => {
      setPanOcrResult(log);
      toast({
        title: log.status === 'SUCCESS' ? 'PAN OCR complete' : 'PAN OCR failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: onFailure('run PAN OCR'),
  });

  const aadhaarOcrMutation = useMutation({
    mutationFn: () =>
      ocrAadhaar({ leadId: lead.id, documentUrl: aadhaarDocUrl }),
    onSuccess: (log) => {
      setAadhaarOcrResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Aadhaar OCR complete'
            : 'Aadhaar OCR failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: onFailure('run Aadhaar OCR'),
  });

  return (
    <div
      className='flex flex-col gap-4 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        POI verification / OCR
      </h3>
      <div className='flex flex-col gap-2'>
        <p className='text-foreground/50 text-xs'>
          Fetch and verify PAN details via the vendor.
        </p>
        <div className='flex gap-2'>
          <Input
            placeholder='PAN number'
            value={pan}
            onChange={(e) => setPan(e.target.value)}
            className='flex-1'
          />
          <Button
            type='primary'
            size='sm'
            htmlType='button'
            disabled={!pan.trim() || panMutation.isPending}
            onClick={() => panMutation.mutate()}
          >
            {panMutation.isPending ? <Spinner size='sm' /> : 'Verify PAN'}
          </Button>
        </div>
        {panResult && (
          <div className='rounded-md bg-muted p-2 text-sm'>
            <Badge
              variant={
                panResult.status === 'SUCCESS' ? 'success' : 'destructive'
              }
            >
              {panResult.status}
            </Badge>
            {panResult.fatherName && (
              <span className='ml-2'>
                Father's name: {panResult.fatherName}
              </span>
            )}
            {panResult.errors && (
              <p className='mt-1 text-destructive text-xs'>
                {panResult.errors}
              </p>
            )}
          </div>
        )}
      </div>
      <div className='flex flex-col gap-2 border-border/60 border-t pt-3'>
        <p className='text-foreground/50 text-xs'>
          OCR-extract a PAN card image already uploaded for this lead.
        </p>
        <div className='flex gap-2'>
          <DocumentUrlSelect
            documents={documents}
            value={panDocUrl}
            onChange={setPanDocUrl}
            placeholder='PAN card document'
          />
          <Button
            type='secondary'
            size='sm'
            htmlType='button'
            disabled={!panDocUrl || panOcrMutation.isPending}
            onClick={() => panOcrMutation.mutate()}
          >
            {panOcrMutation.isPending ? <Spinner size='sm' /> : 'OCR PAN'}
          </Button>
        </div>
        {panOcrResult && (
          <div className='rounded-md bg-muted p-2 text-sm'>
            <Badge
              variant={
                panOcrResult.status === 'SUCCESS' ? 'success' : 'destructive'
              }
            >
              {panOcrResult.status}
            </Badge>
            {panOcrResult.errors && (
              <p className='mt-1 text-destructive text-xs'>
                {panOcrResult.errors}
              </p>
            )}
          </div>
        )}
      </div>
      <div className='flex flex-col gap-2 border-border/60 border-t pt-3'>
        <p className='text-foreground/50 text-xs'>
          OCR-extract an Aadhaar card image already uploaded for this lead.
        </p>
        <div className='flex gap-2'>
          <DocumentUrlSelect
            documents={documents}
            value={aadhaarDocUrl}
            onChange={setAadhaarDocUrl}
            placeholder='Aadhaar card document'
          />
          <Button
            type='secondary'
            size='sm'
            htmlType='button'
            disabled={!aadhaarDocUrl || aadhaarOcrMutation.isPending}
            onClick={() => aadhaarOcrMutation.mutate()}
          >
            {aadhaarOcrMutation.isPending ? (
              <Spinner size='sm' />
            ) : (
              'OCR Aadhaar'
            )}
          </Button>
        </div>
        {aadhaarOcrResult && (
          <div className='rounded-md bg-muted p-2 text-sm'>
            <Badge
              variant={
                aadhaarOcrResult.status === 'SUCCESS'
                  ? 'success'
                  : 'destructive'
              }
            >
              {aadhaarOcrResult.status}
            </Badge>
            {aadhaarOcrResult.errors && (
              <p className='mt-1 text-destructive text-xs'>
                {aadhaarOcrResult.errors}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** CartBI ("Novel Pattern" internally) bank-statement upload — ports
 * legacy's `CartController::bankAnalysis()`. CartBI processes
 * asynchronously and calls back via its own webhook; there's no
 * GET-results-by-lead endpoint on the backend, so the immediate upload
 * response (or a synchronous "processed" status) is all this card can
 * show — see `docs/BLOCKED.md` for the results-view gap. */
function BankAnalysisCard({ leadId }: { leadId: number }) {
  const [documentId, setDocumentId] = useState('');
  const [uploadLog, setUploadLog] = useState<BankAnalysisLog | null>(null);
  const queryClient = useQueryClient();

  const { data: documents } = useQuery({
    queryKey: ['documents', leadId],
    queryFn: () => listDocuments(leadId),
  });
  const bankStatements = documents?.filter(
    (doc) => doc.documentType?.name === 'BANK STATEMENT',
  );

  const {
    data: result,
    error: resultError,
    isLoading: isResultLoading,
  } = useQuery({
    queryKey: ['bank-analysis-result', leadId],
    queryFn: () => getBankAnalysisResult(leadId),
    retry: false,
  });
  const resultNotReady =
    resultError instanceof ApiError && resultError.status === 404;

  const mutation = useMutation({
    mutationFn: () =>
      uploadBankAnalysis({ leadId, documentId: Number(documentId) }),
    onSuccess: (log) => {
      setUploadLog(log);
      queryClient.invalidateQueries({
        queryKey: ['bank-analysis-result', leadId],
      });
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'Bank statement uploaded to CartBI'
            : 'Bank analysis upload failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not upload bank statement',
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
        Bank analysis (CartBI)
      </h3>
      <p className='text-foreground/50 text-xs'>
        Upload the lead's BANK STATEMENT document for fraud-score/average-
        balance analysis. Results arrive asynchronously via CartBI's callback.
      </p>
      <Select value={documentId} onValueChange={setDocumentId}>
        <SelectTrigger>
          <SelectValue placeholder='Bank statement document' />
        </SelectTrigger>
        <SelectContent>
          {bankStatements?.map((doc) => (
            <SelectItem key={doc.id} value={String(doc.id)}>
              {doc.filePath}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type='primary'
        size='sm'
        htmlType='button'
        className='self-start'
        disabled={!documentId || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? <Spinner size='sm' /> : 'Upload for analysis'}
      </Button>
      {uploadLog && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={uploadLog.status === 'SUCCESS' ? 'success' : 'destructive'}
          >
            {uploadLog.status}
          </Badge>
          {uploadLog.novelReturnDocId && (
            <span className='ml-2'>Doc ID: {uploadLog.novelReturnDocId}</span>
          )}
          {uploadLog.errors && (
            <p className='mt-1 text-destructive text-xs'>{uploadLog.errors}</p>
          )}
        </div>
      )}
      <div className='border-border/60 border-t pt-3'>
        <h4 className='mb-2 font-medium text-foreground/60 text-xs uppercase tracking-wide'>
          Parsed result
        </h4>
        {isResultLoading ? (
          <div className='flex h-10 items-center justify-center'>
            <Spinner size='sm' className='text-primary' />
          </div>
        ) : result ? (
          <dl className='grid grid-cols-2 gap-x-3 gap-y-1 text-xs'>
            <dt className='text-foreground/50'>Bank</dt>
            <dd>{result.bankName ?? '—'}</dd>
            <dt className='text-foreground/50'>Account</dt>
            <dd>
              {result.accountNumber ?? '—'} ({result.ifscCode ?? '—'})
            </dd>
            <dt className='text-foreground/50'>Fraud score</dt>
            <dd>{result.fraudScore ?? '—'}</dd>
            <dt className='text-foreground/50'>Avg balance</dt>
            <dd>{result.averageBalance ?? '—'}</dd>
            <dt className='text-foreground/50'>Avg balance (3mo)</dt>
            <dd>{result.averageBalanceLastThreeMonth ?? '—'}</dd>
            <dt className='text-foreground/50'>Avg balance (6mo)</dt>
            <dd>{result.averageBalanceLastSixMonth ?? '—'}</dd>
          </dl>
        ) : (
          <p className='text-foreground/50 text-xs'>
            {resultNotReady
              ? "No completed analysis yet — upload a statement and wait for CartBI's callback."
              : 'Could not load the parsed result.'}
          </p>
        )}
      </div>
    </div>
  );
}

function VendorVerificationsSection({ lead }: { lead: Lead }) {
  return (
    <div className='flex flex-col gap-6'>
      <h2 className='font-semibold text-lg text-primary'>
        Vendor Verifications
      </h2>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <DigilockerEkycCard leadId={lead.id} />
        <EsignCard lead={lead} />
        <VideoKycCard lead={lead} />
        <FaceMatchCard leadId={lead.id} />
        <BankAnalysisCard leadId={lead.id} />
      </div>
      <PoiVerificationCard lead={lead} />
    </div>
  );
}

function KycTabPage() {
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
      <AccountAggregatorSection leadId={id} lead={lead} />
      <VendorVerificationsSection lead={lead} />
    </>
  );
}
