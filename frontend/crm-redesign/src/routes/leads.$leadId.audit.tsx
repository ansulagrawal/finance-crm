import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { formatDateTime } from '@/components/lead-detail/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api';
import {
  getAuditHistory,
  holdAudit,
  LEAD_AUDIT_CASE_TYPE_LABEL,
  type LeadAuditHistoryEntry,
  recommendAudit,
  recordApprovalReason,
  sendBackAudit,
} from '@/lib/audit';
import { getLead } from '@/lib/leads';
import { useHasRole } from '@/lib/roles';

export const Route = createFileRoute('/leads/$leadId/audit')({
  component: AuditTabPage,
});

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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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

function AuditTabPage() {
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

  return <AuditSection leadId={id} />;
}
