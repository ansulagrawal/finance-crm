import { apiFetch } from '@/lib/api';

/** Backend's `UserTargetAllocationType` numeric enum (`@finance-crm/database`,
 * `1=>SANCTION, 2=>COLLECTION`) — serializes/validates as the raw number.
 * Legacy stores one rolling row per (user, type) with no month window at
 * all, unlike the pre-restart entity this repo was originally built
 * against — there is no `targetMonth` anywhere in the real schema. */
export type UserTargetAllocationType = 1 | 2;

export const USER_TARGET_ALLOCATION_TYPE = {
  SANCTION: 1,
  COLLECTION: 2,
} as const;

export const USER_TARGET_ALLOCATION_TYPE_LABEL: Record<
  UserTargetAllocationType,
  string
> = {
  1: 'Sanction',
  2: 'Collection',
};

export type UserTargetAllocation = {
  id: number;
  user: { id: number; name: string };
  type: UserTargetAllocationType;
  targetCases: number | null;
  targetAmount: number | null;
  targetFollowups: number | null;
  achievedCases: number | null;
  achievedAmount: number | null;
  achievedFollowups: number | null;
};

export type UserPerformance = {
  userId: number;
  type: UserTargetAllocationType;
  targetCases: number;
  targetAmount: number;
  targetFollowups: number;
  achievedCases: number;
  achievedAmount: number;
  achievedFollowups: number;
};

export type UpsertUserTargetInput = {
  userId: number;
  type: UserTargetAllocationType;
  targetCases?: number;
  targetAmount?: number;
  targetFollowups?: number;
};

export function upsertUserTarget(dto: UpsertUserTargetInput) {
  return apiFetch<UserTargetAllocation>('/api/v1/performance/targets', {
    method: 'POST',
    body: dto,
  });
}

/** `GET /performance/:userId` is open to any authenticated user (no SA/CA
 * gate) — matches the backend's own `@Roles()` override on this route. */
export function getUserPerformance(
  userId: number,
  type: UserTargetAllocationType,
) {
  return apiFetch<UserPerformance>(
    `/api/v1/performance/${userId}?type=${type}`,
  );
}
