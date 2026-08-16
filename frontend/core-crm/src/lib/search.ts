import { apiFetch } from '@/lib/api';
import type { Lead } from '@/lib/leads';

export type SearchResult = { leads: Lead[] };

export function search(q: string) {
  return apiFetch<SearchResult>(`/api/v1/search?q=${encodeURIComponent(q)}`);
}
