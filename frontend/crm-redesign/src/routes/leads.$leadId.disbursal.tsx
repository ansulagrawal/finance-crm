import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  formatCurrency,
  formatDateTime,
  InfoRow,
} from '@/components/lead-detail/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  closeLoan,
  createLoan,
  createTransaction,
  DISBURSEMENT_TRANSACTION_STATUS_LABEL,
  type DisbursementTransactionStatus,
  disburseLoan,
  getLoan,
  LOAN_PAYMENT_MODE_LABEL,
  LOAN_PAYMENT_TYPE_LABEL,
  LOAN_STATUS,
  type Loan,
  type LoanPaymentMode,
  type LoanPaymentType,
  listTransactions,
  settleLoan,
  writeOffLoan,
} from '@/lib/disbursal';
import { initiateEnachTransaction } from '@/lib/integrations';
import { changeLeadStatus, getLead } from '@/lib/leads';
import { listDisbursementBanks, listMasterStatuses } from '@/lib/lookups';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/leads/$leadId/disbursal')({
  component: DisbursalTabPage,
});

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

const PAYMENT_MODES: LoanPaymentMode[] = [1, 2];
const PAYMENT_TYPES: LoanPaymentType[] = [1, 2];
const TRANSACTION_STATUSES: DisbursementTransactionStatus[] = [1, 2, 3, 4, 5];

function CreateLoanForm({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const [loanNumber, setLoanNumber] = useState('');

  const mutation = useMutation({
    mutationFn: () => createLoan(leadId, loanNumber.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', leadId] });
      toast({ title: 'Loan created' });
    },
    onError: (error) => {
      toast({
        title: 'Could not create loan',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (loanNumber.trim()) mutation.mutate();
      }}
      className='flex gap-2'
    >
      <Input
        placeholder='Loan number'
        value={loanNumber}
        onChange={(event) => setLoanNumber(event.target.value)}
      />
      <Button
        type='primary'
        size='sm'
        htmlType='submit'
        disabled={!loanNumber.trim() || mutation.isPending}
      >
        {mutation.isPending ? <Spinner size='sm' /> : 'Create loan'}
      </Button>
    </form>
  );
}

function DisburseLoanAction({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const [bankId, setBankId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [referenceNo, setReferenceNo] = useState('');

  const { data: banks } = useQuery({
    queryKey: ['disbursement-banks'],
    queryFn: listDisbursementBanks,
  });

  const mutation = useMutation({
    mutationFn: () =>
      disburseLoan(leadId, {
        disbursementBankId: Number(bankId),
        paymentMode: Number(paymentMode) as LoanPaymentMode,
        paymentType: Number(paymentType) as LoanPaymentType,
        disbursementReferenceNo: referenceNo || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', leadId] });
      toast({ title: 'Loan disbursed' });
    },
    onError: (error) => {
      toast({
        title: 'Could not disburse loan',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal>
      <ModalTrigger asChild>
        <Button type='primary' size='sm' htmlType='button'>
          Disburse
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Disburse loan</ModalTitle>
          <ModalDescription>
            Pick the settlement bank and payment details.
          </ModalDescription>
        </ModalHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Bank</Label>
            <Select value={bankId} onValueChange={setBankId}>
              <SelectTrigger>
                <SelectValue placeholder='Select bank' />
              </SelectTrigger>
              <SelectContent>
                {banks?.map((bank) => (
                  <SelectItem key={bank.id} value={String(bank.id)}>
                    {bank.accountNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Payment mode</Label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger>
                <SelectValue placeholder='Select mode' />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={String(mode)}>
                    {LOAN_PAYMENT_MODE_LABEL[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Payment type</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger>
                <SelectValue placeholder='Select type' />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={String(type)}>
                    {LOAN_PAYMENT_TYPE_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Reference number</Label>
            <Input
              value={referenceNo}
              onChange={(event) => setReferenceNo(event.target.value)}
              placeholder='Optional'
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <ModalClose asChild>
            <Button
              type='primary'
              htmlType='button'
              disabled={
                !bankId || !paymentMode || !paymentType || mutation.isPending
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? <Spinner size='sm' /> : 'Disburse'}
            </Button>
          </ModalClose>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function LoanStatusActions({ leadId, loan }: { leadId: number; loan: Loan }) {
  const queryClient = useQueryClient();

  function useSimpleLoanAction(
    mutationFn: () => Promise<Loan>,
    successTitle: string,
  ) {
    return useMutation({
      mutationFn,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['loan', leadId] });
        toast({ title: successTitle });
      },
      onError: (error) => {
        toast({
          title: 'Action failed',
          description:
            error instanceof ApiError ? error.message : 'Something went wrong.',
          variant: 'destructive',
        });
      },
    });
  }

  const settleMutation = useSimpleLoanAction(
    () => settleLoan(leadId),
    'Loan settled',
  );
  const closeMutation = useSimpleLoanAction(
    () => closeLoan(leadId),
    'Loan closed',
  );
  const writeOffMutation = useSimpleLoanAction(
    () => writeOffLoan(leadId),
    'Loan written off',
  );

  /** `DISBURSED-WAIVED` (`S30`) has no `Loan.status` equivalent in this
   * schema — it's a `Lead.leadStatus` concept only (see
   * `docs/COMPLETED.md`'s `ExportLoanWaived` note), so waiving goes
   * through the generic `changeLeadStatus`, not a dedicated loan mutator
   * like `settle`/`close`/`writeOff`. */
  const { data: waivedStatuses } = useQuery({
    queryKey: ['master-statuses', 'S30'],
    queryFn: () => listMasterStatuses('S30'),
  });
  const waivedStatus = waivedStatuses?.[0];

  const waiveMutation = useMutation({
    mutationFn: () => {
      if (!waivedStatus) {
        throw new Error('DISBURSED-WAIVED status is not seeded');
      }
      return changeLeadStatus(leadId, { leadStatusId: waivedStatus.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      toast({ title: 'Loan marked as waived' });
    },
    onError: (error) => {
      toast({
        title: 'Action failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  if (loan.status !== LOAN_STATUS.DISBURSED) return null;

  return (
    <div className='flex gap-2'>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={settleMutation.isPending}
        onClick={() => settleMutation.mutate()}
      >
        {settleMutation.isPending ? <Spinner size='sm' /> : 'Settle'}
      </Button>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={closeMutation.isPending}
        onClick={() => closeMutation.mutate()}
      >
        {closeMutation.isPending ? <Spinner size='sm' /> : 'Close'}
      </Button>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={!waivedStatus || waiveMutation.isPending}
        onClick={() => waiveMutation.mutate()}
      >
        {waiveMutation.isPending ? <Spinner size='sm' /> : 'Waive'}
      </Button>
      <Button
        type='destructive'
        size='sm'
        htmlType='button'
        disabled={writeOffMutation.isPending}
        onClick={() => writeOffMutation.mutate()}
      >
        {writeOffMutation.isPending ? <Spinner size='sm' /> : 'Write off'}
      </Button>
    </div>
  );
}

/** Legacy (`TaskController.php:5425-5491`) sends an outbound email
 * containing a portal link for the customer to self-register their eNACH
 * mandate — not an in-app polling UI. Once that mandate registration number
 * comes back, staff use this action to initiate the actual ICICI eNACH
 * transaction collection against it. */
function SendEnachMandateAction({ loanNumber }: { loanNumber: string }) {
  const [mandateRegistrationNo, setMandateRegistrationNo] = useState('');
  const [requestedAmount, setRequestedAmount] = useState(0);
  const [requestedEndDate, setRequestedEndDate] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof initiateEnachTransaction>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      initiateEnachTransaction({
        loanNumber,
        mandateRegistrationNo: mandateRegistrationNo.trim(),
        requestedAmount,
        requestedEndDate,
      }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'eNACH mandate request sent'
            : 'eNACH mandate request failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not send eNACH mandate request',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit =
    mandateRegistrationNo.trim() && requestedAmount > 0 && requestedEndDate;

  return (
    <div className='flex flex-col gap-2 border-border/60 border-t pt-3'>
      <h3 className='font-medium text-foreground/60 text-xs uppercase tracking-wide'>
        eNACH mandate collection
      </h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        className='flex flex-wrap items-end gap-2'
      >
        <div className='flex flex-col gap-1'>
          <Label>Mandate registration no.</Label>
          <Input
            placeholder='e.g. HDFC6000000012345678'
            value={mandateRegistrationNo}
            onChange={(e) => setMandateRegistrationNo(e.target.value)}
            className='w-48'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label>Amount</Label>
          <NumberInput
            value={requestedAmount}
            onChange={setRequestedAmount}
            min={0}
            step={500}
            className='w-32'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label>End date</Label>
          <DatePicker
            value={requestedEndDate}
            onChange={(e) => setRequestedEndDate(e.target.value)}
          />
        </div>
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Send mandate request'}
        </Button>
      </form>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          <Badge
            variant={result.status === 'SUCCESS' ? 'success' : 'destructive'}
          >
            {result.status}
          </Badge>
          {result.mandateId && (
            <span className='ml-2'>Mandate ID: {result.mandateId}</span>
          )}
          {result.errors && (
            <p className='mt-1 text-destructive text-xs'>{result.errors}</p>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionsList({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const [bankId, setBankId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [status, setStatus] = useState('');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['loan-transactions', leadId],
    queryFn: () => listTransactions(leadId),
  });
  const { data: banks } = useQuery({
    queryKey: ['disbursement-banks'],
    queryFn: listDisbursementBanks,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createTransaction(leadId, {
        disbursementBankId: Number(bankId),
        referenceNo: referenceNo.trim(),
        status: Number(status) as DisbursementTransactionStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['loan-transactions', leadId],
      });
      setBankId('');
      setReferenceNo('');
      setStatus('');
      toast({ title: 'Transaction recorded' });
    },
    onError: (error) => {
      toast({
        title: 'Could not record transaction',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const canSubmit = bankId && referenceNo.trim() && status;

  return (
    <div className='flex flex-col gap-3 border-border/60 border-t pt-3'>
      <h3 className='font-medium text-foreground/60 text-xs uppercase tracking-wide'>
        Transactions
      </h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        className='flex flex-wrap gap-2'
      >
        <Select value={bankId} onValueChange={setBankId}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='Bank' />
          </SelectTrigger>
          <SelectContent>
            {banks?.map((bank) => (
              <SelectItem key={bank.id} value={String(bank.id)}>
                {bank.accountNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder='Reference number'
          value={referenceNo}
          onChange={(event) => setReferenceNo(event.target.value)}
          className='flex-1'
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className='w-40'>
            <SelectValue placeholder='Status' />
          </SelectTrigger>
          <SelectContent>
            {TRANSACTION_STATUSES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {DISBURSEMENT_TRANSACTION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Add'}
        </Button>
      </form>
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : transactions?.length ? (
        transactions.map((tx) => (
          <div
            key={tx.id}
            className='flex items-center justify-between border-border/60 border-b py-2 last:border-0'
          >
            <span className='text-sm'>{tx.referenceNo ?? '—'}</span>
            <div className='flex items-center gap-2'>
              {tx.status && (
                <Badge variant='muted'>
                  {DISBURSEMENT_TRANSACTION_STATUS_LABEL[tx.status]}
                </Badge>
              )}
              <span className='text-foreground/50 text-xs'>
                {formatDateTime(tx.createdAt)}
              </span>
            </div>
          </div>
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>No transactions yet.</p>
      )}
    </div>
  );
}

function DisbursalSection({ leadId }: { leadId: number }) {
  const canManage = useHasRole('DS1');

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', leadId],
    queryFn: () => getLoan(leadId),
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          Disbursal
        </h2>
        {loan && (
          <Badge variant={loanStatusVariant(loan.status)}>{loan.status}</Badge>
        )}
      </div>

      {isLoading ? (
        <div className='flex h-20 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : !loan ? (
        canManage ? (
          <CreateLoanForm leadId={leadId} />
        ) : (
          <p className='text-foreground/50 text-sm'>No loan created yet.</p>
        )
      ) : (
        <>
          <InfoRow label='Loan number' value={loan.loanNumber ?? '—'} />
          <InfoRow
            label='Total payable'
            value={formatCurrency(loan.totalPayable)}
          />
          <InfoRow
            label='Total received'
            value={formatCurrency(loan.totalReceived)}
          />
          <InfoRow
            label='Total outstanding'
            value={formatCurrency(loan.totalOutstanding)}
          />
          <InfoRow
            label='Disbursement bank'
            value={loan.disbursementBank?.accountNumber ?? '—'}
          />
          <InfoRow
            label='Payment'
            value={
              loan.paymentMode && loan.paymentType
                ? `${LOAN_PAYMENT_MODE_LABEL[loan.paymentMode]} · ${LOAN_PAYMENT_TYPE_LABEL[loan.paymentType]}`
                : '—'
            }
          />
          {canManage && (
            <div className='flex gap-2'>
              {loan.status === LOAN_STATUS.PENDING && (
                <DisburseLoanAction leadId={leadId} />
              )}
              <LoanStatusActions leadId={leadId} loan={loan} />
            </div>
          )}
          {canManage && loan.loanNumber && (
            <SendEnachMandateAction loanNumber={loan.loanNumber} />
          )}
          <TransactionsList leadId={leadId} />
        </>
      )}
    </div>
  );
}

function DisbursalTabPage() {
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

  return <DisbursalSection leadId={id} />;
}
