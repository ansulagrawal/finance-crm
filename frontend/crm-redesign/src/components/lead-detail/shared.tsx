import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, UserCog, Workflow, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  addFollowup,
  assignLead,
  changeLeadStatus,
  type Lead,
  type LeadAssignmentStage,
  rejectLead,
} from '@/lib/leads';
import {
  listMasterStatuses,
  listRejectionReasons,
  listUsersByRole,
  type MasterStatus,
} from '@/lib/lookups';

/** Shared across every lead-detail tab: fetch/mutation helpers, the header
 * actions (change status/assign/reject), and the followup composer. Split
 * out of core-crm's single 6757-line leads.$leadId.tsx so each module tab
 * (screener/cam/disbursal/collections/audit/kyc) can import just this,
 * instead of one file carrying every role's logic together. */

export const STAGE_ROLE: Record<LeadAssignmentStage, string> = {
  SCREENER: 'CR1',
  CREDIT: 'CR2',
  DISBURSAL: 'DS1',
};

export const STAGE_LABEL: Record<LeadAssignmentStage, string> = {
  SCREENER: 'Screener',
  CREDIT: 'Credit manager',
  DISBURSAL: 'Disbursal manager',
};

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(value: string | number | null): string {
  if (value === null || value === '') return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function FollowupRemark({ text }: { text: string }) {
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

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center justify-between border-border/60 border-b py-2.5 last:border-0'>
      <span className='text-foreground/60 text-sm'>{label}</span>
      <span className='font-medium text-sm'>{value}</span>
    </div>
  );
}

export function FollowupForm({ leadId }: { leadId: number }) {
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

export function useLeadActionMutation(
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

export function groupStatusesByStage(
  statuses: MasterStatus[],
  excludeId: number,
) {
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

export function ChangeStatusAction({
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

export function AssignAction({ leadId }: { leadId: number }) {
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

export function RejectAction({ leadId }: { leadId: number }) {
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
