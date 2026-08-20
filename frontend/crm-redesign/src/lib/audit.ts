import { apiFetch } from '@/lib/api';
import type { Lead, PaginatedResult } from '@/lib/leads';

export type AuditQueueStage =
  | 'AUDIT-NEW'
  | 'AUDIT-INPROCESS'
  | 'AUDIT-HOLD'
  | 'AUDIT-RECOMMENDED';

export type AuditQueueLead = Lead & {
  auditAssignedTo: { id: number; name: string } | null;
};

/** Backend's `LeadAuditCaseType` numeric enum (`1=>PRE_AUDIT, 2=>POST_AUDIT`)
 * — serializes over the wire as the raw number, not the enum key. */
export type LeadAuditCaseType = 1 | 2;

export const LEAD_AUDIT_CASE_TYPE_LABEL: Record<LeadAuditCaseType, string> = {
  1: 'Pre-audit',
  2: 'Post-audit',
};

export type LeadAuditHistoryEntry = {
  id: number;
  createdAt: string | null;
  assignedTo: { id: number; name: string } | null;
  leadStatus: { id: number; name: string } | null;
  caseType: LeadAuditCaseType | null;
  status: string | null;
  remarks: string | null;
};

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function listAuditQueue(
  query: { page?: number; limit?: number; stage?: AuditQueueStage } = {},
) {
  return apiFetch<PaginatedResult<AuditQueueLead>>(
    `/api/v1/audit/queue${toQueryString(query)}`,
  );
}

export function getAuditHistory(leadId: number) {
  return apiFetch<LeadAuditHistoryEntry[]>(
    `/api/v1/audit/leads/${leadId}/history`,
  );
}

export function sendToPreAudit(leadId: number, remarks?: string) {
  return apiFetch<Lead>(`/api/v1/audit/leads/${leadId}/send-to-pre-audit`, {
    method: 'POST',
    body: { remarks },
  });
}

export function sendToPostAudit(leadId: number, remarks?: string) {
  return apiFetch<Lead>(`/api/v1/audit/leads/${leadId}/send-to-post-audit`, {
    method: 'POST',
    body: { remarks },
  });
}

export function allocateAudit(leadIds: number[]) {
  return apiFetch<Lead[]>('/api/v1/audit/allocate', {
    method: 'POST',
    body: { leadIds },
  });
}

export function holdAudit(
  leadId: number,
  dto: { remarks: string; scheduledAt: string },
) {
  return apiFetch<Lead>(`/api/v1/audit/leads/${leadId}/hold`, {
    method: 'POST',
    body: dto,
  });
}

export function recommendAudit(leadId: number, remarks?: string) {
  return apiFetch<Lead>(`/api/v1/audit/leads/${leadId}/recommend`, {
    method: 'POST',
    body: { remarks },
  });
}

export function sendBackAudit(leadId: number, remarks: string) {
  return apiFetch<Lead>(`/api/v1/audit/leads/${leadId}/send-back`, {
    method: 'POST',
    body: { remarks },
  });
}

export function recordApprovalReason(leadId: number, remarks: string) {
  return apiFetch<Lead>(`/api/v1/audit/leads/${leadId}/approval-reason`, {
    method: 'POST',
    body: { remarks },
  });
}
