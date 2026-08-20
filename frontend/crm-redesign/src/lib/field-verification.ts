import { apiFetch } from '@/lib/api';
import type { Lead, PaginatedResult } from '@/lib/leads';

export type FieldVerificationTrack = 'RESIDENCE' | 'OFFICE';

/** 1=pending, 2=positive, 3=negative — mirrors the backend entity's
 * `residence_status`/`office_report_status` comment. */
export type FieldVerificationReportStatus = '1' | '2' | '3';

export type FieldVerificationVisit = {
  id: number;
  lead: Lead;
  residenceCpvInitiated: 'YES' | 'NO' | null;
  officeCpvInitiated: 'YES' | 'NO' | null;
  residenceReportStatus: FieldVerificationReportStatus | null;
  officeReportStatus: FieldVerificationReportStatus | null;
  visitRequestedBy: { id: number; name: string } | null;
  visitRequestedOn: string | null;
  residenceCpvAllocatedTo: { id: number; name: string } | null;
  officeCpvAllocatedTo: { id: number; name: string } | null;
};

export type ListFieldVerificationQueueQuery = {
  page?: number;
  limit?: number;
  track?: FieldVerificationTrack;
};

function toQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/** Role-scoped server-side (CO3 sees all, CO2 by covered state, CFE1 by
 * personal allocation, anyone else by who they personally requested) —
 * see `field-verification.service.ts listQueue()`. No client-side
 * "My queue / All" toggle needed, unlike `sanctions.tsx`/`loans.tsx`. */
export function listFieldVerificationQueue(
  query: ListFieldVerificationQueueQuery = {},
) {
  return apiFetch<PaginatedResult<FieldVerificationVisit>>(
    `/api/v1/field-verification/queue${toQueryString(query)}`,
  );
}
