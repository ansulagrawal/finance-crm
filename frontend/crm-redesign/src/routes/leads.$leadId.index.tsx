import { createFileRoute } from '@tanstack/react-router';
import {
  CustomerSection,
  EmploymentSection,
  ReferencesSection,
} from '@/components/lead-sections';

export const Route = createFileRoute('/leads/$leadId/')({
  component: OverviewTabPage,
});

function OverviewTabPage() {
  const { leadId } = Route.useParams();
  const id = Number(leadId);

  return (
    <div className='flex flex-col gap-6'>
      <CustomerSection leadId={id} />
      <EmploymentSection leadId={id} />
      <ReferencesSection leadId={id} />
    </div>
  );
}
