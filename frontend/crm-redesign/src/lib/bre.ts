import { apiFetch } from '@/lib/api';

export type BreCategory = {
  id: number;
  name: string;
};

export type BreRule = {
  id: number;
  name: string;
  category: BreCategory;
};

/** Backend's `BreDecision` numeric enum (`@finance-crm/database`, `1=>APPROVE,
 * 2=>REFER, 3=>REJECT`) — serializes over the wire as the raw number, not
 * the enum key. No `NOT_APPLICABLE` member exists there; `systemDecision`/
 * `manualDecision` default to `0` ("no decision yet") instead. */
export type BreDecision = 1 | 2 | 3;
export type BreDecisionOrNone = BreDecision | 0;

export const BRE_DECISION_LABEL: Record<BreDecisionOrNone, string> = {
  0: 'Not applicable',
  1: 'Approve',
  2: 'Refer',
  3: 'Reject',
};

export type BreRuleResult = {
  id: number;
  cutoffValue: string;
  actualValue: string;
  relevantInputs: string;
  systemDecision: BreDecisionOrNone;
  manualDecision: BreDecisionOrNone;
  manualDecisionRemarks: string | null;
  rule: BreRule;
};

export type UpsertBreCategoryInput = { name: string };
export type UpsertBreRuleInput = { name: string; categoryId: number };
export type ManualDecisionInput = {
  manualDecision: BreDecision;
  manualDecisionRemarks?: string;
};

export function listBreCategories() {
  return apiFetch<BreCategory[]>('/api/v1/bre-categories');
}

export function createBreCategory(dto: UpsertBreCategoryInput) {
  return apiFetch<BreCategory>('/api/v1/bre-categories', {
    method: 'POST',
    body: dto,
  });
}

export function updateBreCategory(id: number, dto: UpsertBreCategoryInput) {
  return apiFetch<BreCategory>(`/api/v1/bre-categories/${id}`, {
    method: 'PATCH',
    body: dto,
  });
}

export function removeBreCategory(id: number) {
  return apiFetch<void>(`/api/v1/bre-categories/${id}`, { method: 'DELETE' });
}

export function listBreRules(categoryId?: number) {
  const qs = categoryId ? `?categoryId=${categoryId}` : '';
  return apiFetch<BreRule[]>(`/api/v1/bre-rules${qs}`);
}

export function createBreRule(dto: UpsertBreRuleInput) {
  return apiFetch<BreRule>('/api/v1/bre-rules', { method: 'POST', body: dto });
}

export function updateBreRule(id: number, dto: Partial<UpsertBreRuleInput>) {
  return apiFetch<BreRule>(`/api/v1/bre-rules/${id}`, {
    method: 'PATCH',
    body: dto,
  });
}

export function removeBreRule(id: number) {
  return apiFetch<void>(`/api/v1/bre-rules/${id}`, { method: 'DELETE' });
}

export function listBreResults(leadId: number) {
  return apiFetch<BreRuleResult[]>(`/api/v1/leads/${leadId}/bre-results`);
}

/** Ports legacy's `run_bre` button (`Bre/bre.php`) — runs the full BRE rule
 * engine for a lead and records every rule result. */
export function runBre(leadId: number) {
  return apiFetch<unknown>(`/api/v1/leads/${leadId}/bre-results/run`, {
    method: 'POST',
  });
}

export function setBreManualDecision(
  leadId: number,
  resultId: number,
  dto: ManualDecisionInput,
) {
  return apiFetch<BreRuleResult>(
    `/api/v1/leads/${leadId}/bre-results/${resultId}/manual-decision`,
    { method: 'PATCH', body: dto },
  );
}
