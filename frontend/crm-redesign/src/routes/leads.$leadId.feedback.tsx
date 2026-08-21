import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { formatDateTime } from '@/components/lead-detail/shared';
import { Spinner } from '@/components/ui/spinner';
import { listFeedbackForLead, listFeedbackResponses } from '@/lib/feedback';
import { getLead } from '@/lib/leads';

export const Route = createFileRoute('/leads/$leadId/feedback')({
  component: FeedbackTabPage,
});

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
      className='flex animate-fade-in-up flex-col gap-3 rounded-lg border border-border bg-white p-5'
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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

function FeedbackTabPage() {
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

  return <FeedbackSection leadId={id} />;
}
