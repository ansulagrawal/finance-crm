import { useQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import {
  AssignAction,
  ChangeStatusAction,
  FollowupForm,
  FollowupRemark,
  formatDateTime,
  InfoRow,
  RejectAction,
} from '@/components/lead-detail/shared';
import { SupportSection } from '@/components/lead-detail/support-section';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getLead, listFollowups } from '@/lib/leads';

export const Route = createFileRoute('/leads/$leadId')({
  component: LeadDetailLayout,
});

/** These map to the sibling route files (leads.$leadId.<tab>.tsx) — this is
 * the direct fix for "all in one": each of these used to be a section
 * rendered inline on one giant page; now each is its own URL/route,
 * mirroring the old app's separate per-module views. */
const TABS = [
  { to: '/leads/$leadId', label: 'Overview' },
  { to: '/leads/$leadId/screener', label: 'Screener' },
  { to: '/leads/$leadId/cam', label: 'CAM & BRE' },
  { to: '/leads/$leadId/disbursal', label: 'Disbursal' },
  { to: '/leads/$leadId/collections', label: 'Collections' },
  { to: '/leads/$leadId/audit', label: 'Audit' },
  { to: '/leads/$leadId/kyc', label: 'KYC & Vendor' },
  { to: '/leads/$leadId/feedback', label: 'Feedback' },
] as const;

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function LeadDetailLayout() {
  const { leadId } = Route.useParams();
  const id = Number(leadId);
  const pathname = useRouterState({
    select: (state) => (state.resolvedLocation ?? state.location).pathname,
  });

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
          <h1 className='font-display font-semibold text-2xl text-primary'>
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
          className='flex animate-fade-in-up flex-col gap-1 rounded-lg border border-border bg-white p-5'
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <h2 className='mb-2 font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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
          className='flex animate-fade-in-up flex-col gap-4 rounded-lg border border-border bg-white p-5'
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <h2 className='font-display font-medium text-foreground/70 text-sm uppercase tracking-wide'>
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

      <div className='flex gap-1 border-border border-b'>
        {TABS.map((tab) => {
          const isActive =
            tab.to === '/leads/$leadId'
              ? pathname === `/leads/${leadId}`
              : pathname.startsWith(tab.to.replace('$leadId', leadId));
          return (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ leadId }}
              className={
                isActive
                  ? 'border-primary border-b-2 px-3 py-2 font-display font-medium text-primary text-sm'
                  : 'border-transparent border-b-2 px-3 py-2 font-display text-foreground/60 text-sm hover:text-foreground'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </>
  );
}
