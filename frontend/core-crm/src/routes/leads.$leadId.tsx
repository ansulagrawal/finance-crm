import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Archive,
  ArrowLeft,
  Download,
  FileText,
  MessageSquarePlus,
  Trash2,
  UserCog,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CustomerSection,
  EmploymentSection,
  ReferencesSection,
} from '@/components/lead-sections';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { ApiError, apiUrl } from '@/lib/api';
import {
  getAuditHistory,
  holdAudit,
  LEAD_AUDIT_CASE_TYPE_LABEL,
  type LeadAuditHistoryEntry,
  recommendAudit,
  recordApprovalReason,
  sendBackAudit,
} from '@/lib/audit';
import {
  BRE_DECISION_LABEL,
  type BreDecision,
  type BreDecisionOrNone,
  type BreRuleResult,
  listBreResults,
  runBre,
  setBreManualDecision,
} from '@/lib/bre';
import {
  CAM_STATUS_LABEL,
  type Cam,
  type CamStatus,
  getCam,
  getFoirCapPercent,
  sanctionCam,
  sendBackCam,
  type UpsertCamInput,
  upsertCam,
} from '@/lib/cam';
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
import { listFeedbackForLead, listFeedbackResponses } from '@/lib/feedback';
import {
  type AaTransaction,
  type AccountAggregatorLog,
  type BankAnalysisLog,
  calculateAddressDistance,
  calculateAddressLatLong,
  createDigilockerUrl,
  createRazorpayPaymentLink,
  createVideoKycSession,
  downloadEsignDocument,
  extractRazorpayShortUrl,
  extractUpiQrString,
  fetchCrifReport,
  getAaAnalyticsReport,
  getAaConsentStatus,
  getAaFiData,
  getAaFiStatus,
  getBankAnalysisResult,
  getDigilockerDetails,
  getDigilockerEaadhaar,
  initiateEnachTransaction,
  initiateEsign,
  ocrAadhaar,
  ocrPan,
  requestAaConsent,
  requestAaFi,
  requestUpiCollectionQr,
  sendGenericEmail,
  sendGenericSms,
  uploadBankAnalysis,
  verifyBankAccount as verifyBankAccountSignzy,
  verifyFaceMatch,
  verifyPan,
  verifyUan,
} from '@/lib/integrations';
import {
  addFollowup,
  assignLead,
  changeLeadStatus,
  type Gender,
  getCustomer,
  getLead,
  type IncomeType,
  type Lead,
  type LeadAssignmentStage,
  type LeadUserType,
  listFollowups,
  rejectLead,
} from '@/lib/leads';
import {
  listDisbursementBanks,
  listMasterStatuses,
  listRejectionReasons,
  listUsersByRole,
  type MasterStatus,
} from '@/lib/lookups';
import { useHasRole } from '@/lib/roles';
import { safeExternalUrl } from '@/lib/safe-url';
import {
  overrideAllocation,
  overrideBankDetail,
  overrideCamDetail,
  overrideEmploymentDetail,
  overridePersonalDetail,
  resetAccountAggregator,
  resetEkyc,
  resetEsign,
} from '@/lib/support';
import {
  createBanking,
  downloadKycZip,
  type LeadDocument,
  listBankAccountStatuses,
  listBanking,
  listDocuments,
  listDocumentTypes,
  recordDocumentDownload,
  removeDocument,
  setBankAccountStatus,
  uploadDocument,
} from '@/lib/verification';

export const Route = createFileRoute('/leads/$leadId')({
  component: LeadDetailPage,
});

const STAGE_ROLE: Record<LeadAssignmentStage, string> = {
  SCREENER: 'CR1',
  CREDIT: 'CR2',
  DISBURSAL: 'DS1',
};

const STAGE_LABEL: Record<LeadAssignmentStage, string> = {
  SCREENER: 'Screener',
  CREDIT: 'Credit manager',
  DISBURSAL: 'Disbursal manager',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value: string | number | null): string {
  if (value === null || value === '') return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function FollowupRemark({ text }: { text: string }) {
  const lines = text.split(/<br\s*\/?>/i);
  return (
    <p className='text-sm'>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line}
        </span>
      ))}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between border-border/60 border-b py-2.5 last:border-0'>
      <span className='text-foreground/60 text-sm'>{label}</span>
      <span className='font-medium text-sm'>{value}</span>
    </div>
  );
}

function FollowupForm({ leadId }: { leadId: number }) {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState('');

  const mutation = useMutation({
    mutationFn: (text: string) => addFollowup(leadId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      setRemarks('');
      toast({ title: 'Remark added' });
    },
    onError: (error) => {
      toast({
        title: 'Could not add remark',
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
        if (!remarks.trim()) return;
        mutation.mutate(remarks.trim());
      }}
      className='flex flex-col gap-2'
    >
      <Textarea
        placeholder='Add a remark…'
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        rows={2}
      />
      <div className='flex justify-end'>
        <Button
          type='primary'
          size='sm'
          htmlType='submit'
          disabled={mutation.isPending || !remarks.trim()}
        >
          {mutation.isPending ? (
            <Spinner size='sm' />
          ) : (
            <>
              <MessageSquarePlus className='size-4' />
              Add remark
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function useLeadActionMutation(
  leadId: number,
  mutationFn: () => Promise<Lead>,
  successTitle: string,
  onDone: () => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast({ title: successTitle });
      onDone();
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

function groupStatusesByStage(statuses: MasterStatus[], excludeId: number) {
  const sorted = statuses
    .filter((status) => status.id !== excludeId)
    .sort(
      (a, b) =>
        (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.sortOrder ?? Number.MAX_SAFE_INTEGER),
    );
  const groups: { stageCode: string; statuses: MasterStatus[] }[] = [];
  for (const status of sorted) {
    const group = groups.at(-1);
    if (group && group.stageCode === status.stageCode) {
      group.statuses.push(status);
    } else {
      groups.push({ stageCode: status.stageCode, statuses: [status] });
    }
  }
  return groups;
}

function ChangeStatusAction({
  leadId,
  currentStatus,
}: {
  leadId: number;
  currentStatus: MasterStatus | null;
}) {
  const [open, setOpen] = useState(false);
  const [statusId, setStatusId] = useState<string>('');
  const [remarks, setRemarks] = useState('');

  const { data: statuses } = useQuery({
    queryKey: ['master-statuses'],
    queryFn: () => listMasterStatuses(),
    enabled: open,
  });

  const groupedStatuses = useMemo(
    () => groupStatusesByStage(statuses ?? [], currentStatus?.id ?? -1),
    [statuses, currentStatus],
  );

  const mutation = useLeadActionMutation(
    leadId,
    () =>
      changeLeadStatus(leadId, {
        leadStatusId: Number(statusId),
        remarks: remarks || undefined,
      }),
    'Status updated',
    () => {
      setOpen(false);
      setStatusId('');
      setRemarks('');
    },
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          <Workflow className='size-4' />
          Change status
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Change status</ModalTitle>
          <ModalDescription>
            Move this lead to a different lifecycle status. Options are grouped
            by stage and the current status is hidden, but legal next-step
            transitions aren't enforced — the backend doesn't reject illegal
            moves either — so double-check before saving.
          </ModalDescription>
        </ModalHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>New status</Label>
            <Select value={statusId} onValueChange={setStatusId}>
              <SelectTrigger>
                <SelectValue placeholder='Select a status' />
              </SelectTrigger>
              <SelectContent>
                {groupedStatuses.map((group) => (
                  <SelectGroup key={group.stageCode}>
                    <SelectLabel>Stage {group.stageCode}</SelectLabel>
                    {group.statuses.map((status) => (
                      <SelectItem key={status.id} value={String(status.id)}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={2}
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
          <Button
            type='primary'
            disabled={!statusId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AssignAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<LeadAssignmentStage | ''>('');
  const [userId, setUserId] = useState<string>('');
  const [remarks, setRemarks] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users-by-role', stage],
    queryFn: () => listUsersByRole(STAGE_ROLE[stage as LeadAssignmentStage]),
    enabled: Boolean(stage),
  });

  const mutation = useLeadActionMutation(
    leadId,
    () =>
      assignLead(leadId, {
        stage: stage as LeadAssignmentStage,
        userId: Number(userId),
        remarks: remarks || undefined,
      }),
    'Lead reassigned',
    () => {
      setOpen(false);
      setStage('');
      setUserId('');
      setRemarks('');
    },
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          <UserCog className='size-4' />
          Assign
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Reassign lead</ModalTitle>
          <ModalDescription>
            Assign the screener, credit manager, or disbursal manager for this
            lead.
          </ModalDescription>
        </ModalHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Stage</Label>
            <Select
              value={stage}
              onValueChange={(value) => {
                setStage(value as LeadAssignmentStage);
                setUserId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a stage' />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_LABEL) as LeadAssignmentStage[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {STAGE_LABEL[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Assign to</Label>
            <Select value={userId} onValueChange={setUserId} disabled={!stage}>
              <SelectTrigger>
                <SelectValue placeholder='Select a user' />
              </SelectTrigger>
              <SelectContent>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={2}
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
          <Button
            type='primary'
            disabled={!stage || !userId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function RejectAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [reasonId, setReasonId] = useState<string>('');
  const [remarks, setRemarks] = useState('');

  const { data: reasons } = useQuery({
    queryKey: ['rejection-reasons'],
    queryFn: listRejectionReasons,
    enabled: open,
  });
  const selectedReason = reasons?.find((r) => String(r.id) === reasonId);

  const mutation = useLeadActionMutation(
    leadId,
    () =>
      rejectLead(leadId, {
        rejectionReasonId: Number(reasonId),
        remarks: remarks || undefined,
      }),
    'Lead rejected',
    () => {
      setOpen(false);
      setReasonId('');
      setRemarks('');
    },
  );

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='destructive' size='sm'>
          <XCircle className='size-4' />
          Reject
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Reject lead</ModalTitle>
          <ModalDescription>
            The customer won't be notified automatically unless the selected
            reason has SMS/email notification enabled.
          </ModalDescription>
        </ModalHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Reason</Label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <SelectTrigger>
                <SelectValue placeholder='Select a reason' />
              </SelectTrigger>
              <SelectContent>
                {reasons?.map((reason) => (
                  <SelectItem key={reason.id} value={String(reason.id)}>
                    {reason.reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReason &&
              (selectedReason.notifyBySms || selectedReason.notifyByEmail) && (
                <p className='text-foreground/60 text-xs'>
                  Customer will be notified by{' '}
                  {[
                    selectedReason.notifyBySms && 'SMS',
                    selectedReason.notifyByEmail && 'email',
                  ]
                    .filter(Boolean)
                    .join(' and ')}
                  .
                </p>
              )}
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={2}
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
          <Button
            type='destructive'
            disabled={!reasonId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Reject lead'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportResetCard({
  leadId,
  title,
  description,
  action,
  successTitle,
}: {
  leadId: number;
  title: string;
  description: string;
  action: (leadId: number) => Promise<void>;
  successTitle: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => action(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: successTitle });
    },
    onError: (error) => {
      toast({
        title: 'Reset failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex flex-col gap-2 rounded-lg border border-border bg-background p-4'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h3 className='font-medium text-sm'>{title}</h3>
      <p className='text-foreground/50 text-xs'>{description}</p>
      <Button
        type='secondary'
        size='sm'
        htmlType='button'
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
        className='self-start'
      >
        {mutation.isPending ? <Spinner size='sm' /> : 'Reset'}
      </Button>
    </div>
  );
}

function SupportAllocationAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<LeadAssignmentStage | ''>('');
  const [userId, setUserId] = useState('');
  const [remarks, setRemarks] = useState('');
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ['users-by-role', stage],
    queryFn: () => listUsersByRole(STAGE_ROLE[stage as LeadAssignmentStage]),
    enabled: Boolean(stage),
  });

  const mutation = useMutation({
    mutationFn: () =>
      overrideAllocation(leadId, {
        stage: stage as LeadAssignmentStage,
        userId: Number(userId),
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Allocation overridden' });
      setOpen(false);
      setStage('');
      setUserId('');
      setRemarks('');
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          <UserCog className='size-4' />
          Override allocation
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override allocation</ModalTitle>
          <ModalDescription>
            Reassign ownership outside the normal workflow, bypassing the usual
            stage/role rules. Also clears any rejection metadata on this lead.
          </ModalDescription>
        </ModalHeader>
        <div className='flex flex-col gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Stage</Label>
            <Select
              value={stage}
              onValueChange={(value) => {
                setStage(value as LeadAssignmentStage);
                setUserId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a stage' />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_LABEL) as LeadAssignmentStage[]).map(
                  (key) => (
                    <SelectItem key={key} value={key}>
                      {STAGE_LABEL[key]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Assign to</Label>
            <Select value={userId} onValueChange={setUserId} disabled={!stage}>
              <SelectTrigger>
                <SelectValue placeholder='Select a user' />
              </SelectTrigger>
              <SelectContent>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={2}
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
          <Button
            type='primary'
            disabled={!stage || !userId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportPersonalOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [surName, setSurName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [pancard, setPancard] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const queryClient = useQueryClient();

  const reset = () => {
    setFirstName('');
    setSurName('');
    setMobile('');
    setEmail('');
    setPancard('');
    setAadhaarNumber('');
    setDob('');
    setGender('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overridePersonalDetail(leadId, {
        firstName: firstName || undefined,
        surName: surName || undefined,
        mobile: mobile || undefined,
        email: email || undefined,
        pancard: pancard || undefined,
        aadhaarNumber: aadhaarNumber || undefined,
        dob: dob || undefined,
        gender: gender || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-customer', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Personal detail overridden' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override personal detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override personal detail</ModalTitle>
          <ModalDescription>
            Only fields filled in below are changed — leave the rest blank. For
            full-field edits, use the Customer (KYC) section instead.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>First name</Label>
            <Input
              placeholder='e.g. Ramesh'
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Surname</Label>
            <Input
              placeholder='e.g. Kumar'
              value={surName}
              onChange={(e) => setSurName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Mobile</Label>
            <Input
              placeholder='10-digit mobile number'
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Email</Label>
            <Input
              placeholder='name@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>PAN</Label>
            <Input
              placeholder='ABCDE1234F'
              value={pancard}
              onChange={(e) => setPancard(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Aadhaar</Label>
            <Input
              placeholder='12-digit Aadhaar number'
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Date of birth</Label>
            <DatePicker value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Gender</Label>
            <Select
              value={gender}
              onValueChange={(value) => setGender(value as Gender)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select' />
              </SelectTrigger>
              <SelectContent>
                {(['MALE', 'FEMALE', 'OTHER'] as Gender[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportEmploymentOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [incomeType, setIncomeType] = useState<IncomeType | ''>('');
  const [monthlyIncome, setMonthlyIncome] = useState<number | undefined>();
  const [employerName, setEmployerName] = useState('');
  const [designation, setDesignation] = useState('');
  const [salaryMode, setSalaryMode] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setIncomeType('');
    setMonthlyIncome(undefined);
    setEmployerName('');
    setDesignation('');
    setSalaryMode('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overrideEmploymentDetail(leadId, {
        incomeType: incomeType as 'SALARIED' | 'SELF_EMPLOYED',
        monthlyIncome,
        employerName: employerName || undefined,
        designation: designation || undefined,
        salaryMode: salaryMode || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-employment', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Employment detail overridden' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override employment detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override employment detail</ModalTitle>
          <ModalDescription>
            Income type is required; leave other fields blank to leave them
            unchanged. For full-field edits, use the Employment section instead.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Income type</Label>
            <Select
              value={incomeType}
              onValueChange={(value) => setIncomeType(value as IncomeType)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='SALARIED'>Salaried</SelectItem>
                <SelectItem value='SELF_EMPLOYED'>Self employed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Monthly income</Label>
            <NumberInput
              value={monthlyIncome ?? 0}
              onChange={setMonthlyIncome}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Employer name</Label>
            <Input
              placeholder='e.g. Infosys Ltd'
              value={employerName}
              onChange={(e) => setEmployerName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Designation</Label>
            <Input
              placeholder='e.g. Senior Executive'
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Salary mode</Label>
            <Input
              placeholder='e.g. Bank transfer'
              value={salaryMode}
              onChange={(e) => setSalaryMode(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={!incomeType || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportBankOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [branch, setBranch] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setBankName('');
    setIfscCode('');
    setAccountNumber('');
    setConfirmAccountNumber('');
    setBeneficiaryName('');
    setBranch('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overrideBankDetail(leadId, {
        bankName,
        ifscCode,
        accountNumber,
        confirmAccountNumber,
        beneficiaryName,
        branch: branch || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-banking', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'Bank detail added' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const valid =
    bankName.trim() &&
    ifscCode.trim() &&
    accountNumber.trim() &&
    confirmAccountNumber.trim() === accountNumber.trim() &&
    beneficiaryName.trim();

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override bank detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Add/correct bank detail</ModalTitle>
          <ModalDescription>
            Adds a new banking record for this lead, same as the Verification
            section's banking form.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Bank name</Label>
            <Input
              placeholder='e.g. HDFC Bank'
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>IFSC code</Label>
            <Input
              placeholder='e.g. HDFC0001234'
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Account number</Label>
            <Input
              placeholder='Bank account number'
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Confirm account number</Label>
            <Input
              placeholder='Re-enter the account number'
              value={confirmAccountNumber}
              onChange={(e) => setConfirmAccountNumber(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Beneficiary name</Label>
            <Input
              placeholder='Name as per bank records'
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Branch</Label>
            <Input
              placeholder='e.g. Jaipur Main'
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
        </div>
        {accountNumber.trim() &&
          confirmAccountNumber.trim() &&
          accountNumber.trim() !== confirmAccountNumber.trim() && (
            <p className='text-destructive text-xs'>
              Account numbers don't match.
            </p>
          )}
        <ModalFooter>
          <ModalClose asChild>
            <Button type='secondary' htmlType='button'>
              Cancel
            </Button>
          </ModalClose>
          <Button
            type='primary'
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportCamOverrideAction({ leadId }: { leadId: number }) {
  const [open, setOpen] = useState(false);
  const [recommendedLoanAmount, setRecommendedLoanAmount] = useState(0);
  const [roi, setRoi] = useState(0);
  const [tenureDays, setTenureDays] = useState(0);
  const [netDisbursalAmount, setNetDisbursalAmount] = useState(0);
  const [repaymentAmount, setRepaymentAmount] = useState(0);
  const [appraisedMonthlyIncome, setAppraisedMonthlyIncome] = useState(0);
  const [appraisedObligations, setAppraisedObligations] = useState(0);
  const [remarks, setRemarks] = useState('');
  const queryClient = useQueryClient();

  const reset = () => {
    setRecommendedLoanAmount(0);
    setRoi(0);
    setTenureDays(0);
    setNetDisbursalAmount(0);
    setRepaymentAmount(0);
    setAppraisedMonthlyIncome(0);
    setAppraisedObligations(0);
    setRemarks('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      overrideCamDetail(leadId, {
        recommendedLoanAmount,
        roi,
        tenureDays,
        netDisbursalAmount,
        repaymentAmount,
        appraisedMonthlyIncome,
        appraisedObligations,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'CAM detail overridden' });
      setOpen(false);
      reset();
    },
    onError: (error) => {
      toast({
        title: 'Override failed',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger asChild>
        <Button type='secondary' size='sm'>
          Override CAM detail
        </Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Override CAM detail</ModalTitle>
          <ModalDescription>
            Overwrites the full CAM record (same required fields as the CAM
            section). For fee/FOIR/risk fields, use the CAM section instead.
          </ModalDescription>
        </ModalHeader>
        <div className='grid grid-cols-2 gap-3'>
          <div className='flex flex-col gap-1'>
            <Label>Recommended loan amount</Label>
            <NumberInput
              value={recommendedLoanAmount}
              onChange={setRecommendedLoanAmount}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>ROI (%)</Label>
            <NumberInput value={roi} onChange={setRoi} />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Tenure (days)</Label>
            <NumberInput value={tenureDays} onChange={setTenureDays} />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Net disbursal amount</Label>
            <NumberInput
              value={netDisbursalAmount}
              onChange={setNetDisbursalAmount}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Repayment amount</Label>
            <NumberInput
              value={repaymentAmount}
              onChange={setRepaymentAmount}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Appraised monthly income</Label>
            <NumberInput
              value={appraisedMonthlyIncome}
              onChange={setAppraisedMonthlyIncome}
            />
          </div>
          <div className='flex flex-col gap-1'>
            <Label>Appraised obligations</Label>
            <NumberInput
              value={appraisedObligations}
              onChange={setAppraisedObligations}
            />
          </div>
          <div className='col-span-2 flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
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
          <Button
            type='primary'
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function SupportSection({ leadId }: { leadId: number }) {
  // Legacy grants `ST` (Support Tech) the eKYC/eSign resets specifically,
  // not the rest of this toolkit — see `support.controller.ts`'s
  // `@Roles('ST')` overrides on just those two endpoints.
  const canUse = useHasRole('SA', 'CA', 'ST');
  const canOverride = useHasRole('SA', 'CA');
  if (!canUse) return null;

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-4 rounded-lg border border-warning/40 bg-warning/5 p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div>
        <h2 className='font-semibold text-lg text-primary'>
          Support toolkit — fix a stuck lead
        </h2>
        <p className='text-foreground/60 text-xs'>
          Ops-only overrides that bypass the normal per-stage workflow. Every
          write here is logged as a followup on this lead. Overrides other than
          the resets below only work while the lead is active and not yet
          disbursed.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
        <SupportResetCard
          leadId={leadId}
          title='Reset eKYC link'
          description='Deactivates the latest eKYC log so the customer can restart it.'
          action={resetEkyc}
          successTitle='eKYC link reset'
        />
        <SupportResetCard
          leadId={leadId}
          title='Reset eSign link'
          description='Deactivates the latest eSign log so the customer can restart it.'
          action={resetEsign}
          successTitle='eSign link reset'
        />
        {canOverride && (
          <SupportResetCard
            leadId={leadId}
            title='Reset Account Aggregator consent'
            description='Deactivates the latest AA consent so the customer can restart it.'
            action={resetAccountAggregator}
            successTitle='AA consent reset'
          />
        )}
      </div>
      {canOverride && (
        <div className='flex flex-wrap gap-2'>
          <SupportAllocationAction leadId={leadId} />
          <SupportPersonalOverrideAction leadId={leadId} />
          <SupportEmploymentOverrideAction leadId={leadId} />
          <SupportBankOverrideAction leadId={leadId} />
          <SupportCamOverrideAction leadId={leadId} />
        </div>
      )}
    </div>
  );
}

const CAM_STATUS_VARIANT: Record<CamStatus, 'muted' | 'success'> = {
  0: 'muted',
  1: 'success',
};

function CamReadOnlyView({ leadId, cam }: { leadId: number; cam: Cam }) {
  return (
    <>
      <InfoRow
        label='Recommended amount'
        value={formatCurrency(cam.recommendedLoanAmount)}
      />
      <InfoRow label='ROI' value={`${cam.roi}%`} />
      <InfoRow label='Tenure' value={`${cam.tenureDays} days`} />
      <InfoRow
        label='Net disbursal amount'
        value={formatCurrency(cam.netDisbursalAmount)}
      />
      <InfoRow
        label='Repayment amount'
        value={formatCurrency(cam.repaymentAmount)}
      />
      <InfoRow
        label='Final FOIR'
        value={cam.finalFoirPercentage ? `${cam.finalFoirPercentage}%` : '—'}
      />
      <InfoRow label='Risk profile' value={cam.riskProfile ?? '—'} />
      {cam.remarks && <InfoRow label='Remarks' value={cam.remarks} />}
      {cam.status === 1 && (
        <a
          href={apiUrl(`/api/v1/leads/${leadId}/sanction-letter`)}
          target='_blank'
          rel='noreferrer'
          className='mt-3 flex items-center gap-1.5 text-primary text-sm hover:underline'
        >
          <FileText className='size-4' />
          View sanction letter
        </a>
      )}
    </>
  );
}

function CamForm({
  leadId,
  cam,
  userType,
  appliedLoanAmount,
}: {
  leadId: number;
  cam: Cam | null;
  userType: LeadUserType;
  appliedLoanAmount: number | null;
}) {
  const queryClient = useQueryClient();
  const foirCapPercent = getFoirCapPercent(userType);
  // Mirrors the backend's flat-FOIR eligible-amount calc (CamService
  // .eligibleLoanAmount()) for early client-side feedback - the backend's
  // own @IsPositive()-backed check remains authoritative regardless; this
  // is an early warning for the common case, not a security boundary.
  const eligibleLoanAmount = (
    appraisedMonthlyIncome: number,
    appraisedObligations: number,
  ) =>
    Math.round(
      (appraisedMonthlyIncome - appraisedObligations) * (foirCapPercent / 100),
    );

  const saveMutation = useMutation({
    mutationFn: (dto: UpsertCamInput) => upsertCam(leadId, dto),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      form.setFieldValue('repaymentDate', data.repaymentDate ?? '');
      if (
        variables.repaymentDate &&
        data.repaymentDate &&
        variables.repaymentDate !== data.repaymentDate
      ) {
        toast({
          title: 'Repayment date adjusted',
          description: `Shifted to ${data.repaymentDate} (Sunday/holiday adjustment).`,
        });
      } else {
        toast({ title: 'CAM saved' });
      }
    },
    onError: (error) => {
      toast({
        title: 'Could not save CAM',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const sanctionMutation = useMutation({
    mutationFn: () => sanctionCam(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'CAM sanctioned' });
    },
    onError: (error) => {
      toast({
        title: 'Could not sanction CAM',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const sendBackMutation = useMutation({
    mutationFn: (remarks: string) => sendBackCam(leadId, remarks || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cam', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-followups', leadId] });
      toast({ title: 'CAM sent back' });
    },
    onError: (error) => {
      toast({
        title: 'Could not send back CAM',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm({
    defaultValues: {
      recommendedLoanAmount: cam ? Number(cam.recommendedLoanAmount) : 0,
      roi: cam ? Number(cam.roi) : 0,
      penalRoi: cam?.penalRoi ? Number(cam.penalRoi) : 0,
      tenureDays: cam?.tenureDays ?? 0,
      processingFeePercent: cam?.processingFeePercent
        ? Number(cam.processingFeePercent)
        : 0,
      adminFee: cam?.adminFee ? Number(cam.adminFee) : 0,
      netDisbursalAmount: cam ? Number(cam.netDisbursalAmount) : 0,
      repaymentAmount: cam ? Number(cam.repaymentAmount) : 0,
      disbursalDate: cam?.disbursalDate ?? '',
      repaymentDate: cam?.repaymentDate ?? '',
      eligibleFoirPercentage: cam?.eligibleFoirPercentage
        ? Number(cam.eligibleFoirPercentage)
        : 0,
      finalFoirPercentage: cam?.finalFoirPercentage
        ? Number(cam.finalFoirPercentage)
        : 0,
      appraisedMonthlyIncome: cam?.appraisedMonthlyIncome
        ? Number(cam.appraisedMonthlyIncome)
        : 0,
      appraisedObligations: cam?.appraisedObligations
        ? Number(cam.appraisedObligations)
        : 0,
      riskProfile: cam?.riskProfile ?? '',
      riskScore: cam?.riskScore ? Number(cam.riskScore) : 0,
      remarks: cam?.remarks ?? '',
    },
    onSubmit: ({ value }) => {
      saveMutation.mutate({
        recommendedLoanAmount: value.recommendedLoanAmount,
        roi: value.roi,
        penalRoi: value.penalRoi || undefined,
        tenureDays: value.tenureDays,
        processingFeePercent: value.processingFeePercent || undefined,
        adminFee: value.adminFee || undefined,
        netDisbursalAmount: value.netDisbursalAmount,
        repaymentAmount: value.repaymentAmount,
        disbursalDate: value.disbursalDate || undefined,
        repaymentDate: value.repaymentDate || undefined,
        eligibleFoirPercentage: value.eligibleFoirPercentage || undefined,
        finalFoirPercentage: value.finalFoirPercentage || undefined,
        appraisedMonthlyIncome: value.appraisedMonthlyIncome || undefined,
        appraisedObligations: value.appraisedObligations || undefined,
        riskProfile: value.riskProfile || undefined,
        riskScore: value.riskScore || undefined,
        remarks: value.remarks || undefined,
      });
    },
  });

  const [sendBackRemarks, setSendBackRemarks] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
      className='flex flex-col gap-3'
    >
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <form.Field
          name='recommendedLoanAmount'
          validators={{
            onChangeListenTo: [
              'appraisedMonthlyIncome',
              'appraisedObligations',
            ],
            onChange: ({ value, fieldApi }) => {
              if (appliedLoanAmount != null && value > appliedLoanAmount) {
                return `Cannot exceed the applied loan amount (${formatCurrency(appliedLoanAmount)})`;
              }
              const income = fieldApi.form.getFieldValue(
                'appraisedMonthlyIncome',
              );
              const obligations = fieldApi.form.getFieldValue(
                'appraisedObligations',
              );
              const eligible = eligibleLoanAmount(income, obligations);
              if (value > eligible) {
                return `Cannot exceed the eligible loan amount (${formatCurrency(eligible)})`;
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Recommended amount</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1000}
              />
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='roi'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>ROI (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='penalRoi'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Penal ROI (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='tenureDays'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Tenure (days)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={1}
                step={1}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='processingFeePercent'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Processing fee (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='adminFee'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Admin fee</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={50}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='netDisbursalAmount'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Net disbursal amount</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1000}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='repaymentAmount'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Repayment amount</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1000}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='disbursalDate'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Disbursal date</Label>
              <DatePicker
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='repaymentDate'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Repayment date</Label>
              <DatePicker
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='eligibleFoirPercentage'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Eligible FOIR (%)</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                max={100}
                step={1}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='finalFoirPercentage'>
          {(field) => {
            const overCap = field.state.value >= foirCapPercent;
            return (
              <div className='flex flex-col gap-1'>
                <Label>Final FOIR (%)</Label>
                <NumberInput
                  value={field.state.value}
                  onChange={field.handleChange}
                  min={0}
                  max={100}
                  step={1}
                />
                {overCap && (
                  <p className='text-destructive text-xs'>
                    FOIR cannot be {foirCapPercent}% or above for a{' '}
                    {userType === 'NEW' ? 'new' : 'repeat'} customer — sanction
                    is blocked until this is brought down.
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>
        <form.Field
          name='appraisedMonthlyIncome'
          validators={{
            onChange: ({ value }) =>
              value > 0 ? undefined : 'Appraised monthly income is required',
          }}
        >
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Appraised monthly income</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={500}
              />
              {field.state.meta.errors.length > 0 && (
                <span className='text-destructive text-xs'>
                  {field.state.meta.errors.join(', ')}
                </span>
              )}
            </div>
          )}
        </form.Field>
        <form.Field name='appraisedObligations'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Appraised obligations</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={500}
              />
            </div>
          )}
        </form.Field>
        <form.Field name='riskProfile'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Risk profile</Label>
              <Input
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder='Low / Medium / High'
              />
            </div>
          )}
        </form.Field>
        <form.Field name='riskScore'>
          {(field) => (
            <div className='flex flex-col gap-1'>
              <Label>Risk score</Label>
              <NumberInput
                value={field.state.value}
                onChange={field.handleChange}
                min={0}
                step={1}
              />
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name='remarks'>
        {(field) => (
          <div className='flex flex-col gap-1'>
            <Label>Remarks</Label>
            <Textarea
              placeholder='Add a note (optional)'
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              rows={2}
            />
          </div>
        )}
      </form.Field>

      <div className='flex flex-wrap items-center gap-2 border-border/60 border-t pt-3'>
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              type='primary'
              htmlType='submit'
              size='sm'
              disabled={!canSubmit || saveMutation.isPending}
            >
              {saveMutation.isPending ? <Spinner size='sm' /> : 'Save CAM'}
            </Button>
          )}
        </form.Subscribe>
        {cam && cam.status !== 1 && (
          <form.Subscribe
            selector={(state) => state.values.finalFoirPercentage}
          >
            {(finalFoirPercentage) => {
              const foirOverCap = finalFoirPercentage >= foirCapPercent;
              return (
                <Button
                  type='secondary'
                  size='sm'
                  htmlType='button'
                  disabled={sanctionMutation.isPending || foirOverCap}
                  title={
                    foirOverCap
                      ? `Final FOIR must be below ${foirCapPercent}% to sanction`
                      : undefined
                  }
                  onClick={() => sanctionMutation.mutate()}
                >
                  {sanctionMutation.isPending ? (
                    <Spinner size='sm' />
                  ) : (
                    'Sanction'
                  )}
                </Button>
              );
            }}
          </form.Subscribe>
        )}
        {cam && (
          <Modal>
            <ModalTrigger asChild>
              <Button type='destructive' size='sm' htmlType='button'>
                Send back
              </Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Send CAM back</ModalTitle>
                <ModalDescription>
                  Returns this CAM for revision. This doesn't currently change
                  the lead's own status — confirm that's the intended behavior
                  before relying on it.
                </ModalDescription>
              </ModalHeader>
              <Textarea
                value={sendBackRemarks}
                onChange={(event) => setSendBackRemarks(event.target.value)}
                rows={2}
                placeholder='Remarks (optional)'
              />
              <ModalFooter>
                <ModalClose asChild>
                  <Button type='secondary' htmlType='button'>
                    Cancel
                  </Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button
                    type='destructive'
                    htmlType='button'
                    disabled={sendBackMutation.isPending}
                    onClick={() => sendBackMutation.mutate(sendBackRemarks)}
                  >
                    {sendBackMutation.isPending ? (
                      <Spinner size='sm' />
                    ) : (
                      'Send back'
                    )}
                  </Button>
                </ModalClose>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
        {cam?.status === 1 && (
          <a
            href={apiUrl(`/api/v1/leads/${leadId}/sanction-letter`)}
            target='_blank'
            rel='noreferrer'
            className='flex items-center gap-1.5 text-primary text-sm hover:underline'
          >
            <FileText className='size-4' />
            View sanction letter
          </a>
        )}
      </div>
    </form>
  );
}

function CamSection({
  leadId,
  userType,
  appliedLoanAmount,
}: {
  leadId: number;
  userType: LeadUserType;
  appliedLoanAmount: number | null;
}) {
  const canEdit = useHasRole('CR2', 'CR3');

  const { data: cam, isLoading } = useQuery({
    queryKey: ['cam', leadId],
    queryFn: () => getCam(leadId),
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          Credit analysis memo
        </h2>
        {cam && cam.status !== null && (
          <Badge variant={CAM_STATUS_VARIANT[cam.status]}>
            {CAM_STATUS_LABEL[cam.status]}
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className='flex h-20 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : canEdit ? (
        <CamForm
          key={cam?.id ?? 'new'}
          leadId={leadId}
          cam={cam ?? null}
          userType={userType}
          appliedLoanAmount={appliedLoanAmount}
        />
      ) : cam ? (
        <CamReadOnlyView leadId={leadId} cam={cam} />
      ) : (
        <p className='text-foreground/50 text-sm'>No CAM yet.</p>
      )}
    </div>
  );
}

const BRE_DECISION_VARIANT: Record<
  BreDecisionOrNone,
  'muted' | 'success' | 'destructive' | 'warning'
> = {
  0: 'muted',
  1: 'success',
  2: 'warning',
  3: 'destructive',
};

const BRE_DECISIONS: BreDecision[] = [1, 2, 3];

function BreResultRow({
  leadId,
  result,
  canOverride,
}: {
  leadId: number;
  result: BreRuleResult;
  canOverride: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<string>(
    result.manualDecision ? String(result.manualDecision) : '',
  );
  const [remarks, setRemarks] = useState(result.manualDecisionRemarks ?? '');

  const mutation = useMutation({
    mutationFn: () =>
      setBreManualDecision(leadId, result.id, {
        manualDecision: Number(decision) as BreDecision,
        manualDecisionRemarks: remarks || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-results', leadId] });
      toast({ title: 'Decision overridden' });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: 'Could not override decision',
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
          <span className='font-medium text-sm'>{result.rule.name}</span>
          <span className='text-foreground/50 text-xs'>
            {result.rule.category.name}
            {result.cutoffValue && ` · cutoff ${result.cutoffValue}`}
            {result.actualValue && ` · actual ${result.actualValue}`}
          </span>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant={BRE_DECISION_VARIANT[result.systemDecision]}>
            {BRE_DECISION_LABEL[result.systemDecision]}
          </Badge>
          {result.manualDecision !== 0 && (
            <Badge variant={BRE_DECISION_VARIANT[result.manualDecision]}>
              override: {BRE_DECISION_LABEL[result.manualDecision]}
            </Badge>
          )}
          {canOverride && (
            <Button
              type='ghost'
              size='sm'
              htmlType='button'
              onClick={() => setOpen((o) => !o)}
            >
              Override
            </Button>
          )}
        </div>
      </div>
      {open && (
        <div className='flex flex-wrap items-center gap-2 rounded-md bg-muted p-2'>
          <Select value={decision} onValueChange={setDecision}>
            <SelectTrigger className='w-40'>
              <SelectValue placeholder='Decision' />
            </SelectTrigger>
            <SelectContent>
              {BRE_DECISIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {BRE_DECISION_LABEL[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder='Remarks (optional)'
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            className='flex-1'
          />
          <Button
            type='primary'
            size='sm'
            htmlType='button'
            disabled={!decision || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Spinner size='sm' /> : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}

function BreResultsSection({ leadId }: { leadId: number }) {
  // Confirmed against legacy: BreController::saveBreManualDecision() never
  // role-gated this action (only required a logged-in session), and the
  // current backend endpoint has no @Roles() guard either, unlike sibling
  // BRE endpoints — so this is intentionally open to any authenticated user.
  const canOverride = true;
  const queryClient = useQueryClient();
  const { data: results, isLoading } = useQuery({
    queryKey: ['bre-results', leadId],
    queryFn: () => listBreResults(leadId),
  });

  const runMutation = useMutation({
    mutationFn: () => runBre(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bre-results', leadId] });
      toast({ title: 'BRE rule engine run' });
    },
    onError: (error) => {
      toast({
        title: 'Could not run BRE',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-1 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='mb-2 flex items-center justify-between'>
        <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
          BRE results
        </h2>
        <Button
          type='secondary'
          size='sm'
          htmlType='button'
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate()}
        >
          {runMutation.isPending ? <Spinner size='sm' /> : 'Run BRE'}
        </Button>
      </div>
      {isLoading ? (
        <div className='flex h-16 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : results?.length ? (
        results.map((result) => (
          <BreResultRow
            key={result.id}
            leadId={leadId}
            result={result}
            canOverride={canOverride}
          />
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>
          No BRE results recorded for this lead.
        </p>
      )}
    </div>
  );
}

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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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

/** Legacy's `insert_loan_collection_followup()` only inserts the
 * `loan_collection_followup` row unconditionally for the "Call" type — for
 * SMS/Email it sends first (`Collection_Model::send_collection_followup_sms
 * /_email()`) and only logs the followup if the send succeeded. WhatsApp's
 * branch is empty/dead in legacy (never actually sends), which matches its
 * `isActive: false` seed row — `listFollowupTypes()` already excludes it, so
 * no WhatsApp send path exists here. Neither send endpoint has a backend
 * template-picker (see `docs/BLOCKED.md`), so message/subject content here is
 * free text, not templated. */
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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      <h2 className='font-semibold text-lg text-primary'>Collection</h2>
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className='flex items-center justify-between'>
        <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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

/** Ports legacy's `getAddressDistance` checkbox
 * (`VerificationController::calculateAadhaartoLiveLocationDistance()`),
 * which gates the audit straight-through eligibility check's >25km
 * residence-proof requirement (`audit.service.ts`'s
 * `checkStraightThroughEligibility`). Legacy derives the Aadhaar address
 * text server-side and does both steps (geocode, then distance) in one
 * call; this port exposes them as two endpoints, so the address text is
 * composed here from the customer's already-stored current/Aadhaar
 * address fields — not typed in by staff. The live-location half
 * (`ReverseGeocodeLog`) is captured automatically by the mobile app, not
 * staff-triggered — see `docs/BLOCKED.md`. */
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      <h2 className='font-semibold text-lg text-primary'>Verification</h2>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <BankingCard leadId={leadId} canManage={canManage} />
        <DocumentsCard leadId={leadId} canManage={canManage} />
        <ResidenceDistanceCard leadId={leadId} />
      </div>
    </div>
  );
}

function FeedbackResponses({
  leadId,
  feedbackId,
}: {
  leadId: number;
  feedbackId: number;
}) {
  const { data: responses, isLoading } = useQuery({
    queryKey: ['feedback-responses', feedbackId],
    queryFn: () => listFeedbackResponses(leadId, feedbackId),
  });

  if (isLoading) {
    return (
      <div className='flex h-10 items-center justify-center'>
        <Spinner size='sm' className='text-primary' />
      </div>
    );
  }

  if (!responses?.length) {
    return <p className='text-foreground/50 text-xs'>No responses.</p>;
  }

  return (
    <div className='flex flex-col gap-1'>
      {responses.map((r) => (
        <div key={r.id} className='text-sm'>
          <span className='text-foreground/60'>{r.question.question}</span>
          {' — '}
          <span className='font-medium'>{r.answer.answer}</span>
        </div>
      ))}
    </div>
  );
}

function FeedbackSection({ leadId }: { leadId: number }) {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['feedback', leadId],
    queryFn: () => listFeedbackForLead(leadId),
  });

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Customer feedback
      </h2>
      {isLoading ? (
        <div className='flex h-16 items-center justify-center'>
          <Spinner size='sm' className='text-primary' />
        </div>
      ) : submissions?.length ? (
        submissions.map((s) => (
          <div
            key={s.id}
            className='flex flex-col gap-2 border-border/60 border-b py-2.5 last:border-0'
          >
            <div className='flex items-center gap-2 text-foreground/50 text-xs'>
              <span>{s.customerName ?? 'Anonymous'}</span>
              <span>·</span>
              <span>{formatDateTime(s.createdAt)}</span>
            </div>
            {s.remarks && <p className='text-sm'>{s.remarks}</p>}
            <FeedbackResponses leadId={leadId} feedbackId={s.id} />
          </div>
        ))
      ) : (
        <p className='text-foreground/50 text-sm'>No feedback submitted yet.</p>
      )}
    </div>
  );
}

function AuditHistoryRow({ entry }: { entry: LeadAuditHistoryEntry }) {
  return (
    <div className='flex flex-col gap-0.5 border-border/60 border-b py-2 last:border-0'>
      <div className='flex items-center gap-2 text-foreground/50 text-xs'>
        {entry.caseType && (
          <Badge variant='muted'>
            {LEAD_AUDIT_CASE_TYPE_LABEL[entry.caseType]}
          </Badge>
        )}
        {entry.status && <span>{entry.status}</span>}
        {entry.leadStatus && (
          <>
            <span>·</span>
            <span>{entry.leadStatus.name}</span>
          </>
        )}
        <span>·</span>
        <span>{entry.assignedTo?.name ?? 'Unassigned'}</span>
        <span>·</span>
        <span>{entry.createdAt ? formatDateTime(entry.createdAt) : '—'}</span>
      </div>
      {entry.remarks && <p className='text-sm'>{entry.remarks}</p>}
    </div>
  );
}

function AuditSection({ leadId }: { leadId: number }) {
  // Backend gates the whole audit.controller.ts to AU/AM/AH server-side;
  // AM/AH-only actions (recommend, send-back) are further gated there —
  // mirrored here client-side to avoid a round-trip 403.
  const canAct = useHasRole('AU', 'AM', 'AH');
  const canRecommendOrSendBack = useHasRole('AM', 'AH');
  const queryClient = useQueryClient();
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdRemarks, setHoldRemarks] = useState('');
  const [holdDate, setHoldDate] = useState('');
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackRemarks, setSendBackRemarks] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');

  const { data: history, isLoading } = useQuery({
    queryKey: ['audit-history', leadId],
    queryFn: () => getAuditHistory(leadId),
    enabled: canAct,
  });

  function useAuditAction(mutationFn: () => Promise<unknown>) {
    return useMutation({
      mutationFn,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['audit-history', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['audit-queue'] });
        toast({ title: 'Audit action recorded' });
      },
      onError: (error) => {
        toast({
          title: 'Audit action failed',
          description:
            error instanceof ApiError ? error.message : 'Something went wrong.',
          variant: 'destructive',
        });
      },
    });
  }

  const holdMutation = useAuditAction(() =>
    holdAudit(leadId, { remarks: holdRemarks, scheduledAt: holdDate }),
  );
  const recommendMutation = useAuditAction(() => recommendAudit(leadId));
  const sendBackMutation = useAuditAction(() =>
    sendBackAudit(leadId, sendBackRemarks),
  );
  const approvalMutation = useAuditAction(() =>
    recordApprovalReason(leadId, approvalRemarks),
  );

  if (!canAct) return null;

  return (
    <div
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
        Audit
      </h2>
      <p className='text-foreground/50 text-xs'>
        Send to pre-audit / post-audit is a row action on the{' '}
        <Link to='/audit' className='underline'>
          audit queue
        </Link>
        .
      </p>

      <div className='flex flex-wrap items-center gap-2'>
        <Modal open={holdOpen} onOpenChange={setHoldOpen}>
          <ModalTrigger asChild>
            <Button type='secondary' size='sm' htmlType='button'>
              Hold
            </Button>
          </ModalTrigger>
          <ModalContent>
            <ModalHeader>
              <ModalTitle>Put on hold</ModalTitle>
              <ModalDescription>
                Requires a scheduled follow-up date and remarks.
              </ModalDescription>
            </ModalHeader>
            <div className='flex flex-col gap-3'>
              <div className='flex flex-col gap-1'>
                <Label>Scheduled date</Label>
                <DatePicker
                  value={holdDate}
                  onChange={(event) => setHoldDate(event.target.value)}
                />
              </div>
              <div className='flex flex-col gap-1'>
                <Label>Remarks</Label>
                <Textarea
                  placeholder='Add a note (optional)'
                  value={holdRemarks}
                  onChange={(event) => setHoldRemarks(event.target.value)}
                  rows={2}
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
                    !holdRemarks.trim() || !holdDate || holdMutation.isPending
                  }
                  onClick={() => holdMutation.mutate()}
                >
                  {holdMutation.isPending ? <Spinner size='sm' /> : 'Hold'}
                </Button>
              </ModalClose>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {canRecommendOrSendBack && (
          <Button
            type='secondary'
            size='sm'
            htmlType='button'
            disabled={recommendMutation.isPending}
            onClick={() => recommendMutation.mutate()}
          >
            Recommend
          </Button>
        )}

        {canRecommendOrSendBack && (
          <Modal open={sendBackOpen} onOpenChange={setSendBackOpen}>
            <ModalTrigger asChild>
              <Button type='destructive' size='sm' htmlType='button'>
                Send back
              </Button>
            </ModalTrigger>
            <ModalContent>
              <ModalHeader>
                <ModalTitle>Send back for revision</ModalTitle>
                <ModalDescription>
                  Exits the audit sub-lifecycle and returns the lead to
                  APPLICATION-SEND-BACK — a bigger workflow exit than the other
                  actions here.
                </ModalDescription>
              </ModalHeader>
              <Textarea
                value={sendBackRemarks}
                onChange={(event) => setSendBackRemarks(event.target.value)}
                rows={2}
                placeholder='Remarks (required)'
              />
              <ModalFooter>
                <ModalClose asChild>
                  <Button type='secondary' htmlType='button'>
                    Cancel
                  </Button>
                </ModalClose>
                <ModalClose asChild>
                  <Button
                    type='destructive'
                    htmlType='button'
                    disabled={
                      !sendBackRemarks.trim() || sendBackMutation.isPending
                    }
                    onClick={() => sendBackMutation.mutate()}
                  >
                    {sendBackMutation.isPending ? (
                      <Spinner size='sm' />
                    ) : (
                      'Send back'
                    )}
                  </Button>
                </ModalClose>
              </ModalFooter>
            </ModalContent>
          </Modal>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (approvalRemarks.trim()) approvalMutation.mutate();
        }}
        className='flex gap-2'
      >
        <Textarea
          placeholder='Approval reason remarks'
          value={approvalRemarks}
          onChange={(event) => setApprovalRemarks(event.target.value)}
          rows={1}
          className='flex-1'
        />
        <Button
          type='secondary'
          size='sm'
          htmlType='submit'
          disabled={!approvalRemarks.trim() || approvalMutation.isPending}
        >
          {approvalMutation.isPending ? <Spinner size='sm' /> : 'Record'}
        </Button>
      </form>

      <div className='flex flex-col border-border/60 border-t pt-2'>
        {isLoading ? (
          <div className='flex h-12 items-center justify-center'>
            <Spinner size='sm' className='text-primary' />
          </div>
        ) : history?.length ? (
          history.map((entry) => (
            <AuditHistoryRow key={entry.id} entry={entry} />
          ))
        ) : (
          <p className='py-2 text-foreground/50 text-sm'>
            No audit case history yet.
          </p>
        )}
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex animate-fade-in-up flex-col gap-4 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-4 rounded-lg border border-border bg-background p-5'
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
      className='flex flex-col gap-3 rounded-lg border border-border bg-background p-5'
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

function LeadDetailPage() {
  const { leadId } = Route.useParams();
  const id = Number(leadId);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => getLead(id),
  });
  const { data: followups } = useQuery({
    queryKey: ['lead-followups', id],
    queryFn: () => listFollowups(id, { limit: 50 }),
  });

  if (isLoading) {
    return (
      <div className='flex h-40 items-center justify-center'>
        <Spinner className='text-primary' />
      </div>
    );
  }

  if (!lead) {
    return (
      <p className='py-10 text-center text-foreground/60 text-sm'>
        Lead not found.
      </p>
    );
  }

  return (
    <>
      <div className='flex items-center gap-3'>
        <Link
          to='/'
          className='flex items-center gap-1 text-foreground/60 text-sm hover:text-foreground'
        >
          <ArrowLeft className='size-4' />
          Leads
        </Link>
      </div>

      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-semibold text-2xl text-primary'>
            {lead.firstName}
          </h1>
          <p className='text-foreground/60 text-sm'>
            #{lead.id} · {lead.mobile}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant='default'>{lead.leadStatus?.name ?? 'Unknown'}</Badge>
          <ChangeStatusAction leadId={id} currentStatus={lead.leadStatus} />
          <AssignAction leadId={id} />
          <RejectAction leadId={id} />
        </div>
      </div>

      <SupportSection leadId={id} />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]'>
        <div
          className='flex animate-fade-in-up flex-col gap-1 rounded-lg border border-border bg-background p-5'
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <h2 className='mb-2 font-medium text-foreground/70 text-sm uppercase tracking-wide'>
            Lead details
          </h2>
          <InfoRow label='Mobile' value={lead.mobile} />
          <InfoRow label='Email' value={lead.email ?? '—'} />
          <InfoRow label='PAN' value={lead.pancard ?? '—'} />
          <InfoRow
            label='Requested amount'
            value={formatCurrency(lead.loanAmount)}
          />
          <InfoRow
            label='Tenure'
            value={lead.tenureDays ? `${lead.tenureDays} days` : '—'}
          />
          <InfoRow label='Purpose' value={lead.purpose ?? '—'} />
          <InfoRow label='Company' value={lead.company?.name ?? '—'} />
          <InfoRow label='Product' value={lead.product?.name ?? '—'} />
          <InfoRow
            label='Screener'
            value={lead.screenerAssignedTo?.name ?? 'Unassigned'}
          />
          <InfoRow
            label='Credit manager'
            value={lead.creditAssignedTo?.name ?? 'Unassigned'}
          />
          <InfoRow
            label='Disbursal manager'
            value={lead.disbursalAssignedTo?.name ?? 'Unassigned'}
          />
          {lead.rejectionReason && (
            <InfoRow
              label='Rejection reason'
              value={lead.rejectionReason.reason}
            />
          )}
        </div>

        <div
          className='flex animate-fade-in-up flex-col gap-4 rounded-lg border border-border bg-background p-5'
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <h2 className='font-medium text-foreground/70 text-sm uppercase tracking-wide'>
            Followups
          </h2>

          <FollowupForm leadId={id} />

          <div className='flex max-h-80 flex-col gap-3 overflow-y-auto'>
            {followups?.data.length ? (
              followups.data.map((entry) => (
                <div
                  key={entry.id}
                  className='flex flex-col gap-0.5 border-border/60 border-l-2 pl-3'
                >
                  <div className='flex items-center gap-2 text-foreground/50 text-xs'>
                    <span>{entry.user?.name ?? 'System'}</span>
                    <span>·</span>
                    <span>{formatDateTime(entry.createdAt)}</span>
                    {entry.status && (
                      <>
                        <span>·</span>
                        <Badge variant='muted'>{entry.status.name}</Badge>
                      </>
                    )}
                  </div>
                  {entry.remarks && <FollowupRemark text={entry.remarks} />}
                </div>
              ))
            ) : (
              <p className='text-foreground/50 text-sm'>No followups yet.</p>
            )}
          </div>
        </div>
      </div>

      <CustomerSection leadId={id} />
      <EmploymentSection leadId={id} />
      <ReferencesSection leadId={id} />
      <CamSection
        leadId={id}
        userType={lead.userType}
        appliedLoanAmount={lead.loanAmount}
      />
      <BreResultsSection leadId={id} />
      <DisbursalSection leadId={id} />
      <CollectionSection lead={lead} />
      <VerificationSection leadId={id} />
      <BureauVerificationSection lead={lead} />
      <AccountAggregatorSection leadId={id} lead={lead} />
      <VendorVerificationsSection lead={lead} />
      <AuditSection leadId={id} />
      <FeedbackSection leadId={id} />
    </>
  );
}
