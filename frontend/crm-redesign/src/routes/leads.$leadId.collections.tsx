import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  formatCurrency,
  formatDateTime,
} from '@/components/lead-detail/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  assignCollectionVisit,
  blacklistLead,
  type CollectionVerificationStatus,
  type CollectionVisit,
  createCollectionFollowup,
  createCollectionVisit,
  createPayment,
  listBlacklistEntries,
  listBlacklistReasons,
  listCollectionFollowups,
  listCollectionVisits,
  listFollowupStatuses,
  listFollowupTemplates,
  listFollowupTypes,
  listPaymentModes,
  listPayments,
  renderFollowupTemplateContent,
  updateCollectionVisitStatus,
  type VisitAddressType,
  type VisitFieldStatus,
  verifyPayment,
} from '@/lib/collection';
import { getLoan } from '@/lib/disbursal';
import {
  createRazorpayPaymentLink,
  extractRazorpayShortUrl,
  extractUpiQrString,
  requestUpiCollectionQr,
  sendGenericEmail,
  sendGenericSms,
} from '@/lib/integrations';
import { getLead, type Lead } from '@/lib/leads';
import { listMasterStatuses, listUsersByRole } from '@/lib/lookups';
import { useHasRole } from '@/lib/roles';
import { safeExternalUrl } from '@/lib/safe-url';

export const Route = createFileRoute('/leads/$leadId/collections')({
  component: CollectionsTabPage,
});

const VISIT_STATUS_VARIANT: Record<
  VisitFieldStatus,
  'muted' | 'success' | 'warning' | 'destructive'
> = {
  PENDING: 'muted',
  ASSIGNED: 'warning',
  CANCELLED: 'destructive',
  HOLD: 'warning',
  COMPLETED: 'success',
};

const VERIFICATION_STATUS_VARIANT: Record<
  CollectionVerificationStatus,
  'muted' | 'success' | 'destructive'
> = {
  PENDING: 'muted',
  APPROVED: 'success',
  REJECTED: 'destructive',
};

const VISIT_ADDRESS_TYPES: VisitAddressType[] = ['RESIDENCE', 'OFFICE'];
const VISIT_FIELD_STATUSES: VisitFieldStatus[] = [
  'PENDING',
  'ASSIGNED',
  'CANCELLED',
  'HOLD',
  'COMPLETED',
];
const VERIFICATION_STATUSES: CollectionVerificationStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

function CollectionFollowupsCard({
  lead,
  canManage,
}: {
  lead: Lead;
  canManage: boolean;
}) {
  const leadId = lead.id;
  const queryClient = useQueryClient();
  const [typeId, setTypeId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsTemplateId, setSmsTemplateId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [templateId, setTemplateId] = useState('');

  const { data: followups, isLoading } = useQuery({
    queryKey: ['collection-followups', leadId],
    queryFn: () => listCollectionFollowups(leadId),
  });
  const { data: types } = useQuery({
    queryKey: ['followup-types'],
    queryFn: listFollowupTypes,
    enabled: canManage,
  });
  const { data: statuses } = useQuery({
    queryKey: ['followup-statuses'],
    queryFn: listFollowupStatuses,
    enabled: canManage,
  });

  const selectedTypeName = types
    ?.find((t) => String(t.id) === typeId)
    ?.name.toLowerCase();
  const isSmsType = selectedTypeName === 'sms';
  const isEmailType = selectedTypeName === 'email';

  const { data: templates } = useQuery({
    queryKey: ['followup-templates', isSmsType ? 2 : 4],
    queryFn: () => listFollowupTemplates(isSmsType ? 2 : 4),
    enabled: canManage && (isSmsType || isEmailType),
  });

  const templateMutation = useMutation({
    mutationFn: (selectedTemplateId: number) =>
      renderFollowupTemplateContent(
        leadId,
        selectedTemplateId,
        isSmsType ? 2 : 4,
      ),
    onSuccess: (rendered) => {
      if (isSmsType) {
        setSmsMessage(rendered.content);
      } else {
        setEmailSubject(rendered.subject ?? '');
        setEmailHtml(rendered.content);
      }
    },
    onError: (error) => {
      toast({
        title: 'Could not load template',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const handleTemplateSelect = (value: string) => {
    setTemplateId(value);
    const selected = templates?.find((t) => t.id === Number(value));
    if (isSmsType && selected && 'templateId' in selected) {
      setSmsTemplateId(selected.templateId);
    }
    templateMutation.mutate(Number(value));
  };

  const canSubmit = isSmsType
    ? Boolean(smsMessage.trim() && smsTemplateId.trim())
    : isEmailType
      ? Boolean(emailSubject.trim() && emailHtml.trim())
      : Boolean(typeId);

  const resetForm = () => {
    setTypeId('');
    setStatusId('');
    setRemarks('');
    setSmsMessage('');
    setSmsTemplateId('');
    setEmailSubject('');
    setEmailHtml('');
    setEmailCc('');
    setTemplateId('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const numericTypeId = Number(typeId);
      if (isSmsType) {
        const log = await sendGenericSms({
          leadId,
          mobile: lead.mobile,
          message: smsMessage,
          templateId: smsTemplateId,
          typeId: numericTypeId,
        });
        if (log.apiStatus !== 'SUCCESS') {
          throw new Error(log.errors ?? 'SMS send failed.');
        }
        return createCollectionFollowup(leadId, {
          typeId: numericTypeId,
          remarks: [`SMS sent to ${log.mobile}.`, remarks]
            .filter(Boolean)
            .join(' '),
        });
      }
      if (isEmailType) {
        const log = await sendGenericEmail({
          leadId,
          email: lead.email ?? '',
          cc: emailCc.trim() || undefined,
          subject: emailSubject,
          html: emailHtml,
          typeId: numericTypeId,
        });
        if (log.apiStatus !== 'SUCCESS') {
          throw new Error(log.errors ?? 'Email send failed.');
        }
        return createCollectionFollowup(leadId, {
          typeId: numericTypeId,
          remarks: [`Email sent to ${log.emailAddress}.`, remarks]
            .filter(Boolean)
            .join(' '),
        });
      }
      return createCollectionFollowup(leadId, {
        typeId: numericTypeId,
        statusId: statusId ? Number(statusId) : undefined,
        remarks: remarks || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collection-followups', leadId],
      });
      resetForm();
      toast({ title: 'Followup added' });
    },
    onError: (error) => {
      toast({
        title: 'Could not add followup',
        description:
          error instanceof Error ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Collection followups
      </h2>
      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
          className='flex flex-col gap-2'
        >
          <div className='flex flex-wrap gap-2'>
            <Select
              value={typeId}
              onValueChange={(value) => {
                setTypeId(value);
                setTemplateId('');
              }}
            >
              <SelectTrigger className='w-40'>
                <SelectValue placeholder='Type' />
              </SelectTrigger>
              <SelectContent>
                {types?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isSmsType && !isEmailType && (
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='Status (optional)' />
                </SelectTrigger>
                <SelectContent>
                  {statuses?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              placeholder='Remarks (optional)'
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className='flex-1'
            />
          </div>
          {(isSmsType || isEmailType) && templates && templates.length > 0 && (
            <Select value={templateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Use a template (optional)' />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {'title' in t ? t.title : (t.description ?? t.templateId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isSmsType && (
            <div className='flex flex-wrap gap-2'>
              <Input
                placeholder={`SMS content — will be sent to ${lead.mobile}`}
                value={smsMessage}
                onChange={(event) => setSmsMessage(event.target.value)}
                className='flex-1'
              />
              <Input
                placeholder='DLT template ID'
                value={smsTemplateId}
                onChange={(event) => setSmsTemplateId(event.target.value)}
                className='w-40'
              />
            </div>
          )}
          {isEmailType && (
            <div className='flex flex-col gap-2'>
              <div className='flex flex-wrap gap-2'>
                <Input
                  placeholder={`Subject — will be sent to ${lead.email ?? 'no email on file'}`}
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  className='flex-1'
                />
                <Input
                  placeholder='CC (optional)'
                  value={emailCc}
                  onChange={(event) => setEmailCc(event.target.value)}
                  className='w-48'
                />
              </div>
              <Textarea
                placeholder='Email HTML body'
                value={emailHtml}
                onChange={(event) => setEmailHtml(event.target.value)}
              />
            </div>
          )}
          <Button
            type='primary'
            size='sm'
            htmlType='submit'
            className='self-start'
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Add'}
          </Button>
        </form>
      )}
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : followups?.length ? (
        followups.map((f) => (
          <div
            key={f.id}
            className='flex flex-col gap-0.5 border-border/60 border-b py-2 last:border-0'
          >
            <div className='flex items-center gap-2 text-foreground/50 text-xs'>
              <span>{f.type.name}</span>
              {f.status && (
                <>
                  <span>·</span>
                  <Badge variant='muted'>{f.status.name}</Badge>
                </>
              )}
              <span>·</span>
              <span>{formatDateTime(f.createdAt)}</span>
            </div>
            {f.remarks && <p className='text-sm'>{f.remarks}</p>}
          </div>
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>No followups yet.</p>
      )}
    </div>
  );
}

function CollectionVisitsCard({
  leadId,
  canManage,
}: {
  leadId: number;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [addressType, setAddressType] = useState<VisitAddressType | ''>('');
  const [remarks, setRemarks] = useState('');

  const { data: visits, isLoading } = useQuery({
    queryKey: ['collection-visits', leadId],
    queryFn: () => listCollectionVisits(leadId),
  });
  const { data: fieldExecutives } = useQuery({
    queryKey: ['users-by-role', 'CFE1'],
    queryFn: () => listUsersByRole('CFE1'),
    enabled: canManage,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCollectionVisit(leadId, {
        addressType: addressType as VisitAddressType,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collection-visits', leadId],
      });
      setAddressType('');
      setRemarks('');
      toast({ title: 'Visit scheduled' });
    },
    onError: (error) => {
      toast({
        title: 'Could not schedule visit',
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
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Field visits
      </h2>
      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (addressType) createMutation.mutate();
          }}
          className='flex flex-wrap gap-2'
        >
          <Select
            value={addressType}
            onValueChange={(value) => setAddressType(value as VisitAddressType)}
          >
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Address type' />
            </SelectTrigger>
            <SelectContent>
              {VISIT_ADDRESS_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder='Remarks'
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            className='flex-1'
          />
          <Button
            type='primary'
            size='sm'
            htmlType='submit'
            disabled={!addressType || createMutation.isPending}
          >
            {createMutation.isPending ? <Spinner size='sm' /> : 'Schedule'}
          </Button>
        </form>
      )}
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : visits?.length ? (
        visits.map((visit) => (
          <VisitRow
            key={visit.id}
            leadId={leadId}
            visit={visit}
            canManage={canManage}
            fieldExecutives={fieldExecutives}
          />
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>No visits scheduled yet.</p>
      )}
    </div>
  );
}

function VisitRow({
  leadId,
  visit,
  canManage,
  fieldExecutives,
}: {
  leadId: number;
  visit: CollectionVisit;
  canManage: boolean;
  fieldExecutives: { id: number; name: string }[] | undefined;
}) {
  const queryClient = useQueryClient();
  const [allocatedTo, setAllocatedTo] = useState('');

  const assignMutation = useMutation({
    mutationFn: () =>
      assignCollectionVisit(leadId, visit.id, Number(allocatedTo)),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collection-visits', leadId],
      });
      toast({ title: 'Visit assigned' });
    },
    onError: (error) => {
      toast({
        title: 'Could not assign visit',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (fieldStatus: VisitFieldStatus) =>
      updateCollectionVisitStatus(leadId, visit.id, { fieldStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['collection-visits', leadId],
      });
      toast({ title: 'Visit status updated' });
    },
    onError: (error) => {
      toast({
        title: 'Could not update visit status',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className='flex flex-col gap-2 border-border/60 border-b py-2.5 last:border-0'>
      <div className='flex items-center justify-between'>
        <div className='flex flex-col'>
          <span className='font-medium text-sm'>{visit.addressType}</span>
          <span className='text-foreground/50 text-xs'>
            {visit.allocatedTo?.name ?? 'Unallocated'}
            {visit.remarks && ` · ${visit.remarks}`}
          </span>
        </div>
        <Badge variant={VISIT_STATUS_VARIANT[visit.fieldStatus]}>
          {visit.fieldStatus}
        </Badge>
      </div>
      {canManage && (
        <div className='flex flex-wrap items-center gap-2'>
          <Select value={allocatedTo} onValueChange={setAllocatedTo}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Assign to…' />
            </SelectTrigger>
            <SelectContent>
              {fieldExecutives?.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='secondary'
            size='sm'
            htmlType='button'
            disabled={!allocatedTo || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
          >
            Assign
          </Button>
          <Select
            value=''
            onValueChange={(value) =>
              statusMutation.mutate(value as VisitFieldStatus)
            }
          >
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='Set status' />
            </SelectTrigger>
            <SelectContent>
              {VISIT_FIELD_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function PaymentsCard({
  leadId,
  canManage,
}: {
  leadId: number;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentModeId, setPaymentModeId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [repaymentTypeId, setRepaymentTypeId] = useState('');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', leadId],
    queryFn: () => listPayments(leadId),
  });
  const { data: modes } = useQuery({
    queryKey: ['payment-modes'],
    queryFn: listPaymentModes,
    enabled: canManage,
  });
  const { data: loan } = useQuery({
    queryKey: ['loan', leadId],
    queryFn: () => getLoan(leadId),
    enabled: canManage,
  });
  const { data: statuses } = useQuery({
    queryKey: ['master-statuses', 'S16'],
    queryFn: () => listMasterStatuses('S16'),
    enabled: canManage,
  });

  const canSubmitPayment =
    receivedAmount > 0 &&
    !!loan?.loanNumber &&
    !!repaymentTypeId &&
    referenceNo.trim() !== '';

  const createMutation = useMutation({
    mutationFn: () =>
      createPayment(leadId, {
        receivedAmount,
        loanNumber: loan?.loanNumber as string,
        repaymentTypeId: Number(repaymentTypeId),
        paymentModeId: paymentModeId ? Number(paymentModeId) : undefined,
        referenceNo: referenceNo.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', leadId] });
      setReceivedAmount(0);
      setPaymentModeId('');
      setReferenceNo('');
      setRepaymentTypeId('');
      toast({ title: 'Payment recorded' });
    },
    onError: (error) => {
      toast({
        title: 'Could not record payment',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (vars: {
      paymentId: number;
      verificationStatus: CollectionVerificationStatus;
    }) =>
      verifyPayment(leadId, vars.paymentId, {
        verificationStatus: vars.verificationStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', leadId] });
      toast({ title: 'Payment verification updated' });
    },
    onError: (error) => {
      toast({
        title: 'Could not verify payment',
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
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Payments
      </h2>
      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmitPayment) createMutation.mutate();
          }}
          className='flex flex-wrap items-end gap-2'
        >
          <div className='flex flex-col gap-1'>
            <Label>Amount</Label>
            <NumberInput
              value={receivedAmount}
              onChange={setReceivedAmount}
              min={0}
              step={100}
              className='w-32'
            />
          </div>
          <Select value={paymentModeId} onValueChange={setPaymentModeId}>
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='Mode (optional)' />
            </SelectTrigger>
            <SelectContent>
              {modes?.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={repaymentTypeId} onValueChange={setRepaymentTypeId}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Repayment type' />
            </SelectTrigger>
            <SelectContent>
              {statuses?.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder='Reference no.'
            value={referenceNo}
            onChange={(event) => setReferenceNo(event.target.value)}
            className='flex-1'
          />
          <Button
            type='primary'
            size='sm'
            htmlType='submit'
            disabled={!canSubmitPayment || createMutation.isPending}
          >
            {createMutation.isPending ? <Spinner size='sm' /> : 'Record'}
          </Button>
        </form>
      )}
      {canManage && !loan?.loanNumber && (
        <p className='text-foreground/60 text-xs'>
          No loan number on file for this lead yet — payments can't be recorded
          until disbursal creates one.
        </p>
      )}
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : payments?.length ? (
        payments.map((p) => (
          <div
            key={p.id}
            className='flex items-center justify-between border-border/60 border-b py-2.5 last:border-0'
          >
            <div className='flex flex-col'>
              <span className='font-medium text-sm'>
                {formatCurrency(p.receivedAmount)}
              </span>
              <span className='text-foreground/50 text-xs'>
                {p.paymentMode?.name ?? '—'}
                {p.referenceNo && ` · ${p.referenceNo}`}
              </span>
            </div>
            <div className='flex items-center gap-2'>
              <Badge
                variant={VERIFICATION_STATUS_VARIANT[p.verificationStatus]}
              >
                {p.verificationStatus}
              </Badge>
              {canManage && p.verificationStatus === 'PENDING' && (
                <Select
                  value=''
                  onValueChange={(value) =>
                    verifyMutation.mutate({
                      paymentId: p.id,
                      verificationStatus: value as CollectionVerificationStatus,
                    })
                  }
                >
                  <SelectTrigger className='w-28'>
                    <SelectValue placeholder='Verify' />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_STATUSES.filter((s) => s !== 'PENDING').map(
                      (status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>No payments recorded yet.</p>
      )}
    </div>
  );
}

function BlacklistCard({
  leadId,
  canManage,
}: {
  leadId: number;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [reasonId, setReasonId] = useState('');
  const [remarks, setRemarks] = useState('');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['blacklist-entries', leadId],
    queryFn: () => listBlacklistEntries(leadId),
  });
  const { data: reasons } = useQuery({
    queryKey: ['blacklist-reasons'],
    queryFn: listBlacklistReasons,
    enabled: canManage,
  });

  const mutation = useMutation({
    mutationFn: () =>
      blacklistLead(leadId, {
        reasonId: reasonId ? Number(reasonId) : undefined,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['blacklist-entries', leadId],
      });
      setReasonId('');
      setRemarks('');
      toast({ title: 'Lead blacklisted' });
    },
    onError: (error) => {
      toast({
        title: 'Could not blacklist lead',
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
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Blacklist
      </h2>
      {canManage && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
          className='flex flex-wrap gap-2'
        >
          <Select value={reasonId} onValueChange={setReasonId}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='Reason (optional)' />
            </SelectTrigger>
            <SelectContent>
              {reasons?.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder='Remarks'
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            className='flex-1'
          />
          <Button
            type='destructive'
            size='sm'
            htmlType='submit'
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Blacklist'}
          </Button>
        </form>
      )}
      {isLoading ? (
        <div className='flex h-12 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : entries?.length ? (
        entries.map((entry) => (
          <div
            key={entry.id}
            className='flex flex-col gap-0.5 border-border/60 border-b py-2 last:border-0'
          >
            <div className='flex items-center gap-2 text-foreground/50 text-xs'>
              <Badge variant='destructive'>
                {entry.reason?.name ?? 'No reason given'}
              </Badge>
              <span>{formatDateTime(entry.createdAt)}</span>
            </div>
            {entry.remarks && <p className='text-sm'>{entry.remarks}</p>}
          </div>
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>Not blacklisted.</p>
      )}
    </div>
  );
}

function CollectionSection({ lead }: { lead: Lead }) {
  const canManage = useHasRole('CO1', 'CO2', 'CO3', 'CO4', 'CFE1');

  return (
    <div className='flex flex-col gap-6'>
      <h2 className='font-display font-semibold text-lg text-primary'>
        Collection
      </h2>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <CollectionFollowupsCard lead={lead} canManage={canManage} />
        <CollectionVisitsCard leadId={lead.id} canManage={canManage} />
        <PaymentsCard leadId={lead.id} canManage={canManage} />
        <BlacklistCard leadId={lead.id} canManage={canManage} />
      </div>
      <RazorpayPaymentLinkCard leadId={lead.id} />
      <UpiCollectionCard leadId={lead.id} />
    </div>
  );
}

function UpiCollectionCard({ leadId }: { leadId: number }) {
  const { data: loan } = useQuery({
    queryKey: ['loan', leadId],
    queryFn: () => getLoan(leadId),
  });
  const [amount, setAmount] = useState(0);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof requestUpiCollectionQr>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () => requestUpiCollectionQr({ leadId, amount }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.status === 'SUCCESS'
            ? 'UPI QR requested'
            : 'UPI QR request failed',
        variant: log.status === 'SUCCESS' ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not request UPI collection QR',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const eligible = loan?.status === 'DISBURSED';

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        UPI collection QR
      </h2>
      <p className='text-foreground/50 text-xs'>
        ICICI EazyPay UPI collection QR — only available once the loan is
        disbursed.
      </p>
      <div className='flex items-end gap-2'>
        <div className='flex flex-col gap-1'>
          <Label>Amount</Label>
          <NumberInput
            value={amount}
            onChange={setAmount}
            min={0}
            step={100}
            className='w-32'
            disabled={!eligible}
          />
        </div>
        <Button
          type='primary'
          size='sm'
          htmlType='button'
          disabled={!eligible || amount <= 0 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Request QR'}
        </Button>
      </div>
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
          {extractUpiQrString(result) && (
            <p className='mt-2 break-all text-foreground/70 text-xs'>
              {extractUpiQrString(result)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RazorpayPaymentLinkCard({ leadId }: { leadId: number }) {
  const [minPartialAmount, setMinPartialAmount] = useState(500);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof createRazorpayPaymentLink>
  > | null>(null);

  const mutation = useMutation({
    mutationFn: () => createRazorpayPaymentLink({ leadId, minPartialAmount }),
    onSuccess: (log) => {
      setResult(log);
      toast({
        title:
          log.statusId === 1 ? 'Payment link created' : 'Could not create link',
        variant: log.statusId === 1 ? undefined : 'destructive',
      });
    },
    onError: (error) => {
      toast({
        title: 'Could not create payment link',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const shortUrl = result ? extractRazorpayShortUrl(result) : null;

  return (
    <div
      className='flex flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Razorpay payment link
      </h2>
      <p className='text-foreground/50 text-xs'>
        Sends a repayment link for this lead's disbursed loan's outstanding
        amount (requires an active loan).
      </p>
      <div className='flex items-end gap-2'>
        <div className='flex flex-col gap-1'>
          <Label>Minimum partial amount</Label>
          <NumberInput
            value={minPartialAmount}
            onChange={setMinPartialAmount}
            min={1}
            step={100}
            className='w-40'
          />
        </div>
        <Button
          type='primary'
          size='sm'
          htmlType='button'
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Spinner size='sm' /> : 'Create link'}
        </Button>
      </div>
      {result && (
        <div className='rounded-md bg-muted p-2 text-sm'>
          {safeExternalUrl(shortUrl) ? (
            <a
              href={safeExternalUrl(shortUrl) ?? undefined}
              target='_blank'
              rel='noreferrer'
              className='text-primary hover:underline'
            >
              {shortUrl}
            </a>
          ) : result.errors ? (
            <p className='text-destructive text-xs'>{result.errors}</p>
          ) : (
            <p className='text-foreground/50 text-xs'>
              Link created but no short_url in the response — check the raw log.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CollectionsTabPage() {
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

  return <CollectionSection lead={lead} />;
}
